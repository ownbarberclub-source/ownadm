"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileDown,
  Edit2,
  Trash2,
  X,
  Loader2,
  Tag,
  DollarSign,
  Calendar,
  Layers,
  Search,
} from "lucide-react";
import {
  salvarContaPagar,
  marcarContaComoPaga,
  desmarcarContaPaga,
  excluirContaPagar,
} from "./actions";
import {
  gerarPdfContas,
  formatarBRL,
  formatarDataBR,
  ItemContaPdf,
  TotaisContasPdf,
} from "@/lib/pdfRelatorios";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface ContaItem {
  id: string;
  nome: string;
  valor: number;
  dataVencimento: Date | string;
  dataPagamento: Date | string | null;
  tipoDespesa: string;
  categoria: string;
  descricao: string | null;
  mesReferencia: string;
  status: string;
  observacao: string | null;
  unidadeId: string;
  unidade: { id: string; nome: string };
}

const CATEGORIAS_BASICAS = [
  "Energia elétrica",
  "Água",
  "Internet",
  "Aluguel",
  "Salários",
  "Comissões",
  "Impostos",
  "Fornecedores",
  "Produtos",
  "Lavagem de toalhas",
  "Marketing",
  "Manutenção",
  "Despesas gerais",
  "Outras despesas",
];

