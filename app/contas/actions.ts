"use server";

import { supabaseAdmin, supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { codificarObservacao, extrairMetadadosConta } from "@/lib/supabaseData";

const db = supabaseAdmin || supabase;

export interface ContaPagarInput {
  id?: string;
  descricao: string;
  unidadeId: string;
  categoria: string;
  valor: number;
  dataVencimento: string; // "YYYY-MM-DD"
  mesReferencia: string; // "YYYY-MM"
  observacao?: string;
  // Recorrência & Parcelamento
  tipoLancamento?: "UNICA" | "CONTINUA" | "PARCELADA";
  totalParcelas?: number; // Para parcelada (ex: 60)
  valorModo?: "PARCELA" | "TOTAL"; // Se o valor informado é da parcela ou total
  // Reajuste em série / Atualização em lote
  aplicarAFuturas?: boolean;
  recorrenciaId?: string;
}

function calcularDataVencimentoOffset(
  anoBase: number,
  mesBase: number,
  diaBase: number,
  offsetMeses: number
) {
  const targetMonthIndex = mesBase - 1 + offsetMeses;
  const targetYear = anoBase + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(diaBase, daysInTargetMonth);
  const mesRef = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const dataIso = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0)).toISOString();
  return { ano: targetYear, mes: targetMonth, dia: targetDay, mesRef, dataIso };
}

