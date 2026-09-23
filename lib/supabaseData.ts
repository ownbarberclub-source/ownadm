import { supabaseAdmin, supabase } from "./supabase";

const db = supabaseAdmin || supabase;

export interface UnidadeAdm {
  id: string;
  nome: string;
  createdAt?: string | Date;
}

export interface FechamentoAdm {
  id: string;
  data: string | Date;
  unidadeId: string;
  unidade: UnidadeAdm;
  valorAssinaturas: number;
  valorAvulsos: number;
  valorExtras: number;
  valorProdutos: number;
  valorBebidas: number;
  valorOutrasReceitas: number;
  valorDescontos: number;
  valorEstornos: number;
  faturamentoBruto: number;
  faturamentoLiquido: number;
  valorDinheiro: number;
  valorPix: number;
  valorDebito: number;
  valorCredito: number;
  valorOutros: number;
  totalMeiosPagamento: number;
  diferencaPagamento: number;
  justificativaDiferenca: string | null;
  status: string;
  responsavel: string;
  observacoes: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RecorrenciaInfo {
  recorrenciaId: string;
  tipo: "CONTINUO" | "PARCELADO";
  parcelaAtual?: number;
  totalParcelas?: number;
}

export interface ContaPagarAdm {
  id: string;
  nome: string;
  valor: number;
  dataVencimento: string | Date;
  dataPagamento: string | Date | null;
  tipoDespesa: string;
  categoria: string;
  descricao: string | null;
  mesReferencia: string;
  status: string;
  observacao: string | null;
  unidadeId: string;
  unidade: UnidadeAdm;
  createdAt?: string | Date;
  recorrenciaInfo?: RecorrenciaInfo | null;
  textoObservacao?: string;
}

export function extrairMetadadosConta(observacao: string | null | undefined): {
  recorrenciaInfo: RecorrenciaInfo | null;
  textoObservacao: string;
} {
  if (!observacao) {
    return { recorrenciaInfo: null, textoObservacao: "" };
  }

  // Tentar parse como JSON estruturado
  try {
    if (observacao.startsWith("{") && observacao.endsWith("}")) {
      const parsed = JSON.parse(observacao);
      if (parsed && typeof parsed === "object" && parsed.recorrenciaId) {
        return {
          recorrenciaInfo: {
            recorrenciaId: String(parsed.recorrenciaId),
            tipo: parsed.tipo === "CONTINUO" ? "CONTINUO" : "PARCELADO",
            parcelaAtual: typeof parsed.parcelaAtual === "number" ? parsed.parcelaAtual : undefined,
            totalParcelas: typeof parsed.totalParcelas === "number" ? parsed.totalParcelas : undefined,
          },
          textoObservacao: typeof parsed.texto === "string" ? parsed.texto : "",
        };
      }
    }
  } catch {
    // Se falhar o parse JSON, prossegue com texto normal
  }

  // Tag fallback legada [REC:id:tipo:atual/total]
  const matchTag = observacao.match(/\[REC:([^:]+):([A-Z]+)(?::(\d+)\/(\d+))?\]/);
  if (matchTag) {
    const [, recorrenciaId, tipo, pAtual, pTotal] = matchTag;
    const textoLimpo = observacao.replace(matchTag[0], "").trim();
    return {
      recorrenciaInfo: {
        recorrenciaId,
        tipo: tipo === "CONTINUO" ? "CONTINUO" : "PARCELADO",
        parcelaAtual: pAtual ? Number(pAtual) : undefined,
        totalParcelas: pTotal ? Number(pTotal) : undefined,
      },
      textoObservacao: textoLimpo,
    };
  }

  return { recorrenciaInfo: null, textoObservacao: observacao };
}

export function codificarObservacao(
  texto: string | null | undefined,
  recorrencia?: RecorrenciaInfo | null
): string | null {
  const textoLimpo = texto?.trim() || "";
  if (!recorrencia) {
    return textoLimpo || null;
  }
  return JSON.stringify({
    recorrenciaId: recorrencia.recorrenciaId,
    tipo: recorrencia.tipo,
    parcelaAtual: recorrencia.parcelaAtual,
    totalParcelas: recorrencia.totalParcelas,
    texto: textoLimpo,
  });
}

export const UNIDADES_PADRAO: UnidadeAdm[] = [
  { id: "cmubrzybg0000lz0d4kkmj7bx", nome: "Own Barber Club Centro" },
  { id: "cmubrzygd0001lz0doyo02ao5", nome: "Own Barber Club Avenida" },
  { id: "cmubrzyii0002lz0dzc79bddr", nome: "Own Barber Club Efapi" },
];

export async function buscarUnidades(): Promise<UnidadeAdm[]> {
  try {
    const { data, error } = await db
      .from("adm_unidades")
      .select("*")
      .order("nome", { ascending: true });

    if (error || !data || data.length === 0) {
      return UNIDADES_PADRAO;
    }

    return data as UnidadeAdm[];
  } catch (err) {
    console.error("Erro ao buscar unidades do Supabase:", err);
    return UNIDADES_PADRAO;
  }
}

export async function buscarFechamentos(): Promise<FechamentoAdm[]> {
  try {
    const unidades = await buscarUnidades();
    const { data, error } = await db
      .from("adm_faturamento_diario")
      .select("*, unidade:adm_unidades(*)")
      .order("data", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((item) => {
      const u =
        item.unidade ||
        unidades.find((un) => un.id === item.unidadeId) || {
          id: item.unidadeId,
          nome: "Unidade",
        };

      return {
        ...item,
        unidade: u,
        valorPix: Number(item.valorPix) || 0,
        valorCredito: Number(item.valorCredito) || 0,
        valorDebito: Number(item.valorDebito) || 0,
        valorDinheiro: Number(item.valorDinheiro) || 0,
        valorAssinaturas: Number(item.valorAssinaturas) || 0,
        valorExtras: Number(item.valorExtras) || 0,
        valorProdutos: Number(item.valorProdutos) || 0,
        valorBebidas: Number(item.valorBebidas) || 0,
        valorOutrasReceitas: Number(item.valorOutrasReceitas) || 0,
        valorDescontos: Number(item.valorDescontos) || 0,
        valorEstornos: Number(item.valorEstornos) || 0,
        faturamentoBruto: Number(item.faturamentoBruto) || 0,
        faturamentoLiquido: Number(item.faturamentoLiquido) || 0,
        totalMeiosPagamento: Number(item.totalMeiosPagamento) || 0,
        diferencaPagamento: Number(item.diferencaPagamento) || 0,
        observacoes: item.observacoes || null,
        justificativaDiferenca: item.justificativaDiferenca || null,
      };
    }) as FechamentoAdm[];
  } catch (err) {
    console.error("Erro ao buscar faturamentos do Supabase:", err);
    return [];
  }
}

export async function buscarContasPagar(): Promise<ContaPagarAdm[]> {
  try {
    const unidades = await buscarUnidades();
    const { data, error } = await db
      .from("adm_contas_pagar")
      .select("*, unidade:adm_unidades(*)")
      .order("dataVencimento", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((item) => {
      const u =
        item.unidade ||
        unidades.find((un) => un.id === item.unidadeId) || {
          id: item.unidadeId,
          nome: "Unidade",
        };

      const { recorrenciaInfo, textoObservacao } = extrairMetadadosConta(item.observacao);

      return {
        ...item,
        dataPagamento: item.dataPagamento || null,
        unidade: u,
        valor: Number(item.valor) || 0,
        descricao: item.descricao || null,
        observacao: item.observacao || null,
        recorrenciaInfo,
        textoObservacao,
      };
    }) as ContaPagarAdm[];
  } catch (err) {
    console.error("Erro ao buscar contas a pagar do Supabase:", err);
    return [];
  }
}
