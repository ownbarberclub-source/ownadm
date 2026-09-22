"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SalvarReceitaInput {
  funcionarioId: string;
  tipo: "AVULSO" | "ASSINATURA";
  valorComissao: number;
  formaPagamento: "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO";
  data: string;
  observacao?: string;
}

export async function salvarLancamentoReceita(input: SalvarReceitaInput) {
  try {
    if (!input.funcionarioId) {
      return { success: false, error: "Selecione um barbeiro válido." };
    }

    if (input.valorComissao <= 0 || isNaN(input.valorComissao)) {
      return { success: false, error: "Informe um valor de comissão válido e maior que zero." };
    }

    const funcionario = await prisma.funcionario.findUnique({
      where: { id: input.funcionarioId },
      include: { unidade: true },
    });

    if (!funcionario) {
      return { success: false, error: "Barbeiro não encontrado no sistema." };
    }

    const percentual =
      input.tipo === "AVULSO" ? funcionario.comissaoAvulsa : funcionario.comissaoAssinatura;

    const faturamentoCadeira =
      percentual > 0 ? input.valorComissao / (percentual / 100) : input.valorComissao;

    const dataLancamento = input.data ? new Date(input.data + "T12:00:00Z") : new Date();

    const lancamento = await prisma.lancamentoReceita.create({
      data: {
        tipo: input.tipo,
        valorComissao: input.valorComissao,
        faturamentoCadeira: faturamentoCadeira,
        formaPagamento: input.formaPagamento,
        data: dataLancamento,
        observacao: input.observacao?.trim() || null,
        funcionarioId: funcionario.id,
        unidadeId: funcionario.unidadeId,
      },
    });

    revalidatePath("/receitas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios/dre");

    return { success: true, data: lancamento };
  } catch (error) {
    console.error("Erro ao salvar lançamento de receita:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro interno ao processar o lançamento.",
    };
  }
}