export async function salvarContaPagar(input: ContaPagarInput) {
  try {
    if (!input.descricao?.trim()) {
      return { success: false, error: "A descrição da conta é obrigatória." };
    }

    if (!input.unidadeId) {
      return { success: false, error: "A unidade é obrigatória." };
    }

    if (!input.categoria?.trim()) {
      return { success: false, error: "A categoria é obrigatória." };
    }

    const valor = Number(input.valor) || 0;
    if (valor <= 0) {
      return { success: false, error: "O valor da conta deve ser maior que zero." };
    }

    if (!input.dataVencimento) {
      return { success: false, error: "A data de vencimento é obrigatória." };
    }

    const [anoVenc, mesVenc, diaVenc] = input.dataVencimento.split("-").map(Number);
    const dataVencIso = new Date(Date.UTC(anoVenc, mesVenc - 1, diaVenc, 12, 0, 0)).toISOString();

    let mesRef = input.mesReferencia?.trim();
    if (!mesRef) {
      mesRef = `${anoVenc}-${String(mesVenc).padStart(2, "0")}`;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // =========================================================================
    // 1. EDIÇÃO DE UMA CONTA EXISTENTE
    // =========================================================================
    if (input.id) {
      const { data: existente, error: errExistente } = await db
        .from("adm_contas_pagar")
        .select("*")
        .eq("id", input.id)
        .single();

      if (errExistente || !existente) {
        return { success: false, error: "Conta não encontrada para edição." };
      }

      const metaAtual = extrairMetadadosConta(existente.observacao);
      const recorrenciaId = input.recorrenciaId || metaAtual.recorrenciaInfo?.recorrenciaId;

      const dataVencComparacao = new Date(anoVenc, mesVenc - 1, diaVenc);
      dataVencComparacao.setHours(0, 0, 0, 0);
      const statusFinal = existente.dataPagamento
        ? "PAGA"
        : dataVencComparacao < hoje
        ? "ATRASADA"
        : "PENDENTE";

      // Observação codificada preservando metadados de recorrência se existirem
      const observacaoFinal = codificarObservacao(
        input.observacao !== undefined ? input.observacao : metaAtual.textoObservacao,
        metaAtual.recorrenciaInfo
      );

      const payload: Record<string, unknown> = {
        nome: input.descricao.trim(),
        descricao:
          metaAtual.recorrenciaInfo?.tipo === "PARCELADO" && metaAtual.recorrenciaInfo.parcelaAtual
            ? `${input.descricao.trim()} (${String(metaAtual.recorrenciaInfo.parcelaAtual).padStart(2, "0")}/${String(metaAtual.recorrenciaInfo.totalParcelas || 1).padStart(2, "0")})`
            : input.descricao.trim(),
        unidadeId: input.unidadeId,
        categoria: input.categoria.trim(),
        valor,
        dataVencimento: dataVencIso,
        mesReferencia: mesRef,
        observacao: observacaoFinal,
        status: statusFinal,
      };

      const res = await db
        .from("adm_contas_pagar")
        .update(payload)
        .eq("id", input.id)
        .select()
        .single();

      if (res.error) throw new Error(res.error.message);

      // Se o usuário solicitou aplicar este novo valor a esta e todas as contas futuras pendentes da série (Reajuste)
      if (input.aplicarAFuturas && recorrenciaId) {
        const { data: futuras, error: errFuturas } = await db
          .from("adm_contas_pagar")
          .select("*")
          .like("observacao", `%${recorrenciaId}%`);

        if (!errFuturas && futuras) {
          const updates = futuras.filter((c) => {
            // Não alterar contas de meses anteriores nem contas já liquidadas
            if (c.id === input.id) return false;
            if (c.status === "PAGA" || c.dataPagamento) return false;
            return c.mesReferencia >= mesRef;
          });

          for (const item of updates) {
            const metaItem = extrairMetadadosConta(item.observacao);
            const obsItem = codificarObservacao(
              input.observacao !== undefined ? input.observacao : metaItem.textoObservacao,
              metaItem.recorrenciaInfo
            );

            let descItem = input.descricao.trim();
            if (metaItem.recorrenciaInfo?.tipo === "PARCELADO" && metaItem.recorrenciaInfo.parcelaAtual) {
              descItem = `${input.descricao.trim()} (${String(metaItem.recorrenciaInfo.parcelaAtual).padStart(2, "0")}/${String(metaItem.recorrenciaInfo.totalParcelas || 1).padStart(2, "0")})`;
            }

            await db
              .from("adm_contas_pagar")
              .update({
                nome: input.descricao.trim(),
                descricao: descItem,
                categoria: input.categoria.trim(),
                valor,
                observacao: obsItem,
              })
              .eq("id", item.id);
          }
        }
      }

      try {
        revalidatePath("/contas");
        revalidatePath("/dashboard");
        revalidatePath("/relatorios/dre");
      } catch {}

      return { success: true, data: res.data };
    }

    // =========================================================================
    // 2. CADASTRO DE NOVA CONTA (ÚNICA, PARCELADA OU RECORRENTE CONTÍNUA)
    // =========================================================================
    const tipo = input.tipoLancamento || "UNICA";

    // 2.1 CONTA PARCELADA (Ex: Financiamento 60x, Boletos parcelados, Cartão)
    if (tipo === "PARCELADA") {
      const totalParcelas = Math.max(2, Math.min(360, Number(input.totalParcelas) || 2));
      const recorrenciaId = crypto.randomUUID();

      let valorParcela = valor;
      if (input.valorModo === "TOTAL") {
        valorParcela = Math.round((valor / totalParcelas) * 100) / 100;
      }

      const rowsToInsert = [];
      for (let i = 1; i <= totalParcelas; i++) {
        const offset = i - 1;
        const calc = calcularDataVencimentoOffset(anoVenc, mesVenc, diaVenc, offset);
        const dataVencComp = new Date(calc.ano, calc.mes - 1, calc.dia);
        dataVencComp.setHours(0, 0, 0, 0);
        const st = dataVencComp < hoje ? "ATRASADA" : "PENDENTE";

        const obs = codificarObservacao(input.observacao, {
          recorrenciaId,
          tipo: "PARCELADO",
          parcelaAtual: i,
          totalParcelas,
        });

        rowsToInsert.push({
          nome: input.descricao.trim(),
          descricao: `${input.descricao.trim()} (${String(i).padStart(2, "0")}/${String(totalParcelas).padStart(2, "0")})`,
          unidadeId: input.unidadeId,
          categoria: input.categoria.trim(),
          valor: valorParcela,
          dataVencimento: calc.dataIso,
          mesReferencia: calc.mesRef,
          observacao: obs,
          tipoDespesa: "FIXO",
          status: st,
        });
      }

      // Inserção em blocos de até 50 registros para estabilidade
      const chunkSize = 50;
      let insertedCount = 0;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const res = await db.from("adm_contas_pagar").insert(chunk);
        if (res.error) throw new Error(res.error.message);
        insertedCount += chunk.length;
      }

      try {
        revalidatePath("/contas");
        revalidatePath("/dashboard");
        revalidatePath("/relatorios/dre");
      } catch {}

      return {
        success: true,
        data: { recorrenciaId, totalParcelas, insertedCount },
      };
    }

    // 2.2 CONTA RECORRENTE MENSAL CONTÍNUA (Ex: Aluguel, Luz, Assinaturas fixas)
    if (tipo === "CONTINUA") {
      const recorrenciaId = crypto.randomUUID();
      const mesesProjecao = 24; // 24 meses iniciais de projeção contínua

      const rowsToInsert = [];
      for (let i = 0; i < mesesProjecao; i++) {
        const calc = calcularDataVencimentoOffset(anoVenc, mesVenc, diaVenc, i);
        const dataVencComp = new Date(calc.ano, calc.mes - 1, calc.dia);
        dataVencComp.setHours(0, 0, 0, 0);
        const st = dataVencComp < hoje ? "ATRASADA" : "PENDENTE";

        const obs = codificarObservacao(input.observacao, {
          recorrenciaId,
          tipo: "CONTINUO",
        });

        rowsToInsert.push({
          nome: input.descricao.trim(),
          descricao: input.descricao.trim(),
          unidadeId: input.unidadeId,
          categoria: input.categoria.trim(),
          valor,
          dataVencimento: calc.dataIso,
          mesReferencia: calc.mesRef,
          observacao: obs,
          tipoDespesa: "FIXO",
          status: st,
        });
      }

      const res = await db.from("adm_contas_pagar").insert(rowsToInsert);
      if (res.error) throw new Error(res.error.message);

      try {
        revalidatePath("/contas");
        revalidatePath("/dashboard");
        revalidatePath("/relatorios/dre");
      } catch {}

      return {
        success: true,
        data: { recorrenciaId, mesesProjetados: mesesProjecao },
      };
    }

    // 2.3 CONTA ÚNICA (PADRÃO)
    const dataVencComparacao = new Date(anoVenc, mesVenc - 1, diaVenc);
    dataVencComparacao.setHours(0, 0, 0, 0);
    const status = dataVencComparacao < hoje ? "ATRASADA" : "PENDENTE";

    const payload: Record<string, unknown> = {
      nome: input.descricao.trim(),
      descricao: input.descricao.trim(),
      unidadeId: input.unidadeId,
      categoria: input.categoria.trim(),
      valor,
      dataVencimento: dataVencIso,
      mesReferencia: mesRef,
      observacao: codificarObservacao(input.observacao, null),
      tipoDespesa: "FIXO",
      status,
    };

    const res = await db.from("adm_contas_pagar").insert([payload]).select().single();
    if (res.error) throw new Error(res.error.message);

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {}

    return { success: true, data: res.data };
  } catch (error) {
    console.error("Erro ao salvar conta a pagar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro interno ao salvar conta.",
    };
  }
}

