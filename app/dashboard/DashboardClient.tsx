"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  ArrowRight,
  Receipt,
  FileText,
  BarChart3,
} from "lucide-react";
import { formatarBRL } from "@/lib/pdfRelatorios";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface FechamentoItem {
  id: string;
  data: Date | string;
  unidadeId: string;
  faturamentoBruto: number;
}

interface ContaItem {
  id: string;
  valor: number;
  dataVencimento: Date | string;
  dataPagamento: Date | string | null;
  mesReferencia: string;
  unidadeId: string;
}

export default function DashboardClient({
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
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const [filtroUnidade, setFiltroUnidade] = useState(unidadeInicialId || "GLOBAL");
  const [filtroMes, setFiltroMes] = useState(mesAtualStr);

  const hojeTimestamp = new Date();
  hojeTimestamp.setHours(0, 0, 0, 0);

  // Helper para calcular métricas de uma unidade (ou global) no mês filtrado
  const calcularMetricas = (targetUnidadeId: string) => {
    // 1. Faturamento do mês
    const fechamentosFiltrados = fechamentos.filter((f) => {
      if (targetUnidadeId !== "GLOBAL" && f.unidadeId !== targetUnidadeId) {
        return false;
      }
      const dStr = new Date(f.data).toISOString().split("T")[0];
      return dStr.startsWith(filtroMes);
    });

    const faturamentoMes = fechamentosFiltrados.reduce(
      (acc, f) => acc + f.faturamentoBruto,
      0
    );

    // 2. Contas do mês (pelo Mês de Referência)
    const contasFiltradas = contas.filter((c) => {
      if (targetUnidadeId !== "GLOBAL" && c.unidadeId !== targetUnidadeId) {
        return false;
      }
      const ref = c.mesReferencia || new Date(c.dataVencimento).toISOString().slice(0, 7);
      return ref === filtroMes;
    });

    let totalPago = 0;
    let totalPendente = 0;
    let totalAtrasado = 0;
    let totalDespesas = 0;

    contasFiltradas.forEach((c) => {
      totalDespesas += c.valor;

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

    // 3. Resultado = Faturamento - Despesas
    const resultadoMes = faturamentoMes - totalDespesas;

    return {
      faturamentoMes,
      contasPagas: totalPago,
      contasPendentes: totalPendente,
      contasAtrasadas: totalAtrasado,
      totalDespesas,
      resultadoMes,
      quantidadeFechamentos: fechamentosFiltrados.length,
      quantidadeContas: contasFiltradas.length,
    };
  };

  // Métricas da visualização ativa (Unidade selecionada ou Consolidado)
  const metricasAtivas = useMemo(() => {
    return calcularMetricas(filtroUnidade);
  }, [filtroUnidade, filtroMes, fechamentos, contas]);

  // Comparação entre as 3 unidades oficiais (Centro, Avenida, Efapi)
  const comparacaoUnidades = useMemo(() => {
    return unidades.map((u) => ({
      unidade: u,
      metricas: calcularMetricas(u.id),
    }));
  }, [unidades, filtroMes, fechamentos, contas]);

  const nomeUnidadeAtiva =
    filtroUnidade === "GLOBAL"
      ? "Consolidado Own Barber Club"
      : unidades.find((u) => u.id === filtroUnidade)?.nome || "Unidade";

  const [anoFiltro, mesFiltro] = filtroMes.split("-");
  const mesFormatado = `${mesFiltro}/${anoFiltro}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. BARRA SUPERIOR DE FILTROS E ATALHOS */}
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
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Mês:</span>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white text-xs font-mono px-3 py-1.5 rounded-sm focus:outline-none focus:border-[#E51E25]"
            />
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center gap-2">
          <Link
            href="/faturamento"
            className="flex items-center gap-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] text-gray-200 text-xs font-rajdhani uppercase font-semibold px-3 py-2 rounded-sm transition-colors"
          >
            <Receipt size={14} className="text-[#E51E25]" /> Faturamento
          </Link>
          <Link
            href="/contas"
            className="flex items-center gap-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] text-gray-200 text-xs font-rajdhani uppercase font-semibold px-3 py-2 rounded-sm transition-colors"
          >
            <FileText size={14} className="text-[#E51E25]" /> Contas
          </Link>
          <Link
            href="/relatorios/dre"
            className="flex items-center gap-1.5 bg-[#E51E25] hover:bg-red-700 text-white text-xs font-rajdhani uppercase font-bold px-3.5 py-2 rounded-sm transition-colors shadow-[0_0_10px_rgba(229,30,37,0.3)]"
          >
            <BarChart3 size={14} /> Relatório DRE
          </Link>
        </div>
      </div>

      {/* 2. OS 6 INDICADORES ESSENCIAIS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E51E25]"></span>
            <h2 className="text-xs font-rajdhani font-bold text-gray-300 uppercase tracking-widest">
              Indicadores do Mês • {nomeUnidadeAtiva} ({mesFormatado})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            Fórmula: Resultado = Faturamento Total − Despesas do Mês
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Faturamento do Mês */}
          <div className="bg-[#111] border-l-4 border-emerald-500 p-4 rounded-sm">
            <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
              Faturamento do Mês
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-rajdhani font-bold text-emerald-400">
              {formatarBRL(metricasAtivas.faturamentoMes)}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1">
              Total recebido
            </div>
          </div>

          {/* 2. Contas Pagas */}
          <div className="bg-[#111] border-l-4 border-teal-500 p-4 rounded-sm">
            <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
              Contas Pagas
              <CheckCircle2 size={14} className="text-teal-400" />
            </div>
            <div className="text-2xl font-rajdhani font-bold text-teal-300">
              {formatarBRL(metricasAtivas.contasPagas)}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1">
              Já liquidadas
            </div>
          </div>

          {/* 3. Contas Pendentes */}
          <div className="bg-[#111] border-l-4 border-amber-500 p-4 rounded-sm">
            <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
              Contas Pendentes
              <Clock size={14} className="text-amber-400" />
            </div>
            <div className="text-2xl font-rajdhani font-bold text-amber-400">
              {formatarBRL(metricasAtivas.contasPendentes)}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1">
              A vencer
            </div>
          </div>

          {/* 4. Contas Atrasadas */}
          <div className="bg-[#111] border-l-4 border-[#E51E25] p-4 rounded-sm shadow-[0_0_10px_rgba(229,30,37,0.1)]">
            <div className="text-[10px] font-rajdhani uppercase text-[#E51E25] font-bold flex items-center justify-between mb-1">
              Contas Atrasadas
              <AlertTriangle size={14} className="text-[#E51E25]" />
            </div>
            <div className="text-2xl font-rajdhani font-bold text-[#E51E25]">
              {formatarBRL(metricasAtivas.contasAtrasadas)}
            </div>
            <div className="text-[10px] text-red-400/80 font-mono mt-1">
              Vencidas
            </div>
          </div>

          {/* 5. Total de Despesas do Mês */}
          <div className="bg-[#111] border-l-4 border-red-500 p-4 rounded-sm">
            <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
              Total de Despesas
              <DollarSign size={14} className="text-red-400" />
            </div>
            <div className="text-2xl font-rajdhani font-bold text-red-400">
              {formatarBRL(metricasAtivas.totalDespesas)}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1">
              Pagas + Pend. + Atras.
            </div>
          </div>

          {/* 6. Resultado do Mês */}
          <div className="bg-gradient-to-br from-[#1C1C1C] to-[#111] border-l-4 border-[#E51E25] p-4 rounded-sm shadow-[0_0_12px_rgba(229,30,37,0.2)]">
            <div className="text-[10px] font-rajdhani uppercase text-[#E51E25] font-bold flex items-center justify-between mb-1">
              Resultado do Mês
              <DollarSign size={14} className="text-[#E51E25]" />
            </div>
            <div
              className={`text-2xl font-rajdhani font-bold ${
                metricasAtivas.resultadoMes >= 0 ? "text-emerald-400" : "text-[#E51E25]"
              }`}
            >
              {formatarBRL(metricasAtivas.resultadoMes)}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-1">
              Fat. Total − Despesas
            </div>
          </div>
        </div>
      </div>

      {/* 3. COMPARAÇÃO SIMPLES ENTRE AS TRÊS UNIDADES */}
      <div className="bg-[#111] border border-[#222] rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#222] pb-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#E51E25]" />
            <h2 className="text-sm font-rajdhani font-bold text-white uppercase tracking-wider">
              Comparação Simples entre as Três Unidades • Mês {mesFormatado}
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            Centro • Avenida • Efapi
          </span>
        </div>

        {/* Cards comparativos lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparacaoUnidades.map(({ unidade, metricas }) => (
            <div
              key={unidade.id}
              className={`bg-[#161616] border ${
                filtroUnidade === unidade.id ? "border-[#E51E25]" : "border-[#262626]"
              } p-4 rounded-sm flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1F1F1F] text-gray-300">
                    Unidade Operacional
                  </span>
                  {metricas.contasAtrasadas > 0 && (
                    <span className="text-[10px] font-mono text-[#E51E25] flex items-center gap-1 font-bold">
                      <AlertTriangle size={11} /> {formatarBRL(metricas.contasAtrasadas)} atrasado
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wide mb-3">
                  {unidade.nome}
                </h3>

                <div className="space-y-2 text-xs font-rajdhani">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 uppercase">Faturamento:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatarBRL(metricas.faturamentoMes)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 uppercase">Despesas do Mês:</span>
                    <span className="font-mono text-red-400 font-bold">
                      {formatarBRL(metricas.totalDespesas)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[#222]">
                    <span className="text-gray-300 uppercase font-bold">Resultado do Mês:</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        metricas.resultadoMes >= 0 ? "text-emerald-400" : "text-[#E51E25]"
                      }`}
                    >
                      {formatarBRL(metricas.resultadoMes)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between text-[11px] font-mono text-gray-500">
                <span>Pagas: {formatarBRL(metricas.contasPagas)}</span>
                <span>Pendentes: {formatarBRL(metricas.contasPendentes)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela de Comparação */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#181818] text-gray-400 font-rajdhani uppercase tracking-wider border-b border-[#222]">
              <tr>
                <th className="py-2.5 px-3">Unidade</th>
                <th className="py-2.5 px-3 text-right">Faturamento</th>
                <th className="py-2.5 px-3 text-right">Contas Pagas</th>
                <th className="py-2.5 px-3 text-right">Contas Pendentes</th>
                <th className="py-2.5 px-3 text-right">Contas Atrasadas</th>
                <th className="py-2.5 px-3 text-right">Total Despesas</th>
                <th className="py-2.5 px-3 text-right">Resultado do Mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {comparacaoUnidades.map(({ unidade, metricas }) => (
                <tr key={unidade.id} className="hover:bg-[#181818] transition-colors">
                  <td className="py-2.5 px-3 font-rajdhani font-bold text-white text-xs">
                    {unidade.nome}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                    {formatarBRL(metricas.faturamentoMes)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-teal-300">
                    {formatarBRL(metricas.contasPagas)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                    {formatarBRL(metricas.contasPendentes)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#E51E25] font-semibold">
                    {formatarBRL(metricas.contasAtrasadas)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-400 font-semibold">
                    {formatarBRL(metricas.totalDespesas)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-sm">
                    <span className={metricas.resultadoMes >= 0 ? "text-emerald-400" : "text-[#E51E25]"}>
                      {formatarBRL(metricas.resultadoMes)}
                    </span>
                  </td>
                </tr>
              ))}

              {/* Linha Consolidada Oficial */}
              <tr className="bg-[#181818] font-bold border-t-2 border-[#333]">
                <td className="py-3 px-3 font-rajdhani text-white text-xs uppercase">
                  🏛️ Consolidado Own Barber Club
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-400">
                  {formatarBRL(
                    comparacaoUnidades.reduce((acc, c) => acc + c.metricas.faturamentoMes, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-teal-300">
                  {formatarBRL(
                    comparacaoUnidades.reduce((acc, c) => acc + c.metricas.contasPagas, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-400">
                  {formatarBRL(
                    comparacaoUnidades.reduce((acc, c) => acc + c.metricas.contasPendentes, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#E51E25]">
                  {formatarBRL(
                    comparacaoUnidades.reduce((acc, c) => acc + c.metricas.contasAtrasadas, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-400">
                  {formatarBRL(
                    comparacaoUnidades.reduce((acc, c) => acc + c.metricas.totalDespesas, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-sm font-bold">
                  {(() => {
                    const totalFat = comparacaoUnidades.reduce(
                      (acc, c) => acc + c.metricas.faturamentoMes,
                      0
                    );
                    const totalDesp = comparacaoUnidades.reduce(
                      (acc, c) => acc + c.metricas.totalDespesas,
                      0
                    );
                    const resFinal = totalFat - totalDesp;
                    return (
                      <span className={resFinal >= 0 ? "text-emerald-400" : "text-[#E51E25]"}>
                        {formatarBRL(resFinal)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