export default function ContasClient({
  contas,
  unidades,
  unidadeInicialId,
}: {
  contas: ContaItem[];
  unidades: UnidadeItem[];
  unidadeInicialId: string;
}) {
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Modal de marcar como paga
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [contaParaBaixa, setContaParaBaixa] = useState<ContaItem | null>(null);
  const [dataPagamentoInput, setDataPagamentoInput] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Filtros
  const [filtroUnidade, setFiltroUnidade] = useState(unidadeInicialId || "GLOBAL");
  const [filtroMesRef, setFiltroMesRef] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE" | "ATRASADA" | "PAGA">(
    "TODOS"
  );
  const [buscaTexto, setBuscaTexto] = useState("");

  // Formulário de Cadastro / Edição
  const hojeStr = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    descricao: "",
    unidadeId: unidades[0]?.id || "",
    categoria: "Aluguel",
    categoriaPersonalizada: "",
    modoNovaCategoria: false,
    valor: "",
    dataVencimento: hojeStr,
    mesReferencia: hojeStr.slice(0, 7),
    observacao: "",
  });

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const parseNum = (val: string) => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Abrir Modal para Nova Conta
  const abrirModalNovo = () => {
    setEditandoId(null);
    setFormError("");
    setFormData({
      descricao: "",
      unidadeId:
        filtroUnidade !== "GLOBAL" && unidades.some((u) => u.id === filtroUnidade)
          ? filtroUnidade
          : unidades[0]?.id || "",
      categoria: "Aluguel",
      categoriaPersonalizada: "",
      modoNovaCategoria: false,
      valor: "",
      dataVencimento: hojeStr,
      mesReferencia: hojeStr.slice(0, 7),
      observacao: "",
    });
    setModalCadastroAberto(true);
  };

  // Abrir Modal para Editar
  const abrirModalEditar = (item: ContaItem) => {
    setEditandoId(item.id);
    setFormError("");
    const dataVencISO = new Date(item.dataVencimento).toISOString().split("T")[0];
    const isCatPadrao = CATEGORIAS_BASICAS.includes(item.categoria);

    setFormData({
      descricao: item.descricao || item.nome,
      unidadeId: item.unidadeId,
      categoria: isCatPadrao ? item.categoria : "NOVA",
      categoriaPersonalizada: isCatPadrao ? "" : item.categoria,
      modoNovaCategoria: !isCatPadrao,
      valor: item.valor > 0 ? item.valor.toFixed(2).replace(".", ",") : "",
      dataVencimento: dataVencISO,
      mesReferencia: item.mesReferencia || dataVencISO.slice(0, 7),
      observacao: item.observacao || "",
    });
    setModalCadastroAberto(true);
  };

  // Abrir Modal "Marcar como paga"
  const abrirModalMarcarComoPaga = (item: ContaItem) => {
    setContaParaBaixa(item);
    setDataPagamentoInput(hojeStr);
    setModalBaixaAberto(true);
  };

  // Confirmar Marcação como Paga
  const handleConfirmarPagamento = () => {
    if (!contaParaBaixa) return;
    if (!dataPagamentoInput) {
      alert("Informe a data do pagamento.");
      return;
    }

    startTransition(async () => {
      const res = await marcarContaComoPaga(contaParaBaixa.id, dataPagamentoInput);
      if (res.success) {
        setModalBaixaAberto(false);
        setContaParaBaixa(null);
      } else {
        alert(res.error || "Erro ao marcar conta como paga.");
      }
    });
  };

  // Estornar / Desmarcar Pagamento
  const handleDesmarcarPaga = (id: string) => {
    if (confirm("Deseja desmarcar o pagamento e retornar esta conta para pendente?")) {
      startTransition(async () => {
        await desmarcarContaPaga(id);
      });
    }
  };

  // Salvar Conta
  const handleSalvarConta = () => {
    setFormError("");

    if (!formData.descricao.trim()) {
      setFormError("Informe a descrição da conta.");
      return;
    }

    if (!formData.unidadeId) {
      setFormError("Selecione a unidade.");
      return;
    }

    let catFinal = formData.categoria;
    if (formData.modoNovaCategoria || formData.categoria === "NOVA") {
      catFinal = formData.categoriaPersonalizada.trim();
      if (!catFinal) {
        setFormError("Digite o nome da nova categoria.");
        return;
      }
    }

    const valorNum = parseNum(formData.valor);
    if (valorNum <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }

    if (!formData.dataVencimento) {
      setFormError("Informe a data de vencimento.");
      return;
    }

    const mesRef = formData.mesReferencia || formData.dataVencimento.slice(0, 7);

    startTransition(async () => {
      const res = await salvarContaPagar({
        id: editandoId || undefined,
        descricao: formData.descricao.trim(),
        unidadeId: formData.unidadeId,
        categoria: catFinal,
        valor: valorNum,
        dataVencimento: formData.dataVencimento,
        mesReferencia: mesRef,
        observacao: formData.observacao,
      });

      if (res.success) {
        setModalCadastroAberto(false);
      } else {
        setFormError(res.error || "Erro ao salvar conta a pagar.");
      }
    });
  };

  const handleExcluir = (id: string, desc: string) => {
    if (confirm(`Deseja realmente excluir a conta "${desc}"?`)) {
      startTransition(async () => {
        await excluirContaPagar(id);
      });
    }
  };

  // Classificação dinâmica dos 3 status
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const contasProcessadas = useMemo(() => {
    return contas.map((c) => {
      const dataVenc = new Date(c.dataVencimento);
      dataVenc.setHours(0, 0, 0, 0);

      const estaPaga = !!c.dataPagamento;
      const estaAtrasada = !estaPaga && dataVenc < hoje;
      const estaPendente = !estaPaga && dataVenc >= hoje;

      let statusReal = "PENDENTE";
      if (estaPaga) statusReal = "PAGA";
      else if (estaAtrasada) statusReal = "ATRASADA";

      return {
        ...c,
        estaPaga,
        estaAtrasada,
        estaPendente,
        statusReal,
      };
    });
  }, [contas]);

  // Filtragem
  const filtradas = useMemo(() => {
    return contasProcessadas.filter((c) => {
      // Unidade
      if (filtroUnidade !== "GLOBAL" && c.unidadeId !== filtroUnidade) {
        return false;
      }

      // Mês de Referência
      if (filtroMesRef && c.mesReferencia !== filtroMesRef) {
        return false;
      }

      // Categoria
      if (filtroCategoria !== "TODAS" && c.categoria !== filtroCategoria) {
        return false;
      }

      // Status
      if (filtroStatus !== "TODOS" && c.statusReal !== filtroStatus) {
        return false;
      }

      // Busca texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const desc = (c.descricao || c.nome).toLowerCase();
        const cat = c.categoria.toLowerCase();
        const un = c.unidade.nome.toLowerCase();
        if (!desc.includes(termo) && !cat.includes(termo) && !un.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [contasProcessadas, filtroUnidade, filtroMesRef, filtroCategoria, filtroStatus, buscaTexto]);

  // Totais Resumo
  const totaisContas: TotaisContasPdf = useMemo(() => {
    return filtradas.reduce(
      (acc, c) => {
        acc.totalGeral += c.valor;
        if (c.statusReal === "PAGA") {
          acc.totalPago += c.valor;
        } else if (c.statusReal === "ATRASADA") {
          acc.totalAtrasado += c.valor;
        } else {
          acc.totalPendente += c.valor;
        }
        return acc;
      },
      {
        totalPago: 0,
        totalPendente: 0,
        totalAtrasado: 0,
        totalGeral: 0,
      }
    );
  }, [filtradas]);

  // Categorias disponíveis no filtro
  const categoriasExistentes = useMemo(() => {
    const setCats = new Set<string>(CATEGORIAS_BASICAS);
    contas.forEach((c) => {
      if (c.categoria) setCats.add(c.categoria);
    });
    return Array.from(setCats).sort();
  }, [contas]);

  // Exportar PDF
  const handleBaixarPdf = () => {
    const nomeUnidade =
      filtroUnidade === "GLOBAL"
        ? "Consolidado Own Barber Club"
        : unidades.find((u) => u.id === filtroUnidade)?.nome || "Unidade";

    let periodoTexto = "Todas as Contas";
    if (filtroMesRef) {
      const [ano, mes] = filtroMesRef.split("-");
      periodoTexto = `Mês de Referência: ${mes}/${ano}`;
    }

    const itensPdf: ItemContaPdf[] = filtradas.map((c) => ({
      descricao: c.descricao || c.nome,
      unidade: c.unidade.nome,
      categoria: c.categoria,
      valor: c.valor,
      dataVencimento: c.dataVencimento,
      status: c.statusReal,
      dataPagamento: c.dataPagamento,
    }));

    gerarPdfContas({
      periodo: periodoTexto,
      unidade: nomeUnidade,
      itens: itensPdf,
      totais: totaisContas,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* BARRA SUPERIOR DE AÇÃO E FILTROS */}
      <div className="bg-[#111] border border-[#222] p-4 rounded-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Filtros em Linha */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Mês de Referência */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Mês Ref:</span>
            <input
              type="month"
              value={filtroMesRef}
              onChange={(e) => setFiltroMesRef(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white text-xs font-mono px-3 py-1.5 rounded-sm focus:outline-none focus:border-[#E51E25]"
            />
            {filtroMesRef && (
              <button
                onClick={() => setFiltroMesRef("")}
                title="Limpar mês de referência"
                className="text-gray-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categoria */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Categoria:</span>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white text-xs font-rajdhani px-3 py-2 rounded-sm focus:outline-none focus:border-[#E51E25] cursor-pointer"
            >
              <option value="TODAS">Todas as Categorias</option>
              {categoriasExistentes.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as "TODOS" | "PENDENTE" | "ATRASADA" | "PAGA")}
              className="bg-[#181818] border border-[#333] text-white text-xs font-rajdhani font-semibold uppercase px-3 py-2 rounded-sm focus:outline-none focus:border-[#E51E25] cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">⏳ Pendentes</option>
              <option value="ATRASADA">⚠️ Atrasadas</option>
              <option value="PAGA">✓ Pagas</option>
            </select>
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
            <Plus size={16} /> Cadastrar Conta
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO DAS CONTAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Pago */}
        <div className="bg-[#111] border-l-4 border-emerald-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Pago
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-emerald-400">
            {formatarBRL(totaisContas.totalPago)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {filtradas.filter((c) => c.statusReal === "PAGA").length} conta(s) liquidada(s)
          </div>
        </div>

        {/* Total Pendente */}
        <div className="bg-[#111] border-l-4 border-amber-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Pendente
            <Clock size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-amber-400">
            {formatarBRL(totaisContas.totalPendente)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {filtradas.filter((c) => c.statusReal === "PENDENTE").length} conta(s) no prazo
          </div>
        </div>

        {/* Total Atrasado */}
        <div className="bg-[#111] border-l-4 border-[#E51E25] p-4 rounded-sm shadow-[0_0_12px_rgba(229,30,37,0.1)]">
          <div className="text-[10px] font-rajdhani uppercase text-[#E51E25] font-bold flex items-center justify-between mb-1">
            Total Atrasado
            <AlertTriangle size={15} className="text-[#E51E25]" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-[#E51E25]">
            {formatarBRL(totaisContas.totalAtrasado)}
          </div>
          <div className="text-[10px] text-red-400/80 font-mono mt-1">
            {filtradas.filter((c) => c.statusReal === "ATRASADA").length} conta(s) vencida(s)
          </div>
        </div>

        {/* Total Geral */}
        <div className="bg-[#111] border-l-4 border-gray-500 p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Geral das Contas
            <DollarSign size={15} className="text-gray-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisContas.totalGeral)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {filtradas.length} conta(s) no total
          </div>
        </div>
      </div>

      {/* BUSCA RÁPIDA */}
      <div className="bg-[#141414] border border-[#222] px-4 py-2.5 rounded-sm flex items-center gap-3">
        <Search size={15} className="text-gray-500" />
        <input
          type="text"
          placeholder="Buscar conta por descrição, categoria ou unidade..."
          value={buscaTexto}
          onChange={(e) => setBuscaTexto(e.target.value)}
          className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full font-medium"
        />
        {buscaTexto && (
          <button
            onClick={() => setBuscaTexto("")}
            className="text-gray-500 hover:text-white text-xs cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* TABELA DE CONTAS A PAGAR */}
      <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#161616] border-b border-[#222]">
              <tr>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Descrição
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Unidade
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Categoria
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Valor
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-center">
                  Vencimento
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-center">
                  Status
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-center">
                  Data Pagamento
                </th>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {filtradas.map((c) => (
                <tr key={c.id} className="hover:bg-[#151515] transition-colors">
                  {/* Descrição */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-white text-[15px] font-rajdhani tracking-wide">
                      {c.descricao || c.nome}
                    </div>
                    {c.observacao && (
                      <div className="text-[11px] text-gray-500 italic mt-0.5">{c.observacao}</div>
                    )}
                    {c.mesReferencia && (
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        Ref: {c.mesReferencia}
                      </div>
                    )}
                  </td>

                  {/* Unidade */}
                  <td className="px-5 py-3.5 font-rajdhani text-xs text-gray-300">
                    {c.unidade.nome.replace("Own Barber Club ", "")}
                  </td>

                  {/* Categoria */}
                  <td className="px-5 py-3.5">
                    <span className="bg-[#1C1C1C] border border-[#2E2E2E] text-gray-300 text-xs px-2 py-0.5 rounded font-rajdhani">
                      {c.categoria}
                    </span>
                  </td>

                  {/* Valor */}
                  <td className="px-5 py-3.5 text-right font-rajdhani font-bold text-base text-white">
                    {formatarBRL(c.valor)}
                  </td>

                  {/* Vencimento */}
                  <td className="px-5 py-3.5 text-center font-mono text-xs">
                    <span className={c.statusReal === "ATRASADA" ? "text-[#E51E25] font-bold" : "text-gray-300"}>
                      {formatarDataBR(c.dataVencimento)}
                    </span>
                  </td>

                  {/* Status (Exatamente 3) */}
                  <td className="px-5 py-3.5 text-center">
                    {c.statusReal === "PAGA" ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded text-[11px] font-mono font-bold">
                        <CheckCircle2 size={12} /> PAGA
                      </span>
                    ) : c.statusReal === "ATRASADA" ? (
                      <span className="inline-flex items-center gap-1 bg-red-950/50 border border-red-500/50 text-[#E51E25] px-2.5 py-1 rounded text-[11px] font-mono font-bold animate-pulse">
                        <AlertTriangle size={12} /> ATRASADA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-950/30 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded text-[11px] font-mono font-bold">
                        <Clock size={12} /> PENDENTE
                      </span>
                    )}
                  </td>

                  {/* Data Pagamento */}
                  <td className="px-5 py-3.5 text-center font-mono text-xs text-gray-400">
                    {c.dataPagamento ? formatarDataBR(c.dataPagamento) : "-"}
                  </td>

                  {/* Ações */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Botão Marcar como Paga / Estornar */}
                      {c.statusReal === "PAGA" ? (
                        <button
                          onClick={() => handleDesmarcarPaga(c.id)}
                          disabled={isPending}
                          title="Estornar baixa da conta"
                          className="text-xs font-rajdhani uppercase font-semibold px-2.5 py-1.5 rounded-sm border border-[#333] bg-[#1A1A1A] text-gray-400 hover:text-white transition-all cursor-pointer"
                        >
                          Estornar
                        </button>
                      ) : (
                        <button
                          onClick={() => abrirModalMarcarComoPaga(c)}
                          disabled={isPending}
                          className="text-xs font-rajdhani uppercase font-bold px-3 py-1.5 rounded-sm border border-emerald-600/50 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/50 transition-all cursor-pointer"
                        >
                          Marcar como paga
                        </button>
                      )}

                      {/* Editar */}
                      <button
                        onClick={() => abrirModalEditar(c)}
                        title="Editar conta"
                        className="p-1.5 text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] rounded-sm transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => handleExcluir(c.id, c.descricao || c.nome)}
                        title="Remover conta"
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                    Nenhuma conta encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CADASTRAR / EDITAR CONTA A PAGAR */}
      {modalCadastroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl">
            <button
              onClick={() => setModalCadastroAberto(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-5">
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
                CADASTRO DE DESPESAS
              </div>
              <h2 className="text-2xl font-rajdhani font-bold text-white uppercase tracking-wide">
                {editandoId ? "Editar Conta a Pagar" : "Cadastrar Conta a Pagar"}
              </h2>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-sm border bg-red-950/40 border-red-500/50 text-red-400 text-xs font-rajdhani flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* Descrição */}
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                  Descrição da Conta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel Unidade Centro, Conta de Luz, Salário Barbeiro..."
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              {/* Unidade e Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
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

                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span>Categoria</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          modoNovaCategoria: !formData.modoNovaCategoria,
                        })
                      }
                      className="text-[10px] text-[#E51E25] hover:underline uppercase font-bold cursor-pointer"
                    >
                      {formData.modoNovaCategoria ? "Selecionar Padrão" : "+ Nova Categoria"}
                    </button>
                  </label>

                  {formData.modoNovaCategoria ? (
                    <input
                      type="text"
                      placeholder="Nome da nova categoria"
                      className="w-full bg-[#1A1A1A] border border-[#E51E25] text-white p-2.5 rounded-sm text-sm focus:outline-none"
                      value={formData.categoriaPersonalizada}
                      onChange={(e) =>
                        setFormData({ ...formData, categoriaPersonalizada: e.target.value })
                      }
                    />
                  ) : (
                    <select
                      className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm cursor-pointer"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    >
                      {CATEGORIAS_BASICAS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Valor e Data de Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="0,00"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-sm focus:outline-none focus:border-[#E51E25]"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm focus:outline-none focus:border-[#E51E25]"
                    value={formData.dataVencimento}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({
                        ...formData,
                        dataVencimento: v,
                        mesReferencia: v ? v.slice(0, 7) : formData.mesReferencia,
                      });
                    }}
                  />
                </div>
              </div>

              {/* Mês de Referência (DRE) */}
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                  <span>Mês de Referência (Utilizado no Relatório DRE)</span>
                  <span className="text-[10px] text-gray-500 font-mono">Formato: MM/AAAA</span>
                </label>
                <input
                  type="month"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm focus:outline-none focus:border-[#E51E25]"
                  value={formData.mesReferencia}
                  onChange={(e) => setFormData({ ...formData, mesReferencia: e.target.value })}
                />
              </div>

              {/* Observação Opcional */}
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Número de nota fiscal, detalhes do pagamento..."
                  className="w-full bg-[#1A1A1A] border border-[#333] text-gray-300 p-2.5 rounded-sm text-sm focus:outline-none focus:border-[#E51E25]"
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setModalCadastroAberto(false)}
                  className="px-4 py-2.5 text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarConta}
                  disabled={isPending}
                  className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 disabled:opacity-60 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(229,30,37,0.3)]"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> SALVANDO...
                    </>
                  ) : (
                    <>CONFIRMAR DESPESA</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO: MARCAR COMO PAGA (SOLICITA SOMENTE DATA DO PAGAMENTO) */}
      {modalBaixaAberto && contaParaBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-sm rounded-sm p-6 relative shadow-2xl">
            <button
              onClick={() => {
                setModalBaixaAberto(false);
                setContaParaBaixa(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase font-semibold">
                LIQUIDAÇÃO DE CONTA
              </div>
              <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wide">
                Marcar como Paga
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-rajdhani">
                {contaParaBaixa.descricao || contaParaBaixa.nome} • {formatarBRL(contaParaBaixa.valor)}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-rajdhani text-gray-300 uppercase tracking-widest mb-1.5 block">
                  Data do Pagamento
                </label>
                <input
                  type="date"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  value={dataPagamentoInput}
                  onChange={(e) => setDataPagamentoInput(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalBaixaAberto(false);
                    setContaParaBaixa(null);
                  }}
                  className="px-4 py-2 text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarPagamento}
                  disabled={isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-5 py-2 rounded-sm transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> CONFIRMANDO...
                    </>
                  ) : (
                    <>CONFIRMAR PAGAMENTO</>
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
