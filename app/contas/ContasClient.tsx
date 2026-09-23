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
  Repeat,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import {
  salvarContaPagar,
  marcarContaComoPaga,
  desmarcarContaPaga,
  excluirContaPagar,
  excluirSerieContaPagar,
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

interface RecorrenciaInfoItem {
  recorrenciaId: string;
  tipo: "CONTINUO" | "PARCELADO";
  parcelaAtual?: number;
  totalParcelas?: number;
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
  recorrenciaInfo?: RecorrenciaInfoItem | null;
  textoObservacao?: string;
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

  // Modal de exclusão especial para contas recorrentes / parceladas
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [contaParaExcluir, setContaParaExcluir] = useState<ContaItem | null>(null);

  // Filtros
  const [filtroUnidade, setFiltroUnidade] = useState(unidadeInicialId || "GLOBAL");
  const [filtroMesRef, setFiltroMesRef] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE" | "ATRASADA" | "PAGA">(
    "TODOS"
  );
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "UNICA" | "CONTINUA" | "PARCELADA">(
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
    // Recorrência & Parcelamento
    tipoLancamento: "UNICA" as "UNICA" | "CONTINUA" | "PARCELADA",
    totalParcelas: "12",
    valorModo: "PARCELA" as "PARCELA" | "TOTAL",
    // Edição e Reajuste em série
    isRecorrenteOuParcelada: false,
    recorrenciaId: "",
    aplicarAFuturas: false,
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
      tipoLancamento: "UNICA",
      totalParcelas: "12",
      valorModo: "PARCELA",
      isRecorrenteOuParcelada: false,
      recorrenciaId: "",
      aplicarAFuturas: false,
    });
    setModalCadastroAberto(true);
  };

  // Abrir Modal para Editar
  const abrirModalEditar = (item: ContaItem) => {
    setEditandoId(item.id);
    setFormError("");
    const dataVencISO = new Date(item.dataVencimento).toISOString().split("T")[0];
    const isCatPadrao = CATEGORIAS_BASICAS.includes(item.categoria);
    const hasRec = !!item.recorrenciaInfo;

    // Remove eventual sufixo "(01/60)" da descrição para facilitar edição do nome base
    let descLimpa = item.descricao || item.nome;
    if (item.recorrenciaInfo?.tipo === "PARCELADO") {
      descLimpa = descLimpa.replace(/\s*\(\d+\/\d+\)$/, "").trim();
    }

    setFormData({
      descricao: descLimpa,
      unidadeId: item.unidadeId,
      categoria: isCatPadrao ? item.categoria : "NOVA",
      categoriaPersonalizada: isCatPadrao ? "" : item.categoria,
      modoNovaCategoria: !isCatPadrao,
      valor: item.valor > 0 ? item.valor.toFixed(2).replace(".", ",") : "",
      dataVencimento: dataVencISO,
      mesReferencia: item.mesReferencia || dataVencISO.slice(0, 7),
      observacao: item.textoObservacao !== undefined ? item.textoObservacao : item.observacao || "",
      tipoLancamento: hasRec
        ? item.recorrenciaInfo!.tipo === "CONTINUO"
          ? "CONTINUA"
          : "PARCELADA"
        : "UNICA",
      totalParcelas: String(item.recorrenciaInfo?.totalParcelas || "12"),
      valorModo: "PARCELA",
      isRecorrenteOuParcelada: hasRec,
      recorrenciaId: item.recorrenciaInfo?.recorrenciaId || "",
      aplicarAFuturas: false,
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

    // Validação de parcelas se for parcelada
    let numParcelas = 12;
    if (formData.tipoLancamento === "PARCELADA" && !editandoId) {
      numParcelas = parseInt(formData.totalParcelas, 10);
      if (isNaN(numParcelas) || numParcelas < 2 || numParcelas > 360) {
        setFormError("Informe uma quantidade de parcelas válida (entre 2 e 360).");
        return;
      }
    }

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
        tipoLancamento: formData.tipoLancamento,
        totalParcelas: numParcelas,
        valorModo: formData.valorModo,
        aplicarAFuturas: formData.aplicarAFuturas,
        recorrenciaId: formData.recorrenciaId || undefined,
      });

      if (res.success) {
        setModalCadastroAberto(false);
      } else {
        setFormError(res.error || "Erro ao salvar conta a pagar.");
      }
    });
  };

  // Clique no botão de excluir da tabela
  const handleExcluirClique = (item: ContaItem) => {
    if (item.recorrenciaInfo) {
      setContaParaExcluir(item);
      setModalExcluirAberto(true);
    } else {
      if (confirm(`Deseja realmente excluir a conta "${item.descricao || item.nome}"?`)) {
        startTransition(async () => {
          await excluirContaPagar(item.id);
        });
      }
    }
  };

  // Excluir apenas a conta selecionada
  const handleConfirmarExcluirUnica = () => {
    if (!contaParaExcluir) return;
    startTransition(async () => {
      await excluirContaPagar(contaParaExcluir.id);
      setModalExcluirAberto(false);
      setContaParaExcluir(null);
    });
  };

  // Cancelar recorrência / excluir todas as futuras pendentes
  const handleConfirmarExcluirSerie = () => {
    if (!contaParaExcluir || !contaParaExcluir.recorrenciaInfo) return;
    startTransition(async () => {
      await excluirSerieContaPagar(
        contaParaExcluir.recorrenciaInfo!.recorrenciaId,
        contaParaExcluir.mesReferencia
      );
      setModalExcluirAberto(false);
      setContaParaExcluir(null);
    });
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

      // Tipo de Conta (Recorrente / Parcelada / Única)
      if (filtroTipo !== "TODOS") {
        if (filtroTipo === "UNICA" && c.recorrenciaInfo) return false;
        if (filtroTipo === "CONTINUA" && c.recorrenciaInfo?.tipo !== "CONTINUO") return false;
        if (filtroTipo === "PARCELADA" && c.recorrenciaInfo?.tipo !== "PARCELADO") return false;
      }

      // Busca texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const desc = (c.descricao || c.nome).toLowerCase();
        const cat = c.categoria.toLowerCase();
        const un = c.unidade.nome.toLowerCase();
        const obs = (c.textoObservacao || c.observacao || "").toLowerCase();
        if (
          !desc.includes(termo) &&
          !cat.includes(termo) &&
          !un.includes(termo) &&
          !obs.includes(termo)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    contasProcessadas,
    filtroUnidade,
    filtroMesRef,
    filtroCategoria,
    filtroStatus,
    filtroTipo,
    buscaTexto,
  ]);

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

  // Resumo de cálculo de parcelas para o modal
  const resumoParcelas = useMemo(() => {
    if (formData.tipoLancamento !== "PARCELADA") return null;
    const qtd = parseInt(formData.totalParcelas, 10);
    const val = parseNum(formData.valor);
    if (!qtd || qtd <= 0 || val <= 0) return null;

    if (formData.valorModo === "TOTAL") {
      const vParcela = val / qtd;
      return {
        texto: `${qtd} parcelas mensais de ${formatarBRL(vParcela)}`,
        totalFormatado: `Total: ${formatarBRL(val)}`,
      };
    } else {
      const vTotal = val * qtd;
      return {
        texto: `${qtd} parcelas mensais de ${formatarBRL(val)}`,
        totalFormatado: `Total Financiado: ${formatarBRL(vTotal)}`,
      };
    }
  }, [formData.tipoLancamento, formData.totalParcelas, formData.valor, formData.valorModo]);

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
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">
              Unidade:
            </span>
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
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">
              Mês Ref:
            </span>
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
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">
              Categoria:
            </span>
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
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">
              Status:
            </span>
            <select
              value={filtroStatus}
              onChange={(e) =>
                setFiltroStatus(e.target.value as "TODOS" | "PENDENTE" | "ATRASADA" | "PAGA")
              }
              className="bg-[#181818] border border-[#333] text-white text-xs font-rajdhani font-semibold uppercase px-3 py-2 rounded-sm focus:outline-none focus:border-[#E51E25] cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">⏳ Pendentes</option>
              <option value="ATRASADA">⚠️ Atrasadas</option>
              <option value="PAGA">✓ Pagas</option>
            </select>
          </div>

          {/* Tipo de Despesa (Novo Filtro) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-rajdhani uppercase font-semibold text-gray-400">
              Tipo:
            </span>
            <select
              value={filtroTipo}
              onChange={(e) =>
                setFiltroTipo(e.target.value as "TODOS" | "UNICA" | "CONTINUA" | "PARCELADA")
              }
              className="bg-[#181818] border border-[#333] text-white text-xs font-rajdhani font-semibold uppercase px-3 py-2 rounded-sm focus:outline-none focus:border-[#E51E25] cursor-pointer"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="CONTINUA">🔄 Recorrentes Mensais</option>
              <option value="PARCELADA">📦 Parceladas / Financiadas</option>
              <option value="UNICA">📌 Contas Únicas</option>
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
            {filtradas.filter((c) => c.statusReal === "PENDENTE").length} conta(s) a vencer
          </div>
        </div>

        {/* Total Atrasado */}
        <div className="bg-[#111] border-l-4 border-[#E51E25] p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Atrasado
            <AlertTriangle size={15} className="text-[#E51E25]" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-[#E51E25]">
            {formatarBRL(totaisContas.totalAtrasado)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {filtradas.filter((c) => c.statusReal === "ATRASADA").length} conta(s) em atraso
          </div>
        </div>

        {/* Total Geral */}
        <div className="bg-[#111] border-l-4 border-[#444] p-4 rounded-sm">
          <div className="text-[10px] font-rajdhani uppercase text-gray-400 font-semibold flex items-center justify-between mb-1">
            Total Geral Filtrado
            <Layers size={15} className="text-gray-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-white">
            {formatarBRL(totaisContas.totalGeral)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            {filtradas.length} conta(s) no total
          </div>
        </div>
      </div>

      {/* BARRA DE BUSCA RÁPIDA */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-3 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por descrição, fornecedor, categoria, observação..."
          value={buscaTexto}
          onChange={(e) => setBuscaTexto(e.target.value)}
          className="w-full bg-[#111] border border-[#222] pl-10 pr-4 py-2.5 rounded-sm text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E51E25]"
        />
        {buscaTexto && (
          <button
            onClick={() => setBuscaTexto("")}
            className="absolute right-3 top-2.5 text-gray-500 hover:text-white text-xs cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* TABELA DE CONTAS A PAGAR */}
      <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] border-b border-[#262626]">
              <tr>
                <th className="px-5 py-3 font-rajdhani text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  Descrição / Recorrência
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
                  {/* Descrição e Badges de Recorrência */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-[15px] font-rajdhani tracking-wide">
                        {c.descricao || c.nome}
                      </span>
                      {c.recorrenciaInfo?.tipo === "CONTINUO" && (
                        <span className="inline-flex items-center gap-1 bg-purple-950/50 border border-purple-500/40 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          <Repeat size={10} /> Recorrente
                        </span>
                      )}
                      {c.recorrenciaInfo?.tipo === "PARCELADO" && (
                        <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          <Layers size={10} /> Parcela {c.recorrenciaInfo.parcelaAtual}/
                          {c.recorrenciaInfo.totalParcelas}
                        </span>
                      )}
                    </div>
                    {c.textoObservacao && (
                      <div className="text-[11px] text-gray-400 italic mt-0.5">
                        {c.textoObservacao}
                      </div>
                    )}
                    {c.mesReferencia && (
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
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
                    <span
                      className={
                        c.statusReal === "ATRASADA" ? "text-[#E51E25] font-bold" : "text-gray-300"
                      }
                    >
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
                        onClick={() => handleExcluirClique(c)}
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
                  <td
                    colSpan={8}
                    className="py-16 text-center text-gray-500 font-rajdhani text-sm"
                  >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl my-8">
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
              {/* TIPO DE LANÇAMENTO (SELETOR DISPONÍVEL APENAS NA CRIAÇÃO) */}
              {!editandoId && (
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Tipo de Lançamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipoLancamento: "UNICA" })}
                      className={`py-2 px-2 text-xs font-rajdhani font-bold uppercase tracking-wider rounded-sm border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        formData.tipoLancamento === "UNICA"
                          ? "bg-[#E51E25] text-white border-[#E51E25] shadow-[0_0_10px_rgba(229,30,37,0.3)]"
                          : "bg-[#181818] text-gray-400 border-[#333] hover:text-white hover:bg-[#202020]"
                      }`}
                    >
                      <Tag size={15} />
                      <span>Conta Única</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipoLancamento: "CONTINUA" })}
                      className={`py-2 px-2 text-xs font-rajdhani font-bold uppercase tracking-wider rounded-sm border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        formData.tipoLancamento === "CONTINUA"
                          ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                          : "bg-[#181818] text-gray-400 border-[#333] hover:text-white hover:bg-[#202020]"
                      }`}
                    >
                      <Repeat size={15} />
                      <span>Recorrente Mensal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipoLancamento: "PARCELADA" })}
                      className={`py-2 px-2 text-xs font-rajdhani font-bold uppercase tracking-wider rounded-sm border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        formData.tipoLancamento === "PARCELADA"
                          ? "bg-cyan-600 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                          : "bg-[#181818] text-gray-400 border-[#333] hover:text-white hover:bg-[#202020]"
                      }`}
                    >
                      <Layers size={15} />
                      <span>Parcelada (Financ.)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MENSAGEM INFORMATIVA DE RECORRÊNCIA CONTÍNUA */}
              {!editandoId && formData.tipoLancamento === "CONTINUA" && (
                <div className="bg-purple-950/30 border border-purple-500/40 p-3 rounded-sm text-xs font-rajdhani text-purple-200 flex items-start gap-2.5">
                  <Repeat size={16} className="text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-purple-300 block mb-0.5 uppercase tracking-wide">
                      Recorrência Mensal Contínua Ativa
                    </strong>
                    Custos fixos mensais (ex: aluguel, internet, sistemas, energia) ficarão salvos
                    automaticamente para todos os próximos meses sem necessidade de recadastrar todo
                    mês. Permanecerá ativo até que você realize um reajuste de valor ou encerre o
                    contrato.
                  </div>
                </div>
              )}

              {/* CONFIGURAÇÃO DE PARCELAMENTO (FINANCIAMENTO / BOLETOS / CARTÃO) */}
              {!editandoId && formData.tipoLancamento === "PARCELADA" && (
                <div className="bg-cyan-950/20 border border-cyan-500/40 p-3 rounded-sm space-y-3">
                  <div className="text-xs font-rajdhani font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-cyan-400" />
                    <span>Configuração do Parcelamento / Financiamento</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-rajdhani text-gray-300 uppercase tracking-widest mb-1 block">
                        Qtd. de Parcelas (Meses)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={360}
                        value={formData.totalParcelas}
                        onChange={(e) =>
                          setFormData({ ...formData, totalParcelas: e.target.value })
                        }
                        className="w-full bg-[#141414] border border-[#333] text-white p-2 rounded-sm font-mono text-sm focus:outline-none focus:border-cyan-500"
                        placeholder="Ex: 60"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-rajdhani text-gray-300 uppercase tracking-widest mb-1 block">
                        O valor digitado abaixo é:
                      </label>
                      <select
                        value={formData.valorModo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valorModo: e.target.value as "PARCELA" | "TOTAL",
                          })
                        }
                        className="w-full bg-[#141414] border border-[#333] text-white p-2 rounded-sm text-xs font-rajdhani focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="PARCELA">Valor de cada parcela (ex: R$ 1.500)</option>
                        <option value="TOTAL">Valor total da compra (ex: R$ 90.000)</option>
                      </select>
                    </div>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div>
                    <div className="text-[10px] font-rajdhani text-gray-400 uppercase tracking-wider mb-1">
                      Atalhos rápidos:
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[3, 6, 10, 12, 18, 24, 36, 48, 60].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setFormData({ ...formData, totalParcelas: String(num) })}
                          className={`px-2 py-0.5 text-[11px] font-mono rounded-sm border transition-all cursor-pointer ${
                            Number(formData.totalParcelas) === num
                              ? "bg-cyan-500 text-black font-bold border-cyan-400"
                              : "bg-[#181818] text-gray-300 border-[#333] hover:border-gray-500"
                          }`}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumo dinâmico */}
                  {resumoParcelas && (
                    <div className="text-xs font-rajdhani bg-[#101010] p-2.5 rounded border border-[#252525] text-gray-300 flex items-center justify-between">
                      <span>{resumoParcelas.texto}</span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {resumoParcelas.totalFormatado}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* OPÇÃO DE REAJUSTE EM LOTE NO MODO EDIÇÃO */}
              {editandoId && formData.isRecorrenteOuParcelada && (
                <div className="bg-amber-950/30 border border-amber-500/40 p-3 rounded-sm space-y-2">
                  <div className="text-xs font-rajdhani font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span>Conta vinculada a série recorrente / parcelada</span>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs font-rajdhani text-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.aplicarAFuturas}
                      onChange={(e) =>
                        setFormData({ ...formData, aplicarAFuturas: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#E51E25] cursor-pointer mt-0.5"
                    />
                    <div>
                      <strong className="text-amber-300 block">
                        Reajustar valor para todos os meses futuros:
                      </strong>
                      <span>
                        Aplicar as alterações deste valor para esta e todas as contas futuras
                        pendentes desta série (ideal para reajustes de aluguel ou mudanças de
                        contrato).
                      </span>
                    </div>
                  </label>
                  <div className="text-[10px] text-gray-400 font-mono">
                    * Contas de meses anteriores ou já pagas não sofrerão alterações.
                  </div>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1 block">
                  Descrição da Conta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel Unidade Centro, Financiamento Caminhonete, Conta de Luz..."
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
                    {formData.tipoLancamento === "PARCELADA" && formData.valorModo === "TOTAL"
                      ? "Valor Total da Compra (R$)"
                      : formData.tipoLancamento === "PARCELADA"
                      ? "Valor de Cada Parcela (R$)"
                      : "Valor (R$)"}
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
                    {formData.tipoLancamento === "PARCELADA" || formData.tipoLancamento === "CONTINUA"
                      ? "Primeiro Vencimento"
                      : "Data de Vencimento"}
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
                  <span>Mês de Referência Inicial (Relatórios / DRE)</span>
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
                  placeholder="Número de nota fiscal, detalhes do contrato..."
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

      {/* MODAL ESPECIAL: EXCLUSÃO DE CONTA RECORRENTE OU PARCELADA */}
      {modalExcluirAberto && contaParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-md rounded-sm p-6 relative shadow-2xl">
            <button
              onClick={() => {
                setModalExcluirAberto(false);
                setContaParaExcluir(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold flex items-center gap-1.5">
                <AlertTriangle size={14} /> REMOÇÃO DE DESPESA RECORRENTE
              </div>
              <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wide mt-1">
                Como deseja excluir?
              </h3>
              <p className="text-xs text-gray-300 mt-2 font-rajdhani bg-[#161616] p-2.5 rounded border border-[#252525]">
                <strong className="text-white">
                  {contaParaExcluir.descricao || contaParaExcluir.nome}
                </strong>{" "}
                • {formatarBRL(contaParaExcluir.valor)}
                <span className="block text-[11px] text-gray-400 font-mono mt-0.5">
                  Mês Ref: {contaParaExcluir.mesReferencia}
                </span>
              </p>
            </div>

            <p className="text-xs text-gray-400 font-rajdhani mb-5">
              Esta despesa faz parte de uma série (
              {contaParaExcluir.recorrenciaInfo?.tipo === "CONTINUO"
                ? "Recorrência Contínua"
                : "Parcelamento"}
              ). Selecione a forma de exclusão:
            </p>

            <div className="flex flex-col gap-2.5">
              {/* Opção 1: Excluir apenas esta */}
              <button
                type="button"
                onClick={handleConfirmarExcluirUnica}
                disabled={isPending}
                className="w-full text-left p-3 rounded-sm border border-[#333] bg-[#181818] hover:bg-[#202020] hover:border-gray-400 transition-all cursor-pointer group"
              >
                <div className="text-xs font-rajdhani font-bold text-white uppercase tracking-wider group-hover:text-red-400">
                  1. Excluir somente a conta deste mês ({contaParaExcluir.mesReferencia})
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Mantém intactas as demais contas e parcelas dos outros meses.
                </div>
              </button>

              {/* Opção 2: Cancelar recorrência / Excluir todas as futuras pendentes */}
              <button
                type="button"
                onClick={handleConfirmarExcluirSerie}
                disabled={isPending}
                className="w-full text-left p-3 rounded-sm border border-red-900/60 bg-red-950/30 hover:bg-red-900/40 hover:border-red-600 transition-all cursor-pointer group"
              >
                <div className="text-xs font-rajdhani font-bold text-red-300 uppercase tracking-wider group-hover:text-white">
                  2. Cancelar recorrência (excluir este e todos os meses futuros)
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Remove todas as despesas pendentes daqui em diante. Contas passadas já pagas são
                  100% preservadas no histórico.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalExcluirAberto(false);
                  setContaParaExcluir(null);
                }}
                className="mt-2 py-2 text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer text-center"
              >
                Cancelar Operação
              </button>
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
                {contaParaBaixa.descricao || contaParaBaixa.nome} •{" "}
                {formatarBRL(contaParaBaixa.valor)}
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
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-5 py-2 rounded-sm transition-all cursor-pointer shadow-[0_0_10px_rgba(168,185,129,0.3)]"
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
