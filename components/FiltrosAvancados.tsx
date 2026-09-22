"use client";

import { useState } from "react";
import { Filter, Search, Download, FileSpreadsheet, FileText, Bookmark, X, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { exportarParaExcel, exportarParaPDF, exportarParaCSV, ItemRelatorioExport, MetadadosRelatorio } from "@/lib/exportUtils";

export interface EstadoFiltros {
  termoBusca: string;
  unidadeId: string;
  contaId: string;
  tipo: "TODOS" | "ENTRADA" | "SAIDA" | "TRANSFERENCIA";
  categoria: string;
  formaPagamento: string;
  status: "TODOS" | "CONFIRMADO" | "PENDENTE" | "CANCELADO";
  dataInicio: string;
  dataFim: string;
  periodoPredefinido: string;
  valorMin: string;
  valorMax: string;
  apenasComprovante: boolean;
  conciliado: "TODOS" | "SIM" | "NAO";
  agrupamento: "NENHUM" | "UNIDADE" | "CATEGORIA" | "MES" | "FORNECEDOR";
}

interface FiltrosAvancadosProps {
  unidades: { id: string; nome: string }[];
  contas: { id: string; nome: string; unidadeId: string }[];
  categoriasDisponiveis: string[];
  filtros: EstadoFiltros;
  onFiltrosChange: (novosFiltros: EstadoFiltros) => void;
  itensFiltrados: ItemRelatorioExport[];
  tituloRelatorio: string;
  filtrosSalvosIniciais?: { id: string; nome: string; parametrosJson: string }[];
  onSalvarFiltro?: (nome: string, filtrosJson: string) => Promise<void>;
}

export default function FiltrosAvancados({
  unidades,
  contas,
  categoriasDisponiveis,
  filtros,
  onFiltrosChange,
  itensFiltrados,
  tituloRelatorio,
  filtrosSalvosIniciais = [],
  onSalvarFiltro,
}: FiltrosAvancadosProps) {
  const [expandido, setExpandido] = useState(false);
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [nomeFiltroSalvar, setNomeFiltroSalvar] = useState("");
  const [filtrosSalvos, setFiltrosSalvos] = useState(filtrosSalvosIniciais);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Helper para identificar movimentações internas de liquidação/transferência
  const isTransfOuComp = (i: ItemRelatorioExport) =>
    i.tipo === "TRANSFERENCIA" ||
    i.categoria.includes("TRANSFERENCIA") ||
    i.categoria.includes("COMPENSACAO") ||
    i.categoria === "RECEBIMENTO_CARTAO" ||
    i.categoria === "COMPENSACAO_CARTAO_SAIDA";

  // Totais dos itens filtrados (apenas receitas e despesas operacionais reais)
  const totalReceitas = itensFiltrados
    .filter((i) => i.tipo === "ENTRADA" && i.status !== "CANCELADO" && !isTransfOuComp(i))
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalDespesas = itensFiltrados
    .filter((i) => i.tipo === "SAIDA" && i.status !== "CANCELADO" && !isTransfOuComp(i))
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalTransferencias = itensFiltrados
    .filter((i) => isTransfOuComp(i) && i.status !== "CANCELADO")
    .reduce((acc, curr) => acc + curr.valor, 0);

  const saldoLiquido = totalReceitas - totalDespesas;
  const quantidadeLancamentos = itensFiltrados.length;
  const mediaPorLancamento = quantidadeLancamentos > 0 ? (totalReceitas + totalDespesas) / quantidadeLancamentos : 0;

  // Gerar metadados para exportação
  const construirMetadados = (): MetadadosRelatorio => {
    const filtrosTexto: string[] = [];

    if (filtros.unidadeId !== "GLOBAL") {
      const u = unidades.find((x) => x.id === filtros.unidadeId);
      filtrosTexto.push(`Unidade: ${u?.nome || filtros.unidadeId}`);
    } else {
      filtrosTexto.push("Unidade: Consolidado (Todas)");
    }

    if (filtros.periodoPredefinido) {
      filtrosTexto.push(`Período: ${filtros.periodoPredefinido}`);
    }
    if (filtros.dataInicio || filtros.dataFim) {
      filtrosTexto.push(`Datas: ${filtros.dataInicio || "Início"} até ${filtros.dataFim || "Fim"}`);
    }
    if (filtros.tipo !== "TODOS") filtrosTexto.push(`Tipo: ${filtros.tipo}`);
    if (filtros.categoria) filtrosTexto.push(`Categoria: ${filtros.categoria}`);
    if (filtros.formaPagamento) filtrosTexto.push(`Forma: ${filtros.formaPagamento}`);
    if (filtros.status !== "TODOS") filtrosTexto.push(`Status: ${filtros.status}`);
    if (filtros.termoBusca) filtrosTexto.push(`Busca: "${filtros.termoBusca}"`);
    if (filtros.valorMin) filtrosTexto.push(`Mínimo: R$ ${filtros.valorMin}`);
    if (filtros.valorMax) filtrosTexto.push(`Máximo: R$ ${filtros.valorMax}`);

    return {
      titulo: tituloRelatorio,
      periodo: `${filtros.dataInicio || "Início"} a ${filtros.dataFim || "Hoje"} (${filtros.periodoPredefinido || "Personalizado"})`,
      unidadeSelecionada:
        filtros.unidadeId === "GLOBAL"
          ? "Consolidado - Todas as Unidades"
          : unidades.find((u) => u.id === filtros.unidadeId)?.nome || "Unidade",
      filtrosAplicadosTexto: filtrosTexto,
      totalReceitas,
      totalDespesas,
      saldoLiquido,
      quantidadeLancamentos,
      usuarioGerador: "Administrador Own Barber",
    };
  };

  const handleExportarExcel = () => {
    exportarParaExcel(itensFiltrados, construirMetadados(), "relatorio_own_barber");
    setMenuExportarAberto(false);
  };

  const handleExportarPDF = () => {
    exportarParaPDF(itensFiltrados, construirMetadados(), "relatorio_own_barber");
    setMenuExportarAberto(false);
  };

  const handleExportarCSV = () => {
    exportarParaCSV(itensFiltrados, construirMetadados(), "relatorio_own_barber");
    setMenuExportarAberto(false);
  };

  const limparFiltros = () => {
    onFiltrosChange({
      termoBusca: "",
      unidadeId: "GLOBAL",
      contaId: "",
      tipo: "TODOS",
      categoria: "",
      formaPagamento: "",
      status: "TODOS",
      dataInicio: "",
      dataFim: "",
      periodoPredefinido: "Este Mês",
      valorMin: "",
      valorMax: "",
      apenasComprovante: false,
      conciliado: "TODOS",
      agrupamento: "NENHUM",
    });
  };

  const aplicarFiltroPredefinidoData = (tipoPeriodo: string) => {
    const hoje = new Date();
    let dInicio = "";
    let dFim = hoje.toISOString().split("T")[0];

    if (tipoPeriodo === "Hoje") {
      dInicio = dFim;
    } else if (tipoPeriodo === "Esta Semana") {
      const primeiroDiaSemana = new Date(hoje);
      primeiroDiaSemana.setDate(hoje.getDate() - hoje.getDay());
      dInicio = primeiroDiaSemana.toISOString().split("T")[0];
    } else if (tipoPeriodo === "Este Mês") {
      dInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
    } else if (tipoPeriodo === "Mês Anterior") {
      dInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().split("T")[0];
      dFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().split("T")[0];
    } else if (tipoPeriodo === "Este Ano") {
      dInicio = new Date(hoje.getFullYear(), 0, 1).toISOString().split("T")[0];
    }

    onFiltrosChange({
      ...filtros,
      periodoPredefinido: tipoPeriodo,
      dataInicio: dInicio,
      dataFim: dFim,
    });
  };

  const salvarPesquisaAtual = async () => {
    if (!nomeFiltroSalvar.trim()) return;
    const json = JSON.stringify(filtros);
    if (onSalvarFiltro) {
      await onSalvarFiltro(nomeFiltroSalvar.trim(), json);
    }
    setFiltrosSalvos([...filtrosSalvos, { id: String(Date.now()), nome: nomeFiltroSalvar.trim(), parametrosJson: json }]);
    setNomeFiltroSalvar("");
    setModalSalvarAberto(false);
  };

  const aplicarFiltroSalvo = (parametrosJson: string) => {
    try {
      const parsed = JSON.parse(parametrosJson);
      onFiltrosChange({ ...filtros, ...parsed });
    } catch (e) {
      console.error("Erro ao aplicar filtro salvo:", e);
    }
  };

  // Contagem de filtros ativos
  const filtrosAtivosCount = [
    filtros.termoBusca ? 1 : 0,
    filtros.unidadeId !== "GLOBAL" ? 1 : 0,
    filtros.contaId ? 1 : 0,
    filtros.tipo !== "TODOS" ? 1 : 0,
    filtros.categoria ? 1 : 0,
    filtros.formaPagamento ? 1 : 0,
    filtros.status !== "TODOS" ? 1 : 0,
    filtros.valorMin || filtros.valorMax ? 1 : 0,
    filtros.conciliado !== "TODOS" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-[#111] border border-[#222] rounded-sm p-4 flex flex-col gap-4">
      {/* BARRA SUPERIOR: BUSCA RÁPIDA, BOTÕES DE PERÍODO E EXPORTAÇÃO */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        {/* Campo de Busca Rápida */}
        <div className="flex items-center gap-2 flex-1 max-w-lg bg-[#161616] border border-[#333] px-3 py-2 rounded-sm focus-within:border-[#E51E25]">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por descrição, fornecedor, palavra-chave..."
            className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-full font-medium"
            value={filtros.termoBusca}
            onChange={(e) => onFiltrosChange({ ...filtros, termoBusca: e.target.value })}
          />
          {filtros.termoBusca && (
            <button onClick={() => onFiltrosChange({ ...filtros, termoBusca: "" })} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Atalhos de Período */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["Hoje", "Esta Semana", "Este Mês", "Mês Anterior", "Este Ano"].map((p) => (
            <button
              key={p}
              onClick={() => aplicarFiltroPredefinidoData(p)}
              className={`px-2.5 py-1 text-xs font-rajdhani uppercase font-semibold rounded-sm transition-all cursor-pointer ${
                filtros.periodoPredefinido === p
                  ? "bg-[#E51E25] text-white"
                  : "bg-[#181818] text-gray-400 hover:text-white border border-[#2E2E2E]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Ações: Filtros Avançados & Exportar */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setExpandido(!expandido)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-sm border text-xs font-rajdhani uppercase font-bold tracking-wider transition-all cursor-pointer ${
              expandido || filtrosAtivosCount > 0
                ? "bg-[#1C1C1C] border-[#E51E25] text-white"
                : "bg-[#161616] border-[#333] text-gray-400 hover:text-white"
            }`}
          >
            <Filter size={14} className={filtrosAtivosCount > 0 ? "text-[#E51E25]" : ""} />
            <span>Filtros {filtrosAtivosCount > 0 ? `(${filtrosAtivosCount})` : ""}</span>
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Botão de Exportação */}
          <div className="relative">
            <button
              onClick={() => setMenuExportarAberto(!menuExportarAberto)}
              className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-sm transition-all shadow-[0_0_10px_rgba(229,30,37,0.25)] cursor-pointer"
            >
              <Download size={14} /> Exportar Relatório <ChevronDown size={12} />
            </button>

            {menuExportarAberto && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#161616] border border-[#333] rounded-sm shadow-2xl py-1 z-50 animate-in fade-in">
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#E51E25] tracking-widest uppercase border-b border-[#262626]">
                  FORMATO DE ARQUIVO
                </div>
                <button
                  onClick={handleExportarExcel}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-rajdhani text-gray-200 hover:bg-[#222] hover:text-white transition-colors"
                >
                  <FileSpreadsheet size={15} className="text-emerald-500" /> Planilha Excel (.XLSX)
                </button>
                <button
                  onClick={handleExportarPDF}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-rajdhani text-gray-200 hover:bg-[#222] hover:text-white transition-colors"
                >
                  <FileText size={15} className="text-red-500" /> Documento PDF (.PDF)
                </button>
                <button
                  onClick={handleExportarCSV}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-rajdhani text-gray-200 hover:bg-[#222] hover:text-white transition-colors border-t border-[#262626]"
                >
                  <FileSpreadsheet size={15} className="text-blue-500" /> Arquivo Texto (.CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL EXPANSÍVEL DE FILTROS AVANÇADOS */}
      {expandido && (
        <div className="p-4 bg-[#141414] border border-[#262626] rounded-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-in fade-in">
          {/* 1. Unidade */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Unidade</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.unidadeId}
              onChange={(e) => onFiltrosChange({ ...filtros, unidadeId: e.target.value })}
            >
              <option value="GLOBAL">🌐 Todas as Unidades (Rede)</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Conta Financeira */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Conta Financeira</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.contaId}
              onChange={(e) => onFiltrosChange({ ...filtros, contaId: e.target.value })}
            >
              <option value="">Todas as Contas</option>
              {contas
                .filter((c) => filtros.unidadeId === "GLOBAL" || c.unidadeId === filtros.unidadeId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>

          {/* 3. Tipo de Movimentação */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Tipo</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.tipo}
              onChange={(e) => onFiltrosChange({ ...filtros, tipo: e.target.value as EstadoFiltros["tipo"] })}
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="ENTRADA">🟢 Receitas / Entradas</option>
              <option value="SAIDA">🔴 Despesas / Saídas</option>
              <option value="TRANSFERENCIA">🔄 Transferências Internas</option>
            </select>
          </div>

          {/* 4. Categoria */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Categoria</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.categoria}
              onChange={(e) => onFiltrosChange({ ...filtros, categoria: e.target.value })}
            >
              <option value="">Todas as Categorias</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Forma de Pagamento */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Forma de Pagamento</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.formaPagamento}
              onChange={(e) => onFiltrosChange({ ...filtros, formaPagamento: e.target.value })}
            >
              <option value="">Todas as Formas</option>
              <option value="DINHEIRO">Dinheiro em Espécie</option>
              <option value="PIX">PIX</option>
              <option value="DEBITO">Cartão de Débito</option>
              <option value="CREDITO">Cartão de Crédito</option>
              <option value="BOLETO">Boleto</option>
              <option value="TRANSFERENCIA">Transferência</option>
            </select>
          </div>

          {/* 6. Status */}
          <div>
            <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Status</label>
            <select
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
              value={filtros.status}
              onChange={(e) => onFiltrosChange({ ...filtros, status: e.target.value as EstadoFiltros["status"] })}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="CONFIRMADO">Confirmado / Pago</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* 7. Intervalo de Datas */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Data Início</label>
              <input
                type="date"
                className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
                value={filtros.dataInicio}
                onChange={(e) => onFiltrosChange({ ...filtros, dataInicio: e.target.value, periodoPredefinido: "" })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Data Fim</label>
              <input
                type="date"
                className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs focus:outline-none focus:border-[#E51E25]"
                value={filtros.dataFim}
                onChange={(e) => onFiltrosChange({ ...filtros, dataFim: e.target.value, periodoPredefinido: "" })}
              />
            </div>
          </div>

          {/* 8. Faixa de Valores */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Valor Mín (R$)</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs font-mono focus:outline-none focus:border-[#E51E25]"
                value={filtros.valorMin}
                onChange={(e) => onFiltrosChange({ ...filtros, valorMin: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Valor Máx (R$)</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs font-mono focus:outline-none focus:border-[#E51E25]"
                value={filtros.valorMax}
                onChange={(e) => onFiltrosChange({ ...filtros, valorMax: e.target.value })}
              />
            </div>
          </div>

          {/* Rodapé do painel com filtros salvos e limpar */}
          <div className="col-span-full pt-3 border-t border-[#262626] flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              {filtrosSalvos.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Bookmark size={13} className="text-[#E51E25]" />
                  <span>Filtros Salvos:</span>
                  {filtrosSalvos.map((fs) => (
                    <button
                      key={fs.id}
                      onClick={() => aplicarFiltroSalvo(fs.parametrosJson)}
                      className="bg-[#202020] hover:bg-[#282828] text-gray-300 hover:text-white px-2 py-0.5 rounded text-[11px] border border-[#333] transition-colors cursor-pointer"
                    >
                      {fs.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalSalvarAberto(true)}
                className="text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-sm bg-[#1C1C1C] border border-[#333] hover:border-[#555] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Bookmark size={13} /> Salvar Pesquisa Atual
              </button>

              <button
                onClick={limparFiltros}
                className="text-xs font-rajdhani uppercase font-semibold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-sm bg-red-950/20 border border-red-900/40 hover:bg-red-900/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} /> Limpar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE RESULTADOS / TOTAIS DA PESQUISA FILTRADA */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-[#1C1C1C]">
        <div className="bg-[#141414] p-3 rounded-sm border-l-2 border-emerald-500">
          <div className="text-[10px] font-rajdhani text-gray-400 uppercase tracking-widest">Receitas Operacionais</div>
          <div className="text-lg font-rajdhani font-bold text-emerald-400">{formatarMoeda(totalReceitas)}</div>
        </div>

        <div className="bg-[#141414] p-3 rounded-sm border-l-2 border-red-500">
          <div className="text-[10px] font-rajdhani text-gray-400 uppercase tracking-widest">Despesas Operacionais</div>
          <div className="text-lg font-rajdhani font-bold text-red-400">{formatarMoeda(totalDespesas)}</div>
        </div>

        <div className="bg-[#141414] p-3 rounded-sm border-l-2 border-indigo-500">
          <div className="text-[10px] font-rajdhani text-indigo-400 uppercase tracking-widest font-semibold">
            Compensações / Transf.
          </div>
          <div className="text-lg font-rajdhani font-bold text-indigo-300">
            {formatarMoeda(totalTransferencias)}
          </div>
          <div className="text-[9px] font-mono text-gray-500">Saldo neutro entre contas</div>
        </div>

        <div className="bg-[#141414] p-3 rounded-sm border-l-2 border-[#E51E25]">
          <div className="text-[10px] font-rajdhani text-[#E51E25] uppercase tracking-widest font-bold">Saldo Operacional</div>
          <div className={`text-lg font-rajdhani font-bold ${saldoLiquido >= 0 ? "text-white" : "text-red-400"}`}>
            {formatarMoeda(saldoLiquido)}
          </div>
        </div>

        <div className="bg-[#141414] p-3 rounded-sm border-l-2 border-blue-500 col-span-2 md:col-span-1">
          <div className="text-[10px] font-rajdhani text-gray-400 uppercase tracking-widest">Lançamentos</div>
          <div className="text-lg font-rajdhani font-bold text-white">{quantidadeLancamentos} reg.</div>
        </div>
      </div>

      {/* MODAL PARA SALVAR PESQUISA */}
      {modalSalvarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-[#333] w-full max-w-md rounded-sm p-5 relative shadow-2xl">
            <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider mb-3">
              Salvar Pesquisa / Filtro
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Dê um nome para este conjunto de filtros para utilizá-lo rapidamente no futuro.
            </p>
            <input
              type="text"
              placeholder="Ex: Despesas com energia, Lavagem de toalhas..."
              className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2.5 rounded-sm text-sm focus:outline-none focus:border-[#E51E25] mb-4"
              value={nomeFiltroSalvar}
              onChange={(e) => setNomeFiltroSalvar(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalSalvarAberto(false)}
                className="px-3 py-1.5 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPesquisaAtual}
                className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold uppercase text-xs px-4 py-2 rounded-sm"
              >
                Salvar Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
