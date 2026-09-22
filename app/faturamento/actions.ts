"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface FaturamentoInput {
  id?: string;
  data: string; // "YYYY-MM-DD"
  unidadeId: string;
  valorPix: number;
  valorCredito: number;
  valorDebito: number;
  valorDinheiro: number;
  valorAssinaturas: number;
  observacoes?: string;
}

export async function salvarFaturamento(input: FaturamentoInput) {
  try {
    if (!input.unidadeId) {
      return { success: false, error: "A unidade é obrigatória." };
    }

    if (!input.data) {
      return { success: false, error: "A data do faturamento é obrigatória." };
    }

    // Normalizar data para UTC meia-noite
    const [ano, mes, dia] = input.data.split("-").map(Number);
    const dataObj = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));

    const pix = Math.max(0, Number(input.valorPix) || 0);
    const credito = Math.max(0, Number(input.valorCredito) || 0);
    const debito = Math.max(0, Number(input.valorDebito) || 0);
    const dinheiro = Math.max(0, Number(input.valorDinheiro) || 0);
    const assinatura = Math.max(0, Number(input.valorAssinaturas) || 0);

    const faturamentoTotal = pix + credito + debito + dinheiro + assinatura;

    // Verificar se já existe lançamento para a mesma unidade na mesma data
    // Buscar no intervalo do dia para garantir em caso de timezone
    const inicioDia = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0));
    const fimDia = new Date(Date.UTC(ano, mes - 1, dia, 23, 59, 59, 999));

    const existente = await prisma.fechamentoFaturamento.findFirst({
      where: {
        unidadeId: input.unidadeId,
        data: {
          gte: inicioDia,
          lte: fimDia,
        },
      },
    });

    // Se já existe e não estamos editando o próprio registro
    if (existente && (!input.id || existente.id !== input.id)) {
      return {
        success: false,
        error: "Já existe um lançamento para esta unidade nesta data. Edite o registro existente.",
        existenteId: existente.id,
      };
    }

    let resultado;
    const targetId = input.id || existente?.id;

    if (targetId) {
      // Atualizar registro existente
      resultado = await prisma.fechamentoFaturamento.update({
        where: { id: targetId },
        data: {
          data: dataObj,
          unidadeId: input.unidadeId,
          valorPix: pix,
          valorCredito: credito,
          valorDebito: debito,
          valorDinheiro: dinheiro,
          valorAssinaturas: assinatura,
          faturamentoBruto: faturamentoTotal,
          faturamentoLiquido: faturamentoTotal,
          totalMeiosPagamento: faturamentoTotal,
          observacoes: input.observacoes?.trim() || null,
          status: "FECHADO",
          responsavel: "Administrador",
        },
      });
    } else {
      // Criar novo registro
      resultado = await prisma.fechamentoFaturamento.create({
        data: {
          data: dataObj,
          unidadeId: input.unidadeId,
          valorPix: pix,
          valorCredito: credito,
          valorDebito: debito,
          valorDinheiro: dinheiro,
          valorAssinaturas: assinatura,
          faturamentoBruto: faturamentoTotal,
          faturamentoLiquido: faturamentoTotal,
          totalMeiosPagamento: faturamentoTotal,
          observacoes: input.observacoes?.trim() || null,
          status: "FECHADO",
          responsavel: "Administrador",
        },
      });
    }

    try {
      revalidatePath("/faturamento");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora erro de contexto fora de requisição Next.js
    }

    return { success: true, data: resultado };
  } catch (error) {
    console.error("Erro ao salvar faturamento:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro interno ao salvar faturamento.",
    };
  }
}

export async function excluirFaturamento(id: string) {
  try {
    if (!id) return { success: false, error: "ID inválido." };

    await prisma.fechamentoFaturamento.delete({
      where: { id },
    });

    try {
      revalidatePath("/faturamento");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora erro de contexto fora de requisição Next.js
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir faturamento:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao remover faturamento.",
    };
  }
}
