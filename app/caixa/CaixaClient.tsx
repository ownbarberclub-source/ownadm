"use client";

import { useState, useTransition } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, Plus, ArrowLeftRight, Landmark, DollarSign, CheckCircle2, Clock, AlertTriangle, X, ShieldAlert, CreditCard, Layers } from "lucide-react";
import { criarMovimentacao, cancelarMovimentacao, realizarTransferencia, cancelarTransferencia, compensarCartao, salvarFechamentoCaixa, criarContaFinanceira, MovimentacaoInput, TransferenciaInput, CompensacaoCartaoInput, FechamentoCaixaInput } from "./actions";
import FiltrosAvancados, { EstadoFiltros } from "@/components/FiltrosAvancados";
import { ItemRelatorioExport } from "@/lib/exportUtils";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface ContaFinanceiraItem {
  id: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  saldoAtual: number;
  ativo: boolean;
  unidadeId: string;
  unidade: { id: string; nome: string };
}

interface MovimentacaoItem {
  id: string;
  codigoIdentificador: string | null;
  dataCompetencia: Date | string;
  dataMovimento: Date | string;
  unidadeId: string;
  unidade: { id: string; nome: string };
  contaId: string;
  conta: { id: string; nome: string; tipo: string };
  tipo: string;
  categoria: string;
  subcategoria: string | null;
  descricao: string;
  valor: number;
  formaPagamento: string;
  status: string;
  favorecido: string | null;
  responsavel: string;
  anexoUrl: string | null;
  observacoes: string | null;
  conciliado: boolean;
  transferenciaId: string | null;
  canceladoEm: Date | string | null;
  canceladoPor: string | null;
  motivoCancelamento: string | null;
}

interface TransferenciaItem {
  id: string;
  codigoIdentificador: string;
  data: Date | string;
  valor: number;
  descricao: string;
  responsavel: string;
  status: string;
  unidadeOrigem: { id: string; nome: string };
  contaOrigem: { id: string; nome: string };
  unidadeDestino: { id: string; nome: string };
  contaDestino: { id: string; nome: string };
  canceladoEm: Date | string | null;
  motivoCancelamento: string | null;
}

interface FechamentoCaixaItem {
  id: string;
  data: Date | string;
  unidade: { id: string; nome: string };
  saldoEsperadoDinheiro: number;
  saldoContadoDinheiro: number;
  diferencaDinheiro: number;
  saldoBancarioInformado: number | null;
  justificativa: string | null;
  responsavel: string;
  createdAt: Date | string;
}

