"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

    // Normalizar data de vencimento
    const [anoVenc, mesVenc, diaVenc] = input.dataVencimento.split("-").map(Number);
    const dataVencObj = new Date(Date.UTC(anoVenc, mesVenc - 1, diaVenc, 12, 0, 0));

    // Determinar mês de referência padrão caso não informado
    let mesRef = input.mesReferencia?.trim();
    if (!mesRef) {
      mesRef = `${anoVenc}-${String(mesVenc).padStart(2, "0")}`;
    }

    // Calcular status inicial
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVencComparacao = new Date(anoVenc, mesVenc - 1, diaVenc);
    dataVencComparacao.setHours(0, 0, 0, 0);

    let status = "PENDENTE";
    if (dataVencComparacao < hoje) {
      status = "ATRASADA";
    }

    let conta;
    if (input.id) {
      // Manter status PAGA se já estiver paga
      const existente = await prisma.contaPagar.findUnique({ where: { id: input.id } });
      const statusFinal = existente?.dataPagamento ? "PAGA" : status;

      conta = await prisma.contaPagar.update({
        where: { id: input.id },
        data: {
          nome: input.descricao.trim(),
          descricao: input.descricao.trim(),
          unidadeId: input.unidadeId,
          categoria: input.categoria.trim(),
          valor,
          dataVencimento: dataVencObj,
          mesReferencia: mesRef,
          observacao: input.observacao?.trim() || null,
          status: statusFinal,
        },
      });
    } else {
      conta = await prisma.contaPagar.create({
        data: {
          nome: input.descricao.trim(),
          descricao: input.descricao.trim(),
          unidadeId: input.unidadeId,
          categoria: input.categoria.trim(),
          valor,
          dataVencimento: dataVencObj,
          mesReferencia: mesRef,
          observacao: input.observacao?.trim() || null,
          status,
          tipoDespesa: "FIXO",
        },
      });
    }

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora erro de contexto fora de requisição Next.js
    }

    return { success: true, data: conta };
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
    const dataPagamentoObj = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));

    const conta = await prisma.contaPagar.update({
      where: { id },
      data: {
        dataPagamento: dataPagamentoObj,
        status: "PAGA",
      },
    });

    try {
      revalidatePath("/contas");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora erro de contexto fora de requisição Next.js
    }

    return { success: true, data: conta };
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

    const contaExistente = await prisma.contaPagar.findUnique({ where: { id } });
    if (!contaExistente) return { success: false, error: "Conta não encontrada." };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(contaExistente.dataVencimento);
    venc.setHours(0, 0, 0, 0);

    const novoStatus = venc < hoje ? "ATRASADA" : "PENDENTE";

    const conta = await prisma.contaPagar.update({
      where: { id },
      data: {
        dataPagamento: null,
        status: novoStatus,
      },
    });

    revalidatePath("/contas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios/dre");

    return { success: true, data: conta };
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

    await prisma.contaPagar.delete({
      where: { id },
    });

    revalidatePath("/contas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios/dre");

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir conta a pagar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover despesa.",
    };
  }
}
