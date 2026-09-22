"use server";

import { supabaseAdmin, supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const db = supabaseAdmin || supabase;

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

    const [ano, mes, dia] = input.data.split("-").map(Number);
    const dataIso = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)).toISOString();

    const pix = Math.max(0, Number(input.valorPix) || 0);
    const credito = Math.max(0, Number(input.valorCredito) || 0);
    const debito = Math.max(0, Number(input.valorDebito) || 0);
    const dinheiro = Math.max(0, Number(input.valorDinheiro) || 0);
    const assinatura = Math.max(0, Number(input.valorAssinaturas) || 0);

    const faturamentoTotal = pix + credito + debito + dinheiro + assinatura;

    const payload = {
      data: dataIso,
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
      updatedAt: new Date().toISOString(),
    };

    let res;
    if (input.id) {
      res = await db
        .from("adm_faturamento_diario")
        .update(payload)
        .eq("id", input.id)
        .select()
        .single();
    } else {
      res = await db
        .from("adm_faturamento_diario")
        .upsert(payload, { onConflict: "unidadeId,data" })
        .select()
        .single();
    }

    if (res.error) {
      throw new Error(res.error.message);
    }

    try {
      revalidatePath("/faturamento");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora fora de contexto Next
    }

    return { success: true, data: res.data };
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

    const { error } = await db
      .from("adm_faturamento_diario")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    try {
      revalidatePath("/faturamento");
      revalidatePath("/dashboard");
      revalidatePath("/relatorios/dre");
    } catch {
      // Ignora fora de contexto Next
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