export default function CaixaClient({
  unidades,
  contas,
  movimentacoes,
  transferencias,
  fechamentosCaixa,
  unidadeAtualId,
}: {
  unidades: UnidadeItem[];
  contas: ContaFinanceiraItem[];
  movimentacoes: MovimentacaoItem[];
  transferencias: TransferenciaItem[];
  fechamentosCaixa: FechamentoCaixaItem[];
  unidadeAtualId: string;
}) {
  const [abaAtiva, setAbaAtiva] = useState<"EXTRATO" | "TRANSFERENCIAS" | "CONTAS" | "CONCILIACAO">("EXTRATO");
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string>(unidadeAtualId);

  // Modais
  const [modalMovAberto, setModalMovAberto] = useState(false);
  const [modalTrfAberto, setModalTrfAberto] = useState(false);
  const [modalCompensarAberto, setModalCompensarAberto] = useState(false);
  const [modalFechamentoCaixaAberto, setModalFechamentoCaixaAberto] = useState(false);
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const [modalCancelarId, setModalCancelarId] = useState<{ id: string; tipo: "MOV" | "TRF"; nome: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Estados dos Filtros Avançados
  const [filtros, setFiltros] = useState<EstadoFiltros>({
    termoBusca: "",
    unidadeId: unidadeSelecionadaId,
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

  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  // -------------------------------------------------------------
  // CÁLCULOS FINANCEIROS POR UNIDADE E CONSOLIDADO
  // -------------------------------------------------------------
  const contasFiltradasUnidade = contas.filter(
    (c) => unidadeSelecionadaId === "GLOBAL" || c.unidadeId === unidadeSelecionadaId
  );

  const saldoBancario = contasFiltradasUnidade
    .filter((c) => c.tipo === "BANCARIA" || c.tipo === "PIX")
    .reduce((acc, c) => acc + c.saldoAtual, 0);

  const saldoDinheiroEspecie = contasFiltradasUnidade
    .filter((c) => c.tipo === "DINHEIRO")
    .reduce((acc, c) => acc + c.saldoAtual, 0);

  const saldoValoresAReceber = contasFiltradasUnidade
    .filter((c) => c.tipo === "CARTOES_RECEBER")
    .reduce((acc, c) => acc + c.saldoAtual, 0);

  // Saldo Disponível Real = Bancário + Espécie (Sem cartões a compensar)
  const saldoTotalDisponivel = saldoBancario + saldoDinheiroEspecie;

  // Filtragem das Movimentações
  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    const dataF = new Date(m.dataMovimento).toISOString().split("T")[0];

    const matchUnidade =
      filtros.unidadeId === "GLOBAL" ? true : m.unidadeId === filtros.unidadeId;
    const matchConta = !filtros.contaId || m.contaId === filtros.contaId;
    const matchTipo = filtros.tipo === "TODOS" || m.tipo === filtros.tipo;
    const matchStatus = filtros.status === "TODOS" || m.status === filtros.status;
    const matchCategoria = !filtros.categoria || m.categoria === filtros.categoria;
    const matchForma = !filtros.formaPagamento || m.formaPagamento === filtros.formaPagamento;
    const matchDataInicio = !filtros.dataInicio || dataF >= filtros.dataInicio;
    const matchDataFim = !filtros.dataFim || dataF <= filtros.dataFim;
    const matchValorMin = !filtros.valorMin || m.valor >= parseFloat(filtros.valorMin);
    const matchValorMax = !filtros.valorMax || m.valor <= parseFloat(filtros.valorMax);
    const matchBusca =
      !filtros.termoBusca ||
      m.descricao.toLowerCase().includes(filtros.termoBusca.toLowerCase()) ||
      (m.favorecido && m.favorecido.toLowerCase().includes(filtros.termoBusca.toLowerCase())) ||
      m.categoria.toLowerCase().includes(filtros.termoBusca.toLowerCase()) ||
      m.unidade.nome.toLowerCase().includes(filtros.termoBusca.toLowerCase());

    return (
      matchUnidade &&
      matchConta &&
      matchTipo &&
      matchStatus &&
      matchCategoria &&
      matchForma &&
      matchDataInicio &&
      matchDataFim &&
      matchValorMin &&
      matchValorMax &&
      matchBusca
    );
  });

  // Mapear movimentações para exportação
  const itensParaExportar: ItemRelatorioExport[] = movimentacoesFiltradas.map((m) => {
    const isTransf =
      m.tipo === "TRANSFERENCIA" ||
      m.categoria.includes("TRANSFERENCIA") ||
      m.categoria.includes("COMPENSACAO") ||
      m.categoria === "RECEBIMENTO_CARTAO" ||
      m.categoria === "COMPENSACAO_CARTAO_SAIDA";

    return {
      data: m.dataMovimento,
      unidade: m.unidade.nome,
      tipo: isTransf ? "TRANSFERENCIA" : (m.tipo as "ENTRADA" | "SAIDA"),
      categoria: m.categoria,
      subcategoria: m.subcategoria || undefined,
      descricao: m.descricao,
      favorecido: m.favorecido || undefined,
      contaFinanceira: m.conta.nome,
      formaPagamento: m.formaPagamento,
      status: m.status,
      valor: m.valor,
      observacao: m.observacoes || (m.canceladoEm ? `Cancelado por ${m.canceladoPor}: ${m.motivoCancelamento}` : ""),
    };
  });

  // Handlers
  const handleTrocaUnidade = (id: string) => {
    setUnidadeSelecionadaId(id);
    setFiltros({ ...filtros, unidadeId: id });
  };

  const handleConfirmarCancelamento = () => {
    if (!modalCancelarId || !motivoCancelamento.trim()) {
      setFormError("Informe o motivo do cancelamento.");
      return;
    }

    startTransition(async () => {
      let res;
      if (modalCancelarId.tipo === "MOV") {
        res = await cancelarMovimentacao(modalCancelarId.id, motivoCancelamento, "Administrador");
      } else {
        res = await cancelarTransferencia(modalCancelarId.id, motivoCancelamento, "Administrador");
      }

      if (res.success) {
        setModalCancelarId(null);
        setMotivoCancelamento("");
      } else {
        setFormError(res.error || "Erro ao cancelar.");
      }
    });
  };

  // Forms states
  // 1. Movimentacao
  const [movContaId, setMovContaId] = useState(contas[0]?.id || "");
  const [movTipo, setMovTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [movCategoria, setMovCategoria] = useState("Despesas Gerais");
  const [movDescricao, setMovDescricao] = useState("");
  const [movValor, setMovValor] = useState("");
  const [movDataComp, setMovDataComp] = useState(new Date().toISOString().split("T")[0]);
  const [movDataMov, setMovDataMov] = useState(new Date().toISOString().split("T")[0]);
  const [movForma, setMovForma] = useState("PIX");
  const [movStatus, setMovStatus] = useState<"CONFIRMADO" | "PENDENTE">("CONFIRMADO");
  const [movFavorecido, setMovFavorecido] = useState("");
  const [movObs, setMovObs] = useState("");

  const handleSalvarMovimentacao = () => {
    setFormError("");
    const v = parseFloat(movValor.replace(",", "."));
    if (isNaN(v) || v <= 0) return setFormError("Valor inválido.");
    if (!movDescricao.trim()) return setFormError("Descrição é obrigatória.");

    const contaSel = contas.find((c) => c.id === movContaId);
    if (!contaSel) return setFormError("Selecione a conta.");

    const input: MovimentacaoInput = {
      unidadeId: contaSel.unidadeId,
      contaId: movContaId,
      tipo: movTipo,
      categoria: movCategoria,
      descricao: movDescricao.trim(),
      valor: v,
      dataCompetencia: movDataComp,
      dataMovimento: movDataMov,
      formaPagamento: movForma,
      status: movStatus,
      favorecido: movFavorecido.trim() || undefined,
      observacoes: movObs.trim() || undefined,
      responsavel: "Administrador",
    };

    startTransition(async () => {
      const res = await criarMovimentacao(input);
      if (res.success) {
        setModalMovAberto(false);
        setMovDescricao("");
        setMovValor("");
      } else {
        setFormError(res.error || "Erro ao salvar movimentação.");
      }
    });
  };

  // 2. Transferencia
  const [trfUnidOrigem, setTrfUnidOrigem] = useState(unidades[0]?.id || "");
  const [trfContaOrigem, setTrfContaOrigem] = useState("");
  const [trfUnidDestino, setTrfUnidDestino] = useState(unidades[1]?.id || "");
  const [trfContaDestino, setTrfContaDestino] = useState("");
  const [trfValor, setTrfValor] = useState("");
  const [trfData, setTrfData] = useState(new Date().toISOString().split("T")[0]);
  const [trfDescricao, setTrfDescricao] = useState("");

  const handleSalvarTransferencia = () => {
    setFormError("");
    const v = parseFloat(trfValor.replace(",", "."));
    if (isNaN(v) || v <= 0) return setFormError("Valor inválido.");
    if (!trfContaOrigem || !trfContaDestino) return setFormError("Selecione as contas de origem e destino.");
    if (trfContaOrigem === trfContaDestino) return setFormError("As contas de origem e destino não podem ser iguais.");
    if (!trfDescricao.trim()) return setFormError("Informe o motivo da transferência.");

    const input: TransferenciaInput = {
      unidadeOrigemId: trfUnidOrigem,
      contaOrigemId: trfContaOrigem,
      unidadeDestinoId: trfUnidDestino,
      contaDestinoId: trfContaDestino,
      valor: v,
      data: trfData,
      descricao: trfDescricao.trim(),
      responsavel: "Administrador",
    };

    startTransition(async () => {
      const res = await realizarTransferencia(input);
      if (res.success) {
        setModalTrfAberto(false);
        setTrfValor("");
        setTrfDescricao("");
      } else {
        setFormError(res.error || "Erro ao transferir.");
      }
    });
  };

  // 3. Compensacao Cartao
  const [cmpContaCartao, setCmpContaCartao] = useState("");
  const [cmpContaBanco, setCmpContaBanco] = useState("");
  const [cmpValorBruto, setCmpValorBruto] = useState("");
  const [cmpTaxa, setCmpTaxa] = useState("");
  const [cmpData, setCmpData] = useState(new Date().toISOString().split("T")[0]);

  const handleSalvarCompensacao = () => {
    setFormError("");
    const vb = parseFloat(cmpValorBruto.replace(",", "."));
    const vt = parseFloat(cmpTaxa.replace(",", ".")) || 0;
    if (isNaN(vb) || vb <= 0) return setFormError("Valor bruto inválido.");
    if (vt >= vb) return setFormError("Taxa não pode ser maior ou igual ao valor bruto.");
    if (!cmpContaCartao || !cmpContaBanco) return setFormError("Selecione as contas envolvidas.");

    const contaCart = contas.find((c) => c.id === cmpContaCartao);
    if (!contaCart) return setFormError("Conta de cartões não encontrada.");

    const input: CompensacaoCartaoInput = {
      contaCartaoId: cmpContaCartao,
      contaDestinoId: cmpContaBanco,
      valorBruto: vb,
      taxaCartao: vt,
      data: cmpData,
      responsavel: "Administrador",
      unidadeId: contaCart.unidadeId,
    };

    startTransition(async () => {
      const res = await compensarCartao(input);
      if (res.success) {
        setModalCompensarAberto(false);
        setCmpValorBruto("");
        setCmpTaxa("");
      } else {
        setFormError(res.error || "Erro ao compensar cartão.");
      }
    });
  };

  // 4. Conciliação Diária de Caixa Físico
  const [fcEsperado, setFcEsperado] = useState(saldoDinheiroEspecie.toString());
  const [fcContado, setFcContado] = useState("");
  const [fcBancario, setFcBancario] = useState("");
  const [fcData, setFcData] = useState(new Date().toISOString().split("T")[0]);
  const [fcJustificativa, setFcJustificativa] = useState("");

  const diferencaContagem = (parseFloat(fcContado.replace(",", ".")) || 0) - (parseFloat(fcEsperado) || 0);

  const handleSalvarFechamentoCaixa = () => {
    setFormError("");
    const contado = parseFloat(fcContado.replace(",", "."));
    if (isNaN(contado) || contado < 0) return setFormError("Informe o valor contado fisicamente.");

    const dif = contado - (parseFloat(fcEsperado) || 0);
    if (Math.abs(dif) > 0.01 && !fcJustificativa.trim()) {
      return setFormError("Existe uma diferença de caixa. A justificativa é obrigatória.");
    }

    const input: FechamentoCaixaInput = {
      unidadeId: unidadeSelecionadaId === "GLOBAL" ? unidades[0]?.id || "" : unidadeSelecionadaId,
      data: fcData,
      saldoEsperadoDinheiro: parseFloat(fcEsperado) || 0,
      saldoContadoDinheiro: contado,
      saldoBancarioInformado: parseFloat(fcBancario.replace(",", ".")) || undefined,
      justificativa: fcJustificativa.trim() || undefined,
      responsavel: "Administrador",
    };

    startTransition(async () => {
      const res = await salvarFechamentoCaixa(input);
      if (res.success) {
        setModalFechamentoCaixaAberto(false);
        setFcContado("");
        setFcJustificativa("");
      } else {
        setFormError(res.error || "Erro ao salvar conciliação de caixa.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* SELETOR DE CAIXA: INDEPENDENTES VS CONSOLIDADO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#111] border border-[#222] p-2.5 rounded-sm">
        <button
          onClick={() => handleTrocaUnidade("GLOBAL")}
          className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
            unidadeSelecionadaId === "GLOBAL"
              ? "bg-[#1A1A1A] border-[#E51E25] shadow-[0_0_12px_rgba(229,30,37,0.2)]"
              : "bg-[#141414] border-[#262626] text-gray-400 hover:text-white"
          }`}
        >
          <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-bold flex items-center gap-1.5">
            <Layers size={12} /> VISÃO REDE
          </div>
          <div className="text-base font-rajdhani font-bold text-white uppercase mt-1">
            Caixa Consolidado
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Soma das 3 unidades</div>
        </button>

        {unidades.map((u) => (
          <button
            key={u.id}
            onClick={() => handleTrocaUnidade(u.id)}
            className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
              unidadeSelecionadaId === u.id
                ? "bg-[#1A1A1A] border-[#E51E25] shadow-[0_0_12px_rgba(229,30,37,0.2)]"
                : "bg-[#141414] border-[#262626] text-gray-400 hover:text-white"
            }`}
          >
            <div className="text-[10px] font-mono text-gray-400 tracking-widest uppercase font-semibold">
              CAIXA INDEPENDENTE
            </div>
            <div className="text-base font-rajdhani font-bold text-white uppercase mt-1">
              {u.nome.replace("Own Barber Club ", "Caixa ")}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Operação exclusiva</div>
          </button>
        ))}
      </div>

      {/* KPIS DE CAIXA: DISPONÍVEL, BANCÁRIO, ESPÉCIE E A RECEBER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Saldo Total Disponível */}
        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#111] border-l-4 border-[#E51E25] p-5 rounded-sm relative overflow-hidden shadow-[0_0_15px_rgba(229,30,37,0.15)]">
          <div className="text-[11px] font-rajdhani text-[#E51E25] uppercase tracking-widest mb-1 font-bold flex items-center justify-between">
            Saldo Disponível (Líquido)
            <Wallet size={16} />
          </div>
          <div className="text-3xl font-rajdhani font-bold text-white tracking-tight">
            {formatter.format(saldoTotalDisponivel)}
          </div>
          <div className="text-[10px] text-gray-400 font-mono mt-2">
            Banco + Espécie confirmado
          </div>
        </div>

        {/* 2. Saldo Bancário */}
        <div className="bg-[#111] border-l-2 border-blue-500 p-5 rounded-sm relative overflow-hidden">
          <div className="text-[11px] font-rajdhani text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
            Saldo em Conta Bancária
            <Landmark size={14} className="text-blue-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-blue-400 tracking-tight">
            {formatter.format(saldoBancario)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-2">
            Contas correntes e PIX
          </div>
        </div>

        {/* 3. Saldo em Dinheiro em Espécie */}
        <div className="bg-[#111] border-l-2 border-emerald-500 p-5 rounded-sm relative overflow-hidden">
          <div className="text-[11px] font-rajdhani text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
            Dinheiro em Espécie (Físico)
            <DollarSign size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-emerald-400 tracking-tight">
            {formatter.format(saldoDinheiroEspecie)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-2">
            Caixa de balcão da unidade
          </div>
        </div>

        {/* 4. Valores de Cartão a Compensar */}
        <div className="bg-[#111] border-l-2 border-amber-500 p-5 rounded-sm relative overflow-hidden">
          <div className="text-[11px] font-rajdhani text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
            Cartões a Receber
            <CreditCard size={14} className="text-amber-400" />
          </div>
          <div className="text-2xl font-rajdhani font-bold text-amber-400 tracking-tight">
            {formatter.format(saldoValoresAReceber)}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-2">
            Faturamento pendente compensação
          </div>
        </div>
      </div>

      {/* ABAS DO MÓDULO CAIXA */}
      <div className="flex border-b border-[#222] gap-1">
        <button
          onClick={() => setAbaAtiva("EXTRATO")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "EXTRATO"
              ? "border-[#E51E25] text-white bg-[#141414]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Extrato de Movimentações
        </button>

        <button
          onClick={() => setAbaAtiva("TRANSFERENCIAS")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "TRANSFERENCIAS"
              ? "border-[#E51E25] text-white bg-[#141414]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Transferências entre Unidades
        </button>

        <button
          onClick={() => setAbaAtiva("CONTAS")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "CONTAS"
              ? "border-[#E51E25] text-white bg-[#141414]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Contas Financeiras ({contasFiltradasUnidade.length})
        </button>

        <button
          onClick={() => setAbaAtiva("CONCILIACAO")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "CONCILIACAO"
              ? "border-[#E51E25] text-white bg-[#141414]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Conciliação Diária de Caixa
        </button>
      </div>

      {/* ABA 1: EXTRATO DE MOVIMENTAÇÕES FINANCEIRAS */}
      {abaAtiva === "EXTRATO" && (
        <div className="flex flex-col gap-4">
          {/* Botões de Ações Rápidas */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="text-xs text-gray-400 font-rajdhani uppercase">
              Extrato detalhado com filtros multi-critérios e exportação
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalCompensarAberto(true)}
                className="flex items-center gap-1.5 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] hover:border-[#555] text-white font-rajdhani font-semibold text-xs uppercase tracking-wider px-3.5 py-2 rounded-sm transition-all cursor-pointer"
              >
                <CreditCard size={14} className="text-amber-400" /> Compensar Cartões
              </button>

              <button
                onClick={() => setModalMovAberto(true)}
                className="flex items-center gap-1.5 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-sm transition-all shadow-[0_0_10px_rgba(229,30,37,0.25)] cursor-pointer"
              >
                <Plus size={14} /> Nova Movimentação
              </button>
            </div>
          </div>

          {/* FILTROS AVANÇADOS */}
          <FiltrosAvancados
            unidades={unidades}
            contas={contas}
            categoriasDisponiveis={[
              "Faturamento Diário",
              "Recebimento de Cartão",
              "Aporte",
              "Empréstimo",
              "Pagamento de Despesas",
              "Fornecedores",
              "Folha de Pagamento",
              "Comissões",
              "Aluguel",
              "Impostos",
              "Retiradas",
              "Transferência Interna",
            ]}
            filtros={filtros}
            onFiltrosChange={setFiltros}
            itensFiltrados={itensParaExportar}
            tituloRelatorio={`Extrato Financeiro - ${unidadeSelecionadaId === "GLOBAL" ? "Consolidado" : "Unidade"}`}
          />

          {/* TABELA DE MOVIMENTAÇÕES */}
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#161616] border-b border-[#222]">
                  <tr>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                      Data
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                      Unidade / Conta
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                      Descrição / Categoria
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">
                      Forma
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">
                      Status
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                      Valor
                    </th>
                    <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {movimentacoesFiltradas.map((m) => {
                    const dataM = new Date(m.dataMovimento);
                    const isCancelado = m.status === "CANCELADO";
                    const isTransferencia =
                      m.tipo === "TRANSFERENCIA" ||
                      m.categoria.includes("TRANSFERENCIA") ||
                      m.categoria.includes("COMPENSACAO") ||
                      m.categoria === "RECEBIMENTO_CARTAO" ||
                      m.categoria === "COMPENSACAO_CARTAO_SAIDA";
                    const isEntrada = m.tipo === "ENTRADA" && !isTransferencia;

                    return (
                      <tr key={m.id} className={`hover:bg-[#151515] transition-colors ${isCancelado ? "opacity-40" : ""}`}>
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-300">
                          {dataM.toLocaleDateString("pt-BR")}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="text-white font-rajdhani font-semibold text-sm">
                            {m.unidade.nome.replace("Own Barber Club ", "")}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{m.conta.nome}</div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="text-gray-100 font-medium text-sm flex items-center gap-2">
                            <span>{m.descricao}</span>
                            {m.codigoIdentificador && (
                              <span className="text-[9px] font-mono text-gray-400 bg-[#1C1C1C] px-1 py-0.5 rounded border border-[#2E2E2E]">
                                {m.codigoIdentificador}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {isTransferencia ? "Transferência Interna (Não é Despesa)" : m.categoria} {m.favorecido ? `• Fav: ${m.favorecido}` : ""}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {isTransferencia ? (
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-700/60 px-2 py-0.5 rounded">
                              COMPENSAÇÃO
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-gray-300 bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#2E2E2E]">
                              {m.formaPagamento}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {isCancelado ? (
                            <span className="text-[10px] font-mono text-red-400 bg-red-950/40 border border-red-500/40 px-2 py-0.5 rounded">
                              CANCELADO
                            </span>
                          ) : m.status === "CONFIRMADO" ? (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5 rounded">
                              CONFIRMADO
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 rounded">
                              PENDENTE
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right font-rajdhani font-bold text-base">
                          {isCancelado ? (
                            <span className="text-gray-500 line-through">
                              {formatter.format(m.valor)}
                            </span>
                          ) : isTransferencia ? (
                            <div className="flex flex-col items-end">
                              <span className="text-indigo-400">
                                ⇄ {formatter.format(m.valor)}
                              </span>
                              <span className="text-[9px] font-mono text-gray-500 font-normal">
                                Transferência Interna
                              </span>
                            </div>
                          ) : isEntrada ? (
                            <span className="text-emerald-400">
                              + {formatter.format(m.valor)}
                            </span>
                          ) : (
                            <span className="text-red-400">
                              - {formatter.format(m.valor)}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          {!isCancelado && (
                            <button
                              onClick={() => setModalCancelarId({ id: m.id, tipo: "MOV", nome: m.descricao })}
                              title="Cancelar movimentação (com justificativa)"
                              className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {movimentacoesFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                        Nenhuma movimentação financeira encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: TRANSFERÊNCIAS ENTRE UNIDADES */}
      {abaAtiva === "TRANSFERENCIAS" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#111] border border-[#222] p-4 rounded-sm">
            <div>
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase mb-0.5">
                CIRCULAÇÃO INTERNA DE CAPITAL
              </div>
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider">
                Transferências entre Unidades
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Regra obrigatória: transferências não geram receita nem despesa e não afetam o saldo total consolidado do grupo.
              </p>
            </div>
            <button
              onClick={() => setModalTrfAberto(true)}
              className="flex items-center gap-1.5 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-sm transition-all shadow-[0_0_10px_rgba(229,30,37,0.25)] cursor-pointer"
            >
              <ArrowLeftRight size={14} /> Nova Transferência
            </button>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#161616] border-b border-[#222]">
                <tr>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Código / Data
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Origem (Saída)
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Destino (Entrada)
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Motivo / Descrição
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                    Valor
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">
                    Status
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {transferencias.map((t) => {
                  const isCancelado = t.status === "CANCELADO";
                  return (
                    <tr key={t.id} className={`hover:bg-[#151515] transition-colors ${isCancelado ? "opacity-40" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs font-bold text-[#E51E25]">{t.codigoIdentificador}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {new Date(t.data).toLocaleDateString("pt-BR")}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-rajdhani font-semibold text-white">
                          {t.unidadeOrigem.nome.replace("Own Barber Club ", "")}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">{t.contaOrigem.nome}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-rajdhani font-semibold text-white">
                          {t.unidadeDestino.nome.replace("Own Barber Club ", "")}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">{t.contaDestino.nome}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-gray-200 text-xs">{t.descricao}</div>
                        <div className="text-[10px] text-gray-500">Resp: {t.responsavel}</div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-rajdhani font-bold text-base text-white">
                        {formatter.format(t.valor)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                            isCancelado
                              ? "bg-red-950/40 border-red-500/40 text-red-400"
                              : "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {!isCancelado && (
                          <button
                            onClick={() =>
                              setModalCancelarId({
                                id: t.id,
                                tipo: "TRF",
                                nome: `Transferência ${t.codigoIdentificador} (${formatter.format(t.valor)})`,
                              })
                            }
                            className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                          >
                            Estornar Ambas
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {transferencias.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                      Nenhuma transferência entre unidades registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: CONTAS FINANCEIRAS */}
      {abaAtiva === "CONTAS" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#111] border border-[#222] p-4 rounded-sm">
            <div>
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider">
                Contas Financeiras Cadastradas
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Contas bancárias, caixas físicos e saldos de cartões da Own Barber Club
              </p>
            </div>
            <button
              onClick={() => setModalNovaContaAberto(true)}
              className="flex items-center gap-1.5 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-sm cursor-pointer"
            >
              <Plus size={14} /> Nova Conta Financeira
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contasFiltradasUnidade.map((c) => (
              <div key={c.id} className="bg-[#111] border border-[#222] p-4 rounded-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{c.tipo}</div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                    ATIVA
                  </span>
                </div>
                <h4 className="font-rajdhani font-bold text-white text-base leading-tight mb-1">{c.nome}</h4>
                <div className="text-xs text-gray-400 mb-3">{c.unidade.nome}</div>

                <div className="pt-3 border-t border-[#1F1F1F] flex justify-between items-baseline">
                  <span className="text-[10px] font-rajdhani text-gray-400 uppercase">Saldo Atual</span>
                  <span className="text-xl font-rajdhani font-bold text-white">{formatter.format(c.saldoAtual)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 4: CONCILIAÇÃO DIÁRIA DE CAIXA */}
      {abaAtiva === "CONCILIACAO" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#111] border border-[#222] p-4 rounded-sm">
            <div>
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider">
                Conciliação Diária de Caixa Físico
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Conferência do saldo físico contado no balcão vs saldo esperado no sistema
              </p>
            </div>
            <button
              onClick={() => {
                setFcEsperado(saldoDinheiroEspecie.toString());
                setModalFechamentoCaixaAberto(true);
              }}
              className="flex items-center gap-1.5 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-sm cursor-pointer"
            >
              <CheckCircle2 size={14} /> Realizar Conciliação do Dia
            </button>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#161616] border-b border-[#222]">
                <tr>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Unidade</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Saldo Esperado</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Contagem Física</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Diferença (Sobra/Falta)</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Justificativa / Resp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {fechamentosCaixa.map((fc) => (
                  <tr key={fc.id} className="hover:bg-[#151515] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-300">
                      {new Date(fc.data).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 font-rajdhani font-semibold text-white">
                      {fc.unidade.nome.replace("Own Barber Club ", "")}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">
                      {formatter.format(fc.saldoEsperadoDinheiro)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-white">
                      {formatter.format(fc.saldoContadoDinheiro)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold">
                      <span className={fc.diferencaDinheiro === 0 ? "text-emerald-400" : fc.diferencaDinheiro > 0 ? "text-blue-400" : "text-red-400"}>
                        {fc.diferencaDinheiro === 0
                          ? "EXATO (R$ 0,00)"
                          : fc.diferencaDinheiro > 0
                          ? `Sobra: +${formatter.format(fc.diferencaDinheiro)}`
                          : `Falta: ${formatter.format(fc.diferencaDinheiro)}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {fc.justificativa && <div className="text-gray-300 italic mb-0.5">&ldquo;{fc.justificativa}&rdquo;</div>}
                      <div className="text-[10px] text-gray-500 font-mono">Por: {fc.responsavel}</div>
                    </td>
                  </tr>
                ))}

                {fechamentosCaixa.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                      Nenhuma conciliação diária de caixa físico registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MOVIMENTAÇÃO */}
      {modalMovAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl">
            <button onClick={() => setModalMovAberto(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-4">
              Nova Movimentação Financeira
            </h3>

            {formError && <div className="p-3 mb-3 bg-red-950/40 border border-red-500/50 text-red-400 text-xs rounded">{formError}</div>}

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMovTipo("ENTRADA")}
                  className={`p-2.5 text-xs font-rajdhani uppercase font-bold rounded-sm border ${
                    movTipo === "ENTRADA" ? "bg-emerald-600 border-emerald-500 text-white" : "border-[#333] text-gray-400"
                  }`}
                >
                  🟢 Entrada de Caixa
                </button>
                <button
                  type="button"
                  onClick={() => setMovTipo("SAIDA")}
                  className={`p-2.5 text-xs font-rajdhani uppercase font-bold rounded-sm border ${
                    movTipo === "SAIDA" ? "bg-red-600 border-red-500 text-white" : "border-[#333] text-gray-400"
                  }`}
                >
                  🔴 Saída / Pagamento
                </button>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Conta Financeira</label>
                <select
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={movContaId}
                  onChange={(e) => setMovContaId(e.target.value)}
                >
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.unidade.nome})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-base"
                    value={movValor}
                    onChange={(e) => setMovValor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Data Efetiva</label>
                  <input
                    type="date"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={movDataMov}
                    onChange={(e) => setMovDataMov(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Compra de café, Pagamento fornecedor toalhas..."
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={movDescricao}
                  onChange={(e) => setMovDescricao(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Produtos, Aluguel, Bebidas"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={movCategoria}
                    onChange={(e) => setMovCategoria(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Forma de Pagamento</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={movForma}
                    onChange={(e) => setMovForma(e.target.value)}
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="DEBITO">Débito</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TRANSFERENCIA">Transferência</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setModalMovAberto(false)}
                  className="px-4 py-2 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarMovimentacao}
                  disabled={isPending}
                  className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2.5 rounded-sm"
                >
                  Salvar Movimentação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERÊNCIA ENTRE UNIDADES */}
      {modalTrfAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl">
            <button onClick={() => setModalTrfAberto(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-2">
              Transferência entre Unidades
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Circulação interna de recursos entre caixas e contas do grupo.
            </p>

            {formError && <div className="p-3 mb-3 bg-red-950/40 border border-red-500/50 text-red-400 text-xs rounded">{formError}</div>}

            <div className="flex flex-col gap-3">
              {/* Origem */}
              <div className="p-3 bg-[#161616] border border-[#262626] rounded-sm">
                <div className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-2">
                  CONTA DE ORIGEM (SAÍDA)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-400 block mb-1">Unidade</label>
                    <select
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs"
                      value={trfUnidOrigem}
                      onChange={(e) => {
                        setTrfUnidOrigem(e.target.value);
                        setTrfContaOrigem("");
                      }}
                    >
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-400 block mb-1">Conta</label>
                    <select
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs"
                      value={trfContaOrigem}
                      onChange={(e) => setTrfContaOrigem(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {contas
                        .filter((c) => c.unidadeId === trfUnidOrigem)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome} ({formatter.format(c.saldoAtual)})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Destino */}
              <div className="p-3 bg-[#161616] border border-[#262626] rounded-sm">
                <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-2">
                  CONTA DE DESTINO (ENTRADA)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-400 block mb-1">Unidade</label>
                    <select
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs"
                      value={trfUnidDestino}
                      onChange={(e) => {
                        setTrfUnidDestino(e.target.value);
                        setTrfContaDestino("");
                      }}
                    >
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-rajdhani text-gray-400 block mb-1">Conta</label>
                    <select
                      className="w-full bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs"
                      value={trfContaDestino}
                      onChange={(e) => setTrfContaDestino(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {contas
                        .filter((c) => c.unidadeId === trfUnidDestino)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-base"
                    value={trfValor}
                    onChange={(e) => setTrfValor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={trfData}
                    onChange={(e) => setTrfData(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Motivo / Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Suporte de caixa para reformas da unidade..."
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={trfDescricao}
                  onChange={(e) => setTrfDescricao(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setModalTrfAberto(false)}
                  className="px-4 py-2 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarTransferencia}
                  disabled={isPending}
                  className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2.5 rounded-sm"
                >
                  Realizar Transferência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPENSAR CARTÃO */}
      {modalCompensarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-md rounded-sm p-6 relative shadow-2xl">
            <button onClick={() => setModalCompensarAberto(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-2">
              Compensação de Cartões
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Transfere saldo de Cartões a Receber diretamente para a Conta Bancária.
            </p>
            <div className="p-2.5 mb-4 bg-indigo-950/40 border border-indigo-700/50 rounded text-xs text-indigo-300">
              <span className="font-bold">ℹ️ Transferência Interna:</span> Esta operação move o saldo entre contas da sua própria empresa. <strong className="text-white font-semibold">Não é gerada nenhuma despesa operacional</strong>.
            </div>

            {formError && <div className="p-3 mb-3 bg-red-950/40 border border-red-500/50 text-red-400 text-xs rounded">{formError}</div>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">
                  Conta de Cartões (Origem)
                </label>
                <select
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={cmpContaCartao}
                  onChange={(e) => setCmpContaCartao(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {contas
                    .filter((c) => c.tipo === "CARTOES_RECEBER")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} - Saldo a Receber: {formatter.format(c.saldoAtual)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">
                  Conta Bancária de Destino
                </label>
                <select
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={cmpContaBanco}
                  onChange={(e) => setCmpContaBanco(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {contas
                    .filter((c) => c.tipo === "BANCARIA" || c.tipo === "PIX")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.unidade.nome})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Valor Bruto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-sm"
                    value={cmpValorBruto}
                    onChange={(e) => setCmpValorBruto(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Taxa Maquininha (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-sm text-red-400"
                    value={cmpTaxa}
                    onChange={(e) => setCmpTaxa(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-[#161616] border border-[#262626] rounded-sm text-xs flex justify-between items-center">
                <span className="text-gray-400 font-rajdhani uppercase">Crédito Líquido no Banco:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatter.format(Math.max(0, (parseFloat(cmpValorBruto) || 0) - (parseFloat(cmpTaxa) || 0)))}
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setModalCompensarAberto(false)}
                  className="px-4 py-2 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarCompensacao}
                  disabled={isPending}
                  className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2.5 rounded-sm"
                >
                  Confirmar Compensação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONCILIAÇÃO DIÁRIA DE CAIXA FÍSICO */}
      {modalFechamentoCaixaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] w-full max-w-md rounded-sm p-6 relative shadow-2xl">
            <button onClick={() => setModalFechamentoCaixaAberto(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-2">
              Conciliação Diária de Caixa
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Contagem física do dinheiro em espécie na gaveta da unidade.
            </p>

            {formError && <div className="p-3 mb-3 bg-red-950/40 border border-red-500/50 text-red-400 text-xs rounded">{formError}</div>}

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2 rounded-sm text-sm"
                    value={fcData}
                    onChange={(e) => setFcData(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Saldo Esperado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-gray-300 p-2 rounded-sm font-mono text-sm"
                    value={fcEsperado}
                    onChange={(e) => setFcEsperado(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">
                  Saldo Contado Fisicamente (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm font-mono text-base focus:border-[#E51E25]"
                  value={fcContado}
                  onChange={(e) => setFcContado(e.target.value)}
                />
              </div>

              {/* Diferença Apurada */}
              <div className={`p-3 rounded-sm border ${diferencaContagem === 0 ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" : "bg-amber-950/40 border-amber-500/50 text-amber-400"}`}>
                <div className="text-xs font-rajdhani uppercase font-bold flex justify-between">
                  <span>Diferença Apurada:</span>
                  <span className="font-mono text-sm">
                    {diferencaContagem === 0
                      ? "R$ 0,00 (Caixa Exato)"
                      : diferencaContagem > 0
                      ? `+${formatter.format(diferencaContagem)} (Sobra)`
                      : `${formatter.format(diferencaContagem)} (Falta)`}
                  </span>
                </div>
                {Math.abs(diferencaContagem) > 0.01 && (
                  <div className="mt-2">
                    <label className="text-[10px] font-mono uppercase text-amber-400 block mb-1">
                      Justificativa Obrigatória da Diferença:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Troco errado informado pelo operador, sobra de sangria..."
                      className="w-full bg-[#1C1C1C] border border-amber-600/40 text-white p-1.5 rounded-sm text-xs"
                      value={fcJustificativa}
                      onChange={(e) => setFcJustificativa(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setModalFechamentoCaixaAberto(false)}
                  className="px-4 py-2 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarFechamentoCaixa}
                  disabled={isPending}
                  className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2.5 rounded-sm"
                >
                  Concluir Conciliação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO */}
      {modalCancelarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-red-500/50 w-full max-w-md rounded-sm p-6 relative shadow-2xl">
            <div className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-1 flex items-center gap-1.5">
              <ShieldAlert size={14} /> SEGURANÇA E AUDITORIA
            </div>
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-2">
              Cancelar Lançamento Financeiro
            </h3>
            <p className="text-xs text-gray-300 mb-3">
              Item: <span className="font-semibold text-white">{modalCancelarId.nome}</span>
            </p>
            <p className="text-[11px] text-gray-400 mb-4">
              Por regra de segurança, nenhuma movimentação é excluída definitivamente. O cancelamento ficará registrado no histórico e reverterá o saldo correspondente.
            </p>

            <div className="mb-4">
              <label className="text-[11px] font-rajdhani uppercase text-red-400 font-bold block mb-1">
                Motivo / Justificativa do Cancelamento (Obrigatório)
              </label>
              <textarea
                rows={3}
                placeholder="Informe detalhadamente por que este lançamento está sendo cancelado..."
                className="w-full bg-[#1C1C1C] border border-[#444] text-white p-2.5 rounded-sm text-xs focus:outline-none focus:border-red-500"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
              ></textarea>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalCancelarId(null)}
                className="px-4 py-2 text-xs font-rajdhani uppercase text-gray-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarCancelamento}
                disabled={isPending || !motivoCancelamento.trim()}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2 rounded-sm"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
