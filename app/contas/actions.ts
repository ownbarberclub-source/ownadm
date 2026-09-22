"use server";

import { supabaseAdmin, supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
    const dataVencComparacao = new Date(anoVenc, mesVenc - 1, diaVenc);
    dataVencComparacao.setHours(0, 0, 0, 0);

    let status = "PENDENTE";
    if (dataVencComparacao < hoje) {
      status = "ATRASADA";
    }

    let payload: Record<string, unknown> = {
      nome: input.descricao.trim(),
      descricao: input.descricao.trim(),
      unidadeId: input.unidadeId,
      categoria: input.categoria.trim(),
      valor,
      dataVencimento: dataVencIso,
      mesReferencia: mesRef,
      observacao: input.observacao?.trim() || null,
      tipoDespesa: "FIXO",
    };

    let res;
    if (input.id) {
      const { data: existente } = await db
        .from("adm_contas_pagar")
        .select("dataPagamento, status")
        .eq("id", input.id)
        .single();

      const statusFinal = existente?.dataPagamento ? "PAGA" : status;
      payload.status = statusFinal;

      res = await db
        .from("adm_contas_pagar")
        .update(payload)
        .eq("id", input.id)
        .select()
        .single();
    } else {
      payload.status = status;
      res = await db
        .from("adm_contas_pagar")
        .insert([payload])
        .select()
        .single();
    }

    if (res.error) {
      throw new Error(res.error.message);
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora fora de contexto Next
    }

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
    } catch {
      // Ignora fora de contexto Next
    }

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
    } catch {
      // Ignora fora de contexto Next
    }

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
    } catch {
      // Ignora fora de contexto Next
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir conta a pagar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover despesa.",
    };
  }
}
