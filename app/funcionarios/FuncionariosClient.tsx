"use client";

import { useState, useTransition } from "react";
import { Users, Plus, Edit2, CheckCircle, XCircle, Search, Percent, MapPin, Phone, Loader2, X } from "lucide-react";
import { criarFuncionario, atualizarFuncionario, alternarStatusFuncionario, FuncionarioInput } from "./actions";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface FuncionarioComStats {
  id: string;
  nome: string;
  telefone: string | null;
  foto: string | null;
  comissaoAvulsa: number;
  comissaoAssinatura: number;
  ativo: boolean;
  unidadeId: string;
  unidade: {
    id: string;
    nome: string;
  };
  _count: {
    receitas: number;
  };
  totalFaturado: number;
}

export default function FuncionariosClient({
  funcionarios,
  unidades,
  unidadeAtualId,
}: {
  funcionarios: FuncionarioComStats[];
  unidades: UnidadeItem[];
  unidadeAtualId: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [modalAberto, setModalAberto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [unidadeId, setUnidadeId] = useState(unidadeAtualId !== "GLOBAL" ? unidadeAtualId : unidades[0]?.id || "");
  const [comissaoAvulsa, setComissaoAvulsa] = useState("45");
  const [comissaoAssinatura, setComissaoAssinatura] = useState("35");
  const [formError, setFormError] = useState("");

  const [isPending, startTransition] = useTransition();

  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const abrirModalNovo = () => {
    setEditingId(null);
    setNome("");
    setTelefone("");
    setUnidadeId(unidadeAtualId !== "GLOBAL" ? unidadeAtualId : unidades[0]?.id || "");
    setComissaoAvulsa("45");
    setComissaoAssinatura("35");
    setFormError("");
    setModalAberto(true);
  };

  const abrirModalEdicao = (f: FuncionarioComStats) => {
    setEditingId(f.id);
    setNome(f.nome);
    setTelefone(f.telefone || "");
    setUnidadeId(f.unidadeId);
    setComissaoAvulsa(f.comissaoAvulsa.toString());
    setComissaoAssinatura(f.comissaoAssinatura.toString());
    setFormError("");
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditingId(null);
  };

  const handleSalvar = () => {
    setFormError("");

    if (!nome.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }

    const avulsaNum = parseFloat(comissaoAvulsa);
    const assinaturaNum = parseFloat(comissaoAssinatura);

    if (isNaN(avulsaNum) || avulsaNum < 0 || avulsaNum > 100) {
      setFormError("Comissão avulsa inválida (0-100%).");
      return;
    }

    if (isNaN(assinaturaNum) || assinaturaNum < 0 || assinaturaNum > 100) {
      setFormError("Comissão assinatura inválida (0-100%).");
      return;
    }

    const payload: FuncionarioInput = {
      nome: nome.trim(),
      telefone: telefone.trim() || undefined,
      comissaoAvulsa: avulsaNum,
      comissaoAssinatura: assinaturaNum,
      unidadeId,
    };

    startTransition(async () => {
      const res = editingId
        ? await atualizarFuncionario(editingId, payload)
        : await criarFuncionario(payload);

      if (res.success) {
        fecharModal();
      } else {
        setFormError(res.error || "Erro ao salvar piloto.");
      }
    });
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      await alternarStatusFuncionario(id, !currentStatus);
    });
  };

  // Filtragem
  const filtrados = funcionarios.filter((f) => {
    const matchBusca =
      f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      f.unidade.nome.toLowerCase().includes(busca.toLowerCase());

    const matchStatus =
      filtroStatus === "TODOS" ||
      (filtroStatus === "ATIVO" && f.ativo) ||
      (filtroStatus === "INATIVO" && !f.ativo);

    return matchBusca && matchStatus;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* BARRA DE CONTROLE / FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-[#111] border border-[#222] p-4 rounded-sm">
        <div className="flex items-center gap-3 flex-1 max-w-md bg-[#161616] border border-[#333] px-3 py-2 rounded-sm focus-within:border-[#E51E25]">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Buscar piloto ou unidade..."
            className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-full font-medium"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-sm border border-[#333] bg-[#161616] p-1">
            <button
              onClick={() => setFiltroStatus("TODOS")}
              className={`px-3 py-1 text-xs font-rajdhani uppercase font-semibold rounded-sm transition-all ${
                filtroStatus === "TODOS" ? "bg-[#E51E25] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Todos ({funcionarios.length})
            </button>
            <button
              onClick={() => setFiltroStatus("ATIVO")}
              className={`px-3 py-1 text-xs font-rajdhani uppercase font-semibold rounded-sm transition-all ${
                filtroStatus === "ATIVO" ? "bg-[#E51E25] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Em Pista ({funcionarios.filter((f) => f.ativo).length})
            </button>
            <button
              onClick={() => setFiltroStatus("INATIVO")}
              className={`px-3 py-1 text-xs font-rajdhani uppercase font-semibold rounded-sm transition-all ${
                filtroStatus === "INATIVO" ? "bg-[#E51E25] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              No Box ({funcionarios.filter((f) => !f.ativo).length})
            </button>
          </div>

          <button
            onClick={abrirModalNovo}
            className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-sm uppercase tracking-wider px-4 py-2.5 rounded-sm transition-all shadow-[0_0_12px_rgba(229,30,37,0.25)] cursor-pointer"
          >
            <Plus size={16} /> Novo Piloto
          </button>
        </div>
      </div>

      {/* GRID DE PILOTOS / BARBEIROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtrados.map((f, idx) => {
          const initials = f.nome
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div
              key={f.id}
              className={`bg-[#111] border rounded-sm p-5 relative overflow-hidden transition-all flex flex-col justify-between group ${
                f.ativo ? "border-[#222] hover:border-[#444]" : "border-[#222] opacity-60 grayscale"
              }`}
            >
              {/* Linha superior colorida */}
              <div
                className={`absolute top-0 left-0 w-full h-[2px] ${
                  f.ativo ? "bg-gradient-to-r from-[#E51E25] to-transparent" : "bg-gray-700"
                }`}
              ></div>

              <div>
                {/* Header do Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#1A1A1A] border border-[#333] flex items-center justify-center font-rajdhani font-bold text-lg text-white group-hover:border-[#E51E25] transition-colors">
                      {initials}
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase">
                        PILOTO P{String(idx + 1).padStart(2, "0")}
                      </div>
                      <h3 className="font-rajdhani font-bold text-lg text-white uppercase tracking-wide leading-tight">
                        {f.nome}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <MapPin size={12} className="text-gray-500" />
                        <span>Unidade {f.unidade.nome}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border uppercase flex items-center gap-1 ${
                      f.ativo
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        f.ativo ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
                      }`}
                    ></span>
                    {f.ativo ? "Em Pista" : "No Box"}
                  </span>
                </div>

                {/* Telemetria de Comissões */}
                <div className="grid grid-cols-2 gap-3 mb-4 bg-[#161616] p-3 rounded-sm border border-[#262626]">
                  <div>
                    <div className="text-[10px] font-rajdhani uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      <Percent size={10} className="text-[#E51E25]" /> Avulso
                    </div>
                    <div className="text-xl font-rajdhani font-bold text-white mt-0.5">
                      {f.comissaoAvulsa}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-rajdhani uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      <Percent size={10} className="text-[#E51E25]" /> Assinatura
                    </div>
                    <div className="text-xl font-rajdhani font-bold text-white mt-0.5">
                      {f.comissaoAssinatura}%
                    </div>
                  </div>
                </div>

                {/* Métricas de Histórico */}
                <div className="flex justify-between items-center text-xs text-gray-400 border-t border-[#1F1F1F] pt-3 mb-4">
                  <div>
                    <span className="text-gray-500">Lançamentos:</span>{" "}
                    <span className="font-mono text-gray-200">{f._count.receitas}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Fat. Cadeira:</span>{" "}
                    <span className="font-mono font-semibold text-emerald-400">
                      {formatter.format(f.totalFaturado)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#1F1F1F]">
                <button
                  onClick={() => abrirModalEdicao(f)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] hover:border-[#555] text-gray-300 hover:text-white text-xs font-rajdhani uppercase font-semibold py-2 rounded-sm transition-all cursor-pointer"
                >
                  <Edit2 size={13} /> Ajustar Piloto
                </button>
                <button
                  onClick={() => handleToggleStatus(f.id, f.ativo)}
                  disabled={isPending}
                  title={f.ativo ? "Desativar piloto (colocar no box)" : "Ativar piloto (colocar na pista)"}
                  className={`p-2 rounded-sm border transition-all cursor-pointer ${
                    f.ativo
                      ? "bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/40"
                      : "bg-emerald-950/20 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/40"
                  }`}
                >
                  {f.ativo ? <XCircle size={15} /> : <CheckCircle size={15} />}
                </button>
              </div>
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div className="col-span-full py-16 text-center bg-[#111] border border-[#222] rounded-sm">
            <Users size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="font-rajdhani uppercase font-bold text-gray-400 text-base">
              Nenhum piloto encontrado
            </p>
            <p className="text-xs text-gray-600 mt-1">Tente ajustar a busca ou filtro de status.</p>
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-[#333] w-full max-w-lg rounded-sm p-6 relative shadow-2xl">
            {/* Fechar */}
            <button
              onClick={fecharModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Cabeçalho Modal */}
            <div className="mb-6">
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase">
                {editingId ? "TELEMETRIA DO PILOTO" : "NOVO INTEGRANTE DO GRID"}
              </div>
              <h2 className="text-2xl font-rajdhani font-bold text-white uppercase tracking-wide">
                {editingId ? "Ajustar Dados do Barbeiro" : "Cadastrar Barbeiro"}
              </h2>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-sm border bg-red-950/40 border-red-500/50 text-red-400 text-sm font-rajdhani">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Unidade de Atuação
                  </label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm cursor-pointer"
                    value={unidadeId}
                    onChange={(e) => setUnidadeId(e.target.value)}
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unidade {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-[#161616] border border-[#262626] rounded-sm">
                <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase mb-3">
                  CONFIGURAÇÃO DE COMISSIONAMENTO
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-rajdhani text-gray-300 uppercase tracking-wider mb-1 block">
                      Comissão Avulsa (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 pr-8 rounded-sm focus:outline-none focus:border-[#E51E25] font-mono text-base"
                        value={comissaoAvulsa}
                        onChange={(e) => setComissaoAvulsa(e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-rajdhani text-gray-300 uppercase tracking-wider mb-1 block">
                      Comissão Assinatura (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 pr-8 rounded-sm focus:outline-none focus:border-[#E51E25] font-mono text-base"
                        value={comissaoAssinatura}
                        onChange={(e) => setComissaoAssinatura(e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2.5 text-xs font-rajdhani uppercase font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="flex items-center gap-2 bg-[#E51E25] hover:bg-red-700 disabled:opacity-60 text-white font-rajdhani font-bold text-sm uppercase tracking-wider px-6 py-2.5 rounded-sm transition-all cursor-pointer shadow-[0_0_12px_rgba(229,30,37,0.3)]"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> SALVANDO...
                    </>
                  ) : (
                    <>CONFIRMAR REGISTRO</>
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
