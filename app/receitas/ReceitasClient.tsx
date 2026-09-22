"use client";

import { useState, useTransition } from "react";
import { ArrowRight, DollarSign, Activity, Wallet, Calendar, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { salvarLancamentoReceita } from "./actions";

interface FuncionarioItem {
  id: string;
  nome: string;
  comissaoAvulsa: number;
  comissaoAssinatura: number;
  unidadeId: string;
}

interface LancamentoItem {
  id: string;
  tipo: string;
  valorComissao: number;
  faturamentoCadeira: number;
  formaPagamento: string;
  data: Date | string;
  observacao?: string | null;
  funcionario: {
    nome: string;
  };
}

export default function ReceitasClient({
  barbeiros,
  ultimosLancamentos,
}: {
  barbeiros: FuncionarioItem[];
  ultimosLancamentos: LancamentoItem[];
}) {
  const [barbeiroId, setBarbeiroId] = useState("");
  const [tipo, setTipo] = useState<"AVULSO" | "ASSINATURA">("AVULSO");
  const [comissao, setComissao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<"PIX" | "DINHEIRO" | "DEBITO" | "CREDITO">("PIX");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [obs, setObs] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const barbeiroSelecionado = barbeiros.find((b) => b.id === barbeiroId);
  const percentual = barbeiroSelecionado
    ? tipo === "AVULSO"
      ? barbeiroSelecionado.comissaoAvulsa
      : barbeiroSelecionado.comissaoAssinatura
    : 0;

  const valorComissaoNum = parseFloat(comissao.replace(",", ".")) || 0;
  const faturamentoCadeira = percentual > 0 ? valorComissaoNum / (percentual / 100) : 0;

  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const handleSalvar = () => {
    setFeedback(null);

    if (!barbeiroId) {
      setFeedback({ type: "error", message: "Selecione o barbeiro para continuar." });
      return;
    }

    if (valorComissaoNum <= 0) {
      setFeedback({ type: "error", message: "Informe um valor de comissão válido." });
      return;
    }

    startTransition(async () => {
      const res = await salvarLancamentoReceita({
        funcionarioId: barbeiroId,
        tipo,
        valorComissao: valorComissaoNum,
        formaPagamento,
        data,
        observacao: obs,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Lançamento de ${formatter.format(valorComissaoNum)} registrado com sucesso!`,
        });
        setComissao("");
        setObs("");
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Não foi possível salvar o lançamento.",
        });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Coluna da Esquerda: Formulário (5 colunas) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#111] border border-[#222] rounded-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <DollarSign size={60} />
          </div>
          
          <h2 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#E51E25] inline-block"></span>
            Lançar Faturamento
          </h2>

          {feedback && (
            <div
              className={`p-3 mb-5 rounded-sm border flex items-center gap-2 text-sm font-rajdhani ${
                feedback.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                  : "bg-red-950/40 border-red-500/50 text-red-400"
              }`}
            >
              {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex flex-col gap-5">
            {/* Seleção do Barbeiro */}
            <div>
              <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 block">
                Piloto / Cadeira
              </label>
              <select
                className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 rounded-sm focus:outline-none focus:border-[#E51E25] font-medium cursor-pointer"
                value={barbeiroId}
                onChange={(e) => setBarbeiroId(e.target.value)}
              >
                <option value="">Selecione o barbeiro...</option>
                {barbeiros.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} (Av: {b.comissaoAvulsa}% | Ass: {b.comissaoAssinatura}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Serviço */}
            <div>
              <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 block">
                Tipo de Serviço
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo("AVULSO")}
                  className={`p-3 text-sm font-rajdhani font-bold uppercase tracking-wider rounded-sm border transition-all cursor-pointer ${
                    tipo === "AVULSO"
                      ? "bg-[#E51E25] border-[#E51E25] text-white shadow-[0_0_10px_rgba(229,30,37,0.3)]"
                      : "bg-transparent border-[#333] text-gray-400 hover:border-[#555]"
                  }`}
                >
                  Avulso
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("ASSINATURA")}
                  className={`p-3 text-sm font-rajdhani font-bold uppercase tracking-wider rounded-sm border transition-all cursor-pointer ${
                    tipo === "ASSINATURA"
                      ? "bg-[#E51E25] border-[#E51E25] text-white shadow-[0_0_10px_rgba(229,30,37,0.3)]"
                      : "bg-transparent border-[#333] text-gray-400 hover:border-[#555]"
                  }`}
                >
                  Assinatura
                </button>
              </div>
            </div>

            {/* Valor da Comissão */}
            <div>
              <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 block">
                Valor da Comissão (R$)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</div>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 pl-10 rounded-sm focus:outline-none focus:border-[#E51E25] font-mono text-lg"
                  placeholder="0.00"
                  value={comissao}
                  onChange={(e) => setComissao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSalvar();
                  }}
                />
              </div>
            </div>

            {/* Módulo de Cálculo (Telemetria) */}
            <div
              className={`mt-1 bg-gradient-to-br from-[#1a1a1a] to-[#111] border-l-2 border-[#E51E25] p-4 transition-all ${
                !barbeiroSelecionado || valorComissaoNum <= 0 ? "opacity-40 grayscale pointer-events-none" : ""
              }`}
            >
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase mb-3 flex items-center gap-2">
                <Activity size={12} /> CÁLCULO DE TELEMETRIA
              </div>

              <div className="flex justify-between items-center mb-1 text-sm text-gray-400">
                <span>Comissão Informada</span>
                <span className="font-mono text-white">{formatter.format(valorComissaoNum)}</span>
              </div>
              <div className="flex justify-between items-center mb-3 text-sm text-gray-400">
                <span>Percentual da Cadeira</span>
                <span className="font-mono text-white">
                  {percentual}% ({tipo})
                </span>
              </div>

              <div className="h-[1px] bg-[#333] w-full mb-3"></div>

              <div className="flex justify-between items-center">
                <span className="font-rajdhani font-bold text-gray-200 uppercase tracking-wide">Faturamento da Cadeira</span>
                <span className="font-rajdhani font-bold text-2xl text-emerald-500 tracking-tight">
                  {formatter.format(faturamentoCadeira)}
                </span>
              </div>
            </div>

            {/* Forma de Pagamento e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Wallet size={12} /> Pagamento
                </label>
                <select
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm cursor-pointer"
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO")}
                >
                  <option value="PIX">Pix</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="DEBITO">Débito</option>
                  <option value="CREDITO">Crédito</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Data
                </label>
                <input
                  type="date"
                  className="w-full bg-[#1A1A1A] border border-[#333] text-gray-300 p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="text-xs font-rajdhani text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <FileText size={12} /> Observação (Opcional)
              </label>
              <input
                type="text"
                className="w-full bg-[#1A1A1A] border border-[#333] text-gray-300 p-3 rounded-sm focus:outline-none focus:border-[#E51E25] text-sm"
                placeholder="Ex: Pagamento referente a combo"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={handleSalvar}
              disabled={isPending}
              className="mt-2 w-full bg-[#E51E25] hover:bg-red-700 disabled:opacity-60 text-white font-rajdhani font-bold uppercase tracking-widest p-4 rounded-sm flex justify-center items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(229,30,37,0.2)]"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> REGISTRANDO TELEMETRIA...
                </>
              ) : (
                <>
                  SALVAR REGISTRO <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Coluna da Direita: Histórico (7 colunas) */}
      <div className="lg:col-span-7">
        <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden h-full flex flex-col">
          <div className="p-5 border-b border-[#222] flex justify-between items-center bg-[#161616]">
            <h3 className="font-rajdhani font-bold text-gray-200 uppercase tracking-wider text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E51E25] animate-pulse"></span>
              Últimos Faturamentos
            </h3>
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest">
              {ultimosLancamentos.length} registros
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#1A1A1A] border-b border-[#222]">
                <tr>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Data
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">
                    Piloto / Cadeira
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">
                    Tipo
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">
                    Forma
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                    Comissão
                  </th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">
                    Fat. Cadeira
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {ultimosLancamentos.map((r) => (
                  <tr key={r.id} className="hover:bg-[#151515] transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                      {new Date(r.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </td>
                    <td className="px-5 py-3 text-gray-200 font-medium">
                      <div>{r.funcionario.nome}</div>
                      {r.observacao && <div className="text-[10px] text-gray-500 italic">{r.observacao}</div>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border ${
                          r.tipo === "AVULSO"
                            ? "bg-[#1a1a1a] border-[#333] text-gray-300"
                            : "bg-[#E51E25]/10 border-[#E51E25]/30 text-[#E51E25]"
                        }`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-[10px] font-mono text-gray-400 bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626]">
                        {r.formaPagamento}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">
                      {formatter.format(r.valorComissao)}
                    </td>
                    <td className="px-5 py-3 text-right font-rajdhani font-bold text-emerald-500">
                      {formatter.format(r.faturamentoCadeira)}
                    </td>
                  </tr>
                ))}
                {ultimosLancamentos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500 font-rajdhani text-sm">
                      Nenhum lançamento registrado nesta unidade.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
