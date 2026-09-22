"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface FuncionarioInput {
  nome: string;
  telefone?: string;
  foto?: string;
  comissaoAvulsa: number;
  comissaoAssinatura: number;
  unidadeId: string;
}

export async function criarFuncionario(input: FuncionarioInput) {
  try {
    if (!input.nome.trim()) {
      return { success: false, error: "O nome do barbeiro é obrigatório." };
    }

    if (!input.unidadeId) {
      return { success: false, error: "A unidade de alocação é obrigatória." };
    }

    if (input.comissaoAvulsa < 0 || input.comissaoAvulsa > 100) {
      return { success: false, error: "A comissão avulsa deve estar entre 0% e 100%." };
    }

    if (input.comissaoAssinatura < 0 || input.comissaoAssinatura > 100) {
      return { success: false, error: "A comissão de assinatura deve estar entre 0% e 100%." };
    }

    const funcionario = await prisma.funcionario.create({
      data: {
        nome: input.nome.trim(),
        telefone: input.telefone?.trim() || null,
        foto: input.foto?.trim() || null,
        comissaoAvulsa: input.comissaoAvulsa,
        comissaoAssinatura: input.comissaoAssinatura,
        unidadeId: input.unidadeId,
        ativo: true,
      },
    });

    revalidatePath("/funcionarios");
    revalidatePath("/receitas");
    revalidatePath("/dashboard");

    return { success: true, data: funcionario };
  } catch (error) {
    console.error("Erro ao criar funcionário:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao cadastrar o barbeiro.",
    };
  }
}

export async function atualizarFuncionario(id: string, input: FuncionarioInput) {
  try {
    if (!id) return { success: false, error: "ID inválido." };
    if (!input.nome.trim()) return { success: false, error: "O nome é obrigatório." };

    const funcionario = await prisma.funcionario.update({
      where: { id },
      data: {
        nome: input.nome.trim(),
        telefone: input.telefone?.trim() || null,
        comissaoAvulsa: input.comissaoAvulsa,
        comissaoAssinatura: input.comissaoAssinatura,
        unidadeId: input.unidadeId,
      },
    });

    revalidatePath("/funcionarios");
    revalidatePath("/receitas");
    revalidatePath("/dashboard");

    return { success: true, data: funcionario };
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar os dados do barbeiro.",
    };
  }
}

export async function alternarStatusFuncionario(id: string, novoStatus: boolean) {
  try {
    if (!id) return { success: false, error: "ID inválido." };

    const funcionario = await prisma.funcionario.update({
      where: { id },
      data: { ativo: novoStatus },
    });

    revalidatePath("/funcionarios");
    revalidatePath("/receitas");
    revalidatePath("/dashboard");

    return { success: true, data: funcionario };
  } catch (error) {
    console.error("Erro ao alternar status do funcionário:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao alternar status do barbeiro.",
    };
  }
}
