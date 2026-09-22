"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus,
  DollarSign,
  Calendar,
  FileDown,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Building2,
  CreditCard,
  QrCode,
  Coins,
  CheckCircle2,
} from "lucide-react";
import { salvarFaturamento, excluirFaturamento } from "./actions";
import {
  gerarPdfFaturamento,
  formatarBRL,
  formatarDataBR,
  ItemFaturamentoPdf,
  TotaisFaturamentoPdf,
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
  observacoes: string | null;
}

export default function FaturamentoClient({
  fechamentos,
  unidades,
  unidadeInicialId,
}: {
  fechamentos: FechamentoItem[];
  unidades: UnidadeItem[];
  unidadeInicialId: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Filtros
  const [filtroUnidade, setFiltroUnidade] = useState(unidadeInicialId || "GLOBAL");
  const [filtroMesAno, setFiltroMesAno] = useState(""); // "YYYY-MM" ou ""
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Formulário
  const hojeStr = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    data: hojeStr,
    unidadeId: unidades[0]?.id || "",
    valorPix: "",
    valorCredito: "",
    valorDebito: "",
    valorDinheiro: "",
    valorAssinaturas: "",
    observacoes: "",
  });

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const parseNum = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Cálculo ao vivo do Faturamento Total
  const totalAoVivo = useMemo(() => {
    const pix = parseNum(formData.valorPix);
    const credito = parseNum(formData.valorCredito);
    const debito = parseNum(formData.valorDebito);
    const dinheiro = parseNum(formData.valorDinheiro);
    const assinatura = parseNum(formData.valorAssinaturas);
    return pix + credito + debito + dinheiro + assinatura;
  }, [
    formData.valorPix,
    formData.valorCredito,
    formData.valorDebito,
    formData.valorDinheiro,
    formData.valorAssinaturas,
  ]);

  const abrirModalNovo = () => {
    setEditandoId(null);
    setFormError("");
    setFormData({
      data: hojeStr,
      unidadeId:
        filtroUnidade !== "GLOBAL" && unidades.some((u) => u.id === filtroUnidade)
          ? filtroUnidade
          : unidades[0]?.id || "",
      valorPix: "",
      valorCredito: "",
      valorDebito: "",
      valorDinheiro: "",
      valorAssinaturas: "",
      observacoes: "",
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (item: FechamentoItem) => {
    setEditandoId(item.id);
    setFormError("");
    const dataISO = new Date(item.data).toISOString().split("T")[0];
    setFormData({
      data: dataISO,
      unidadeId: item.unidadeId,
      valorPix: item.valorPix > 0 ? item.valorPix.toFixed(2).replace(".", ",") : "",
      valorCredito: item.valorCredito > 0 ? item.valorCredito.toFixed(2).replace(".", ",") : "",
      valorDebito: item.valorDebito > 0 ? item.valorDebito.toFixed(2).replace(".", ",") : "",
      valorDinheiro: item.valorDinheiro > 0 ? item.valorDinheiro.toFixed(2).replace(".", ",") : "",
      valorAssinaturas:
        item.valorAssinaturas > 0 ? item.valorAssinaturas.toFixed(2).replace(".", ",") : "",
      observacoes: item.observacoes || "",
    });
    setModalAberto(true);
  };

  const handleSalvar = () => {
    setFormError("");

    if (!formData.data) {
      setFormError("Informe a data do fechamento.");
      return;
    }

    if (!formData.unidadeId) {
      setFormError("Selecione a unidade.");
      return;
    }

    const pix = parseNum(formData.valorPix);
    const credito = parseNum(formData.valorCredito);
    const debito = parseNum(formData.valorDebito);
    const dinheiro = parseNum(formData.valorDinheiro);
    const assinatura = parseNum(formData.valorAssinaturas);
    const total = pix + credito + debito + dinheiro + assinatura;

    if (total <= 0) {
      setFormError("Informe ao menos um valor de faturamento maior que zero.");
      return;
    }

    startTransition(async () => {
      const res = await salvarFaturamento({
        id: editandoId || undefined,
        data: formData.data,
        unidadeId: formData.unidadeId,
        valorPix: pix,
        valorCredito: credito,
        valorDebito: debito,
        valorDinheiro: dinheiro,
        valorAssinaturas: assinatura,
        observacoes: formData.observacoes,
      });

      if (res.success) {
        setModalAberto(false);
      } else {
        setFormError(res.error || "Erro ao salvar faturamento.");
      }
    });
  };

  const handleExcluir = (id: string, dataItem: string | Date, unidadeNome: string) => {
    if (confirm(`Deseja realmente remover o faturamento do dia ${formatarDataBR(dataItem)} da ${unidadeNome}?`)) {
      startTransition(async () => {
        await excluirFaturamento(id);
      });
    }
  };

  // Filtragem
  const filtrados = useMemo(() => {
    return fechamentos.filter((f) => {
      // Unidade
      if (filtroUnidade !== "GLOBAL" && f.unidadeId !== filtroUnidade) {
        return false;
      }

      const dStr = new Date(f.data).toISOString().split("T")[0];

      // Mês/Ano
      if (filtroMesAno && !dStr.startsWith(filtroMesAno)) {
        return false;
      }

      // Período
      if (filtroDataInicio && dStr < filtroDataInicio) {
        return false;
      }
      if (filtroDataFim && dStr > filtroDataFim) {
        return false;
      }

      return true;
    });
  }, [fechamentos, filtroUnidade, filtroMesAno, filtroDataInicio, filtroDataFim]);

  // Totais do período filtrado
  const totaisFiltrados: TotaisFaturamentoPdf = useMemo(() => {
    return filtrados.reduce(
      (acc, f) => ({
        totalPix: acc.totalPix + f.valorPix,
        totalCredito: acc.totalCredito + f.valorCredito,
        totalDebito: acc.totalDebito + f.valorDebito,
        totalDinheiro: acc.totalDinheiro + f.valorDinheiro,
        totalAssinatura: acc.totalAssinatura + f.valorAssinaturas,
        faturamentoTotal: acc.faturamentoTotal + f.faturamentoBruto,
      }),
      {
        totalPix: 0,
        totalCredito: 0,
        totalDebito: 0,
        totalDinheiro: 0,
        totalAssinatura: 0,
        faturamentoTotal: 0,
      }
    );
  }, [filtrados]);

  // Exportar PDF
  const handleBaixarPdf = () => {
    const nomeUnidade =
      filtroUnidade === "GLOBAL"
        ? "Consolidado Own Barber Club"
        : unidades.find((u) => u.id === filtroUnidade)?.nome || "Unidade";

    let periodoTexto = "Todos os Registros";
    if (filtroMesAno) {
      const [ano, mes] = filtroMesAno.split("-");
      periodoTexto = `${mes}/${ano}`;
    } else if (filtroDataInicio || filtroDataFim) {
      periodoTexto = `${formatarDataBR(filtroDataInicio || "Início")} até ${formatarDataBR(filtroDataFim || "Hoje")}`;
    }

    const itensPdf: ItemFaturamentoPdf[] = filtrados.map((f) => ({
      data: f.data,
      unidade: f.unidade.nome,
      pix: f.valorPix,
      credito: f.valorCredito,
      debito: f.valorDebito,
      dinheiro: f.valorDinheiro,
      assinatura: f.valorAssinaturas,
      total: f.faturamentoBruto,
    }));

    gerarPdfFaturamento({
      periodo: periodoTexto,
      unidade: nomeUnidade,
      itens: itensPdf,
      totais: totaisFiltrados,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* BARRA SUPERIOR DE AÇÃO E FILTROS */}
      <div className="bg-[#111] border border-[#222] p-4 rounded-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Seletor de Unidade */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Filtro Mês/Ano */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Mês:</span>
            <input
              type="month"
              value={filtroMesAno}
              onChange={(e) => {
                setFiltroMesAno(e.target.value);
                setFiltroDataInicio("");
                setFiltroDataFim("");
              }}
              className="bg-[#181818] border border-[#333] text-white text-xs font-mono px-3 py-1.5 rounded-sm focus:outline-none focus:border-[#E51E25]"
            />
            {filtroMesAno && (
              <button
                onClick={() => setFiltroMesAno("")}
                title="Limpar filtro de mês"
                className="text-gray-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBaixarPdf}
            className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] text-gray-200 text-xs font-rajdhani font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-all cursor-pointer"
          >
            <FileDown size={15} className="text-[#E51E25]" /> Baixar PDF
          </button>

          <button
            onClick={abrirModalNovo}
            className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-sm transition-all shadow-[0_0_12px_rgba(229,30,37,0.3)] cursor-pointer"
          >
            <Plus size={16} /> Adicionar Faturamento
          </button>
        </div>
      </div>

      {/* CARDS COM TOTAIS DO PERÍODO FILTRADO */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#111] border-l-2 border-teal-500 p-3.5 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total PIX
            <QrCode size={13} className="text-teal-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisFiltrados.totalPix)}
          </div>
        </div>

        <div className="bg-[#111] border-l-2 border-indigo-500 p-3.5 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Crédito
            <CreditCard size={13} className="text-indigo-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisFiltrados.totalCredito)}
          </div>
        </div>

        <div className="bg-[#111] border-l-2 border-sky-500 p-3.5 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Débito
            <CreditCard size={13} className="text-sky-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisFiltrados.totalDebito)}
          </div>
        </div>

        <div className="bg-[#111] border-l-2 border-amber-500 p-3.5 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Dinheiro
            <Coins size={13} className="text-amber-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisFiltrados.totalDinheiro)}
          </div>
        </div>

        <div className="bg-[#111] border-l-2 border-purple-500 p-3.5 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Assinatura
            <CheckCircle2 size={13} className="text-purple-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisFiltrados.totalAssinatura)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#111] border-l-4 border-[#E51E25] p-3.5 rounded-sm shadow-[0_0_12px_rgba(229,30,37,0.15)] col-span-2 md:col-span-1">
          <div className="text-[10px] font-rajdhani uppercase text-[#E51E25] font-bold flex items-center justify-between mb-1">
            Faturamento Total
            <DollarSign size={13} className="text-[#E51E25]" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-emerald-400">
            {formatarBRL(totaisFiltrados.faturamentoTotal)}
          </div>
        </div>
      </div>

      {/* TABELA DE HISTÓRICO DE FATURAMENTO */}
      <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#161616] border-b border-[#222]">
              <tr>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Data
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Unidade
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  PIX
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Crédito
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Débito
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Dinheiro
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Assinatura
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Faturamento Total
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-center">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {filtrados.map((f) => (
                <tr key={f.id} className="hover:bg-[#151515] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-sm text-white font-semibold">
                    {formatarDataBR(f.data)}
                  </td>
                  <td className="px-5 py-3.5 font-rajdhani text-gray-300 font-medium text-xs">
                    {f.unidade.nome.replace("Own Barber Club ", "")}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-gray-300">
                    {formatarBRL(f.valorPix)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-gray-300">
                    {formatarBRL(f.valorCredito)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-gray-300">
                    {formatarBRL(f.valorDebito)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-gray-300">
                    {formatarBRL(f.valorDinheiro)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-purple-300 font-semibold">
                    {formatarBRL(f.valorAssinaturas)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-rajdhani font-bold text-base text-emerald-400">
                    {formatarBRL(f.faturamentoBruto)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirModalEditar(f)}
                        title="Editar faturamento"
                        className="p-1.5 text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] rounded-sm transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleExcluir(f.id, f.data, f.unidade.nome)}
                        title="Remover faturamento"
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                    Nenhum registro de faturamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADICIONAR / EDITAR FATURAMENTO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl">
            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-5">
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
                FECHAMENTO OPERACIONAL
              </div>
              <h2 className="text-2xl font-rajdhani font-bold text-white uppercase tracking-wide">
                {editandoId ? "Editar Faturamento" : "Adicionar Faturamento"}
              </h2>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-sm border bg-red-950/40 border-red-500/50 text-red-400 text-xs font-rajdhani flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* Data e Unidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Data do Fechamento
                  </label>
                  <input
                    type="date"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Unidade
                  </label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm cursor-pointer"
                    value={formData.unidadeId}
                    onChange={(e) => setFormData({ ...formData, unidadeId: e.target.value })}
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CAMPOS DE FORMA DE RECEBIMENTO */}
              <div className="p-3.5 bg-[#161616] border border-[#262626] rounded-sm space-y-3">
                <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
                  VALORES POR FORMA DE RECEBIMENTO (R$)
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-300 uppercase block mb-1">
                      PIX (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="0,00"
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-[#E51E25]"
                      value={formData.valorPix}
                      onChange={(e) => setFormData({ ...formData, valorPix: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-300 uppercase block mb-1">
                      Cartão de Crédito (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="0,00"
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-[#E51E25]"
                      value={formData.valorCredito}
                      onChange={(e) => setFormData({ ...formData, valorCredito: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-300 uppercase block mb-1">
                      Cartão de Débito (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="0,00"
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-[#E51E25]"
                      value={formData.valorDebito}
                      onChange={(e) => setFormData({ ...formData, valorDebito: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-300 uppercase block mb-1">
                      Dinheiro em Espécie (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="0,00"
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-[#E51E25]"
                      value={formData.valorDinheiro}
                      onChange={(e) => setFormData({ ...formData, valorDinheiro: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-rajdhani text-purple-300 uppercase block mb-1 font-semibold flex items-center justify-between">
                      <span>Assinatura (R$)</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        Lançamento manual mensal da unidade
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="0,00"
                      className="w-full bg-[#1C1C1C] border border-purple-900/50 text-purple-200 p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-purple-500"
                      value={formData.valorAssinaturas}
                      onChange={(e) => setFormData({ ...formData, valorAssinaturas: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* CARD DE SOMA AUTOMÁTICA EM TEMPO REAL */}
              <div className="p-3.5 bg-gradient-to-r from-[#181818] to-[#121212] border-l-4 border-[#E51E25] rounded-sm flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                    Cálculo Automático
                  </div>
                  <div className="text-xs font-rajdhani uppercase font-bold text-gray-200">
                    Faturamento Total
                  </div>
                </div>
                <div className="text-3xl font-rajdhani font-bold text-emerald-400 tracking-tight">
                  {formatarBRL(totalAoVivo)}
                </div>
              </div>

              {/* Observação Opcional */}
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Detalhes ou anotações sobre o fechamento..."
                  className="w-full bg-[#1A1A1A] border border-[#333] text-gray-300 p-2.5 rounded-sm text-sm focus:outline-none focus:border-[#E51E25]"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 disabled:opacity-60 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(229,30,37,0.3)]"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> SALVANDO...
                    </>
                  ) : (
                    <>CONFIRMAR FECHAMENTO</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