export async function marcarContaComoPaga(id: string, dataPagamentoStr: string) {
  try {
    if (!id) return { success: false, error: "ID inválido." };
    if (!dataPagamentoStr) return { success: false, error: "A data do pagamento é obrigatória." };

    const [ano, mes, dia] = dataPagamentoStr.split("-").map(Number);
    const dataPagamentoIso = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)).toISOString();

    const { data, error } = await db
      .from("adm_contas_pagar")
      .update({
        dataPagamento: dataPagamentoIso,
        status: "PAGA",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {}

    return { success: true, data };
  } catch (error) {
    console.error("Erro ao marcar conta como paga:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar pagamento da conta.",
    };
  }
}

export async function desmarcarContaPaga(id: string) {
  try {
    if (!id) return { success: false, error: "ID inválido." };

    const { data: contaExistente, error: errExistente } = await db
      .from("adm_contas_pagar")
      .select("*")
      .eq("id", id)
      .single();

    if (errExistente || !contaExistente) {
      return { success: false, error: "Conta não encontrada." };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(contaExistente.dataVencimento);
    venc.setHours(0, 0, 0, 0);

    const novoStatus = venc < hoje ? "ATRASADA" : "PENDENTE";

    const { data, error } = await db
      .from("adm_contas_pagar")
      .update({
        dataPagamento: null,
        status: novoStatus,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {}

    return { success: true, data };
  } catch (error) {
    console.error("Erro ao desmarcar pagamento:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao estornar baixa.",
    };
  }
}

export async function excluirContaPagar(id: string) {
  try {
    if (!id) return { success: false, error: "ID inválido." };

    const { error } = await db
      .from("adm_contas_pagar")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {}

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir conta a pagar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover despesa.",
    };
  }
}

export async function excluirSerieContaPagar(recorrenciaId: string, aPartirDeMesRef?: string) {
  try {
    if (!recorrenciaId) return { success: false, error: "Identificador de recorrência inválido." };

    const { data: registros, error: errBusca } = await db
      .from("adm_contas_pagar")
      .select("id, status, dataPagamento, mesReferencia")
      .like("observacao", `%${recorrenciaId}%`);

    if (errBusca) throw new Error(errBusca.message);
    if (!registros || registros.length === 0) return { success: true, deletadas: 0 };

    // Filtra apenas pendentes / atrasadas (NUNCA deleta contas já pagas)
    const idsParaDeletar = registros
      .filter((r) => {
        if (r.status === "PAGA" || r.dataPagamento) return false;
        if (aPartirDeMesRef && r.mesReferencia < aPartirDeMesRef) return false;
        return true;
      })
      .map((r) => r.id);

    if (idsParaDeletar.length > 0) {
      const { error: errDel } = await db
        .from("adm_contas_pagar")
        .delete()
        .in("id", idsParaDeletar);

      if (errDel) throw new Error(errDel.message);
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {}

    return { success: true, deletadas: idsParaDeletar.length };
  } catch (error) {
    console.error("Erro ao excluir série de contas a pagar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover série de contas.",
    };
  }
}
