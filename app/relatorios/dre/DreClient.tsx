"use client";

import { useState, useMemo } from "react";
import {
  FileDown,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  gerarPdfDre,
  formatarBRL,
  DrePdfData,
} from "@/lib/pdfRelatorios";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface FechamentoItem {
  id: string;
  data: Date | string;
  unidadeId: string;
  unidade: { id: string; nome: string };
  valorPix: number;
  valorCredito: number;
  valorDebito: number;
  valorDinheiro: number;
  valorAssinaturas: number;
  faturamentoBruto: number;
}

interface ContaItem {
  id: string;
  nome: string;
  valor: number;
  dataVencimento: Date | string;
  dataPagamento: Date | string | null;
  categoria: string;
  descricao: string | null;
  mesReferencia: string;
  status: string;
  unidadeId: string;
  unidade: { id: string; nome: string };
}

export default function DreClient({
  fechamentos,
  contas,
  unidades,
  unidadeInicialId,
}: {
  fechamentos: FechamentoItem[];
  contas: ContaItem[];
  unidades: UnidadeItem[];
  unidadeInicialId: string;
}) {
  // Filtros
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const [filtroUnidade, setFiltroUnidade] = useState(unidadeInicialId || "GLOBAL");
  const [filtroMes, setFiltroMes] = useState(mesAtualStr);

  const hojeTimestamp = new Date();
  hojeTimestamp.setHours(0, 0, 0, 0);

  // 1. Filtrar e calcular Receitas do Mês
  const dadosReceitas = useMemo(() => {
    const fechamentosFiltrados = fechamentos.filter((f) => {
      // Unidade
      if (filtroUnidade !== "GLOBAL" && f.unidadeId !== filtroUnidade) {
        return false;
      }

      // Mês
      const dStr = new Date(f.data).toISOString().split("T")[0];
      return dStr.startsWith(filtroMes);
    });

    let pix = 0;
    let credito = 0;
    let debito = 0;
    let dinheiro = 0;
    let assinaturas = 0;

    fechamentosFiltrados.forEach((f) => {
      pix += f.valorPix;
      credito += f.valorCredito;
      debito += f.valorDebito;
      dinheiro += f.valorDinheiro;
      assinaturas += f.valorAssinaturas;
    });

    const receitaTotal = pix + credito + debito + dinheiro + assinaturas;

    return {
      pix,
      credito,
      debito,
      dinheiro,
      assinaturas,
      receitaTotal,
      quantidadeFechamentos: fechamentosFiltrados.length,
    };
  }, [fechamentos, filtroUnidade, filtroMes]);

  // 2. Filtrar e agrupar Despesas do Mês de Referência
  const dadosDespesas = useMemo(() => {
    const contasFiltradas = contas.filter((c) => {
      // Unidade
      if (filtroUnidade !== "GLOBAL" && c.unidadeId !== filtroUnidade) {
        return false;
      }

      // Mês de Referência (se vazio, usa o mês do vencimento)
      const ref = c.mesReferencia || new Date(c.dataVencimento).toISOString().slice(0, 7);
      return ref === filtroMes;
    });

    const mapaCategorias = new Map<string, number>();
    let totalPago = 0;
    let totalPendente = 0;
    let totalAtrasado = 0;
    let totalGeral = 0;

    contasFiltradas.forEach((c) => {
      const cat = c.categoria || "Outras despesas";
      mapaCategorias.set(cat, (mapaCategorias.get(cat) || 0) + c.valor);
      totalGeral += c.valor;

      const venc = new Date(c.dataVencimento);
      venc.setHours(0, 0, 0, 0);

      const estaPaga = !!c.dataPagamento;
      const estaAtrasada = !estaPaga && venc < hojeTimestamp;

      if (estaPaga) {
        totalPago += c.valor;
      } else if (estaAtrasada) {
        totalAtrasado += c.valor;
      } else {
        totalPendente += c.valor;
      }
    });

    const listaCategorias = Array.from(mapaCategorias.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      listaCategorias,
      totalGeral,
      totalPago,
      totalPendente,
      totalAtrasado,
      quantidadeContas: contasFiltradas.length,
    };
  }, [contas, filtroUnidade, filtroMes, hojeTimestamp]);

  // 3. Resultado e Margem
  const resultadoMes = dadosReceitas.receitaTotal - dadosDespesas.totalGeral;
  const margemPercentual =
    dadosReceitas.receitaTotal > 0
      ? (resultadoMes / dadosReceitas.receitaTotal) * 100
      : 0;

  // Nome da Unidade Selecionada
  const nomeUnidadeSelecionada =
    filtroUnidade === "GLOBAL"
      ? "Consolidado Own Barber Club"
      : unidades.find((u) => u.id === filtroUnidade)?.nome || "Unidade";

  const [anoFiltro, mesFiltro] = filtroMes.split("-");
  const mesFormatado = `${mesFiltro}/${anoFiltro}`;

  // Baixar PDF
  const handleBaixarPdf = () => {
    const dadosPdf: DrePdfData = {
      mesReferencia: mesFormatado,
      unidade: nomeUnidadeSelecionada,
      receitaPix: dadosReceitas.pix,
      receitaCredito: dadosReceitas.credito,
      receitaDebito: dadosReceitas.debito,
      receitaDinheiro: dadosReceitas.dinheiro,
      receitaAssinaturas: dadosReceitas.assinaturas,
      receitaTotal: dadosReceitas.receitaTotal,
      despesasPorCategoria: dadosDespesas.listaCategorias,
      despesaTotal: dadosDespesas.totalGeral,
      despesaPaga: dadosDespesas.totalPago,
      despesaPendente: dadosDespesas.totalPendente,
      despesaAtrasada: dadosDespesas.totalAtrasado,
      resultadoMes,
      margemPercentual,
    };

    gerarPdfDre(dadosPdf);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* BARRA SUPERIOR DE FILTROS E AÇÃO */}
      <div className="bg-[#111] border border-[#222] p-4 rounded-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Seletor de Unidade */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Unidade:</span>
            <select
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white text-xs font-rajdhani font-semibold uppercase px-3 py-2 rounded-sm focus:outline-none focus:border-[#E51E25] cursor-pointer"
            >
              <option value="GLOBAL">🏛️ Consolidado Own Barber Club</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  📍 {u.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Mês */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Mês de Referência:</span>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white text-xs font-mono px-3 py-1.5 rounded-sm focus:outline-none focus:border-[#E51E25]"
            />
          </div>
        </div>

        {/* Botão Baixar PDF */}
        <button
          onClick={handleBaixarPdf}
          className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-sm transition-all shadow-[0_0_12px_rgba(229,30,37,0.3)] cursor-pointer"
        >
          <FileDown size={15} /> Baixar PDF
        </button>
      </div>

      {/* 4 CARDS RESUMO DO RESULTADO FINAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111] border-l-4 border-emerald-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Receita Total
            <TrendingUp size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-emerald-400">
            {formatarBRL(dadosReceitas.receitaTotal)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {dadosReceitas.quantidadeFechamentos} fechamento(s) no mês
          </div>
        </div>

        <div className="bg-[#111] border-l-4 border-red-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Despesa Total
            <DollarSign size={15} className="text-red-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-red-400">
            {formatarBRL(dadosDespesas.totalGeral)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {dadosDespesas.quantidadeContas} despesa(s) de competência {mesFormatado}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#111] border-l-4 border-[#E51E25] p-4 rounded-sm shadow-[0_0_12px_rgba(229,30,37,0.15)]">
          <div className="text-[10px] font-rajdhani uppercase text-[#E51E25] font-bold flex items-center justify-between mb-1">
            Resultado Final
            <DollarSign size={15} className="text-[#E51E25]" />
          </div>
          <div
            className={`text-2xl font-rajdhani font-bold ${
              resultadoMes >= 0 ? "text-emerald-400" : "text-[#E51E25]"
            }`}
          >
            {formatarBRL(resultadoMes)}
          </div>
          <div className="text-[10px] text-gray-400 font-mono mt-1">Receita - Despesas</div>
        </div>

        <div className="bg-[#111] border-l-4 border-purple-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Margem de Resultado
            <Percent size={15} className="text-purple-400" />
          </div>
          <div
            className={`text-2xl font-rajdhani font-bold ${
              margemPercentual >= 0 ? "text-purple-400" : "text-[#E51E25]"
            }`}
          >
            {margemPercentual.toFixed(2)}%
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {dadosReceitas.receitaTotal > 0 ? "Margem líquida sobre faturamento" : "Sem receita no período"}
          </div>
        </div>
      </div>

      {/* PAINEL DRE: RECEITAS & DESPESAS LADO A LADO OU ESTRUTURADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEÇÃO 1: RECEITAS */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h2 className="text-base font-rajdhani font-bold text-white uppercase tracking-wider">
                1. Receitas do Mês ({mesFormatado})
              </h2>
            </div>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {formatarBRL(dadosReceitas.receitaTotal)}
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: "PIX", valor: dadosReceitas.pix },
              { label: "Cartão de Crédito", valor: dadosReceitas.credito },
              { label: "Cartão de Débito", valor: dadosReceitas.debito },
              { label: "Dinheiro em Espécie", valor: dadosReceitas.dinheiro },
              { label: "Assinaturas", valor: dadosReceitas.assinaturas, highlight: true },
            ].map((r, idx) => {
              const perc =
                dadosReceitas.receitaTotal > 0
                  ? (r.valor / dadosReceitas.receitaTotal) * 100
                  : 0;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-sm border ${
                    r.highlight
                      ? "bg-[#181520] border-purple-900/40"
                      : "bg-[#161616] border-[#222]"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs mb-1.5 font-rajdhani">
                    <span className={`font-semibold ${r.highlight ? "text-purple-300" : "text-gray-300"}`}>
                      (+) {r.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-bold">{formatarBRL(r.valor)}</span>
                      <span className="text-gray-500 text-[10px] w-12 text-right">
                        ({perc.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#202020] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${r.highlight ? "bg-purple-500" : "bg-emerald-500"}`}
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#222] flex justify-between items-center text-sm font-rajdhani font-bold">
            <span className="text-gray-300 uppercase">Total de Receitas:</span>
            <span className="text-emerald-400 font-mono text-base">
              {formatarBRL(dadosReceitas.receitaTotal)}
            </span>
          </div>
        </div>

        {/* SEÇÃO 2: DESPESAS */}
        <div className="bg-[#111] border border-[#222] rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E51E25]"></span>
              <h2 className="text-base font-rajdhani font-bold text-white uppercase tracking-wider">
                2. Despesas por Categoria (Ref: {mesFormatado})
              </h2>
            </div>
            <span className="font-mono text-red-400 font-bold text-sm">
              {formatarBRL(dadosDespesas.totalGeral)}
            </span>
          </div>

          {/* Breakdown de Status das Despesas */}
          <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#161616] border border-[#222] rounded-sm text-xs font-rajdhani">
            <div>
              <span className="text-gray-400 text-[10px] uppercase block">Pagas:</span>
              <span className="font-mono text-emerald-400 font-bold text-xs">
                {formatarBRL(dadosDespesas.totalPago)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] uppercase block">Pendentes:</span>
              <span className="font-mono text-amber-400 font-bold text-xs">
                {formatarBRL(dadosDespesas.totalPendente)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] uppercase block">Atrasadas:</span>
              <span className="font-mono text-[#E51E25] font-bold text-xs">
                {formatarBRL(dadosDespesas.totalAtrasado)}
              </span>
            </div>
          </div>

          {/* Lista de Despesas por Categoria */}
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {dadosDespesas.listaCategorias.map((d, idx) => {
              const perc =
                dadosDespesas.totalGeral > 0
                  ? (d.valor / dadosDespesas.totalGeral) * 100
                  : 0;
              return (
                <div key={idx} className="bg-[#161616] border border-[#222] p-2.5 rounded-sm">
                  <div className="flex justify-between items-center text-xs mb-1 font-rajdhani">
                    <span className="font-medium text-gray-300">(-) {d.categoria}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-red-400 font-semibold">{formatarBRL(d.valor)}</span>
                      <span className="text-gray-500 text-[10px] w-12 text-right">
                        ({perc.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#202020] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E51E25]"
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {dadosDespesas.listaCategorias.length === 0 && (
              <div className="py-8 text-center text-gray-500 font-rajdhani text-xs">
                Nenhuma despesa vinculada ao mês de referência {mesFormatado}.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#222] flex justify-between items-center text-sm font-rajdhani font-bold">
            <span className="text-gray-300 uppercase">Total de Despesas:</span>
            <span className="text-red-400 font-mono text-base">
              {formatarBRL(dadosDespesas.totalGeral)}
            </span>
          </div>
        </div>
      </div>

      {/* RESUMO EXECUTIVO DO DRE */}
      <div className="bg-gradient-to-r from-[#161616] via-[#121212] to-[#161616] border border-[#262626] rounded-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] font-mono text-[#E51E25] uppercase tracking-widest font-semibold mb-1">
              DEMONSTRAÇÃO CONSOLIDADA • {nomeUnidadeSelecionada.toUpperCase()}
            </div>
            <div className="text-xl font-rajdhani font-bold text-white uppercase tracking-wide">
              Resultado Líquido do Mês ({mesFormatado})
            </div>
            <p className="text-xs text-gray-400 font-rajdhani mt-0.5">
              Receita Total ({formatarBRL(dadosReceitas.receitaTotal)}) − Total de Despesas ({formatarBRL(dadosDespesas.totalGeral)})
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] font-rajdhani uppercase text-gray-400 block font-semibold">
                Margem do Exercício
              </span>
              <span
                className={`font-mono font-bold text-2xl ${
                  margemPercentual >= 0 ? "text-purple-400" : "text-[#E51E25]"
                }`}
              >
                {margemPercentual.toFixed(2)}%
              </span>
            </div>

            <div className="text-right pl-6 border-l border-[#262626]">
              <span className="text-[10px] font-rajdhani uppercase text-gray-400 block font-semibold">
                Resultado Final
              </span>
              <span
                className={`font-mono font-bold text-3xl ${
                  resultadoMes >= 0 ? "text-emerald-400" : "text-[#E51E25]"
                }`}
              >
                {formatarBRL(resultadoMes)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
