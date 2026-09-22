"use client";

import { useState, useTransition } from "react";
import { Landmark, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Sparkles, Plus, X, Loader2, ArrowRight } from "lucide-react";
import { processarUploadExtrato, confirmarConciliacaoExtrato, criarRegraClassificacao, LinhaConfirmacaoItem } from "./actions";

interface UnidadeItem {
  id: string;
  nome: string;
}

interface ContaItem {
  id: string;
  nome: string;
  unidadeId: string;
  tipo: string;
}

interface RegraItem {
  id: string;
  padraoTexto: string;
  categoria: string;
  tipoMovimento: string;
  vezesAplicada: number;
}

interface ImportacaoItem {
  id: string;
  arquivoNome: string;
  formato: string;
  banco: string | null;
  periodoInicio: Date | string | null;
  periodoFim: Date | string | null;
  totalTransacoes: number;
  totalCreditos: number;
  totalDebitos: number;
  status: string;
  responsavel: string;
  createdAt: Date | string;
  unidade: { nome: string };
  conta: { nome: string };
  linhas: {
    id: string;
    fitid: string | null;
    data: Date | string;
    descricaoOriginal: string;
    documento: string | null;
    valor: number;
    tipo: string;
    categoriaSugerida: string | null;
    confiancaSugestao: number | null;
    categoriaConfirmada: string | null;
    status: string;
  }[];
}

export default function ExtratosClient({
  unidades,
  contas,
  importacoes,
  regrasIniciais,
  unidadeAtualId,
}: {
  unidades: UnidadeItem[];
  contas: ContaItem[];
  importacoes: ImportacaoItem[];
  regrasIniciais: RegraItem[];
  unidadeAtualId: string;
}) {
  const [abaAtiva, setAbaAtiva] = useState<"IMPORTAR" | "CONFERENCIA" | "REGRAS" | "HISTORICO">("IMPORTAR");
  const [unidadeId, setUnidadeId] = useState(unidadeAtualId !== "GLOBAL" ? unidadeAtualId : unidades[0]?.id || "");
  const [contaId, setContaId] = useState("");
  const [banco, setBanco] = useState("Itaú");
  const [arquivoTexto, setArquivoTexto] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [formato, setFormato] = useState<"OFX" | "CSV">("OFX");
  const [importacaoAtiva, setImportacaoAtiva] = useState<ImportacaoItem | null>(null);

  // Estados da Tela de Conferência
  const [linhasEditadas, setLinhasEditadas] = useState<Record<string, { categoria: string; favorecido: string; status: "CONCILIADO" | "IGNORADO"; justificativa: string }>>({});

  // Regras
  const [regras, setRegras] = useState(regrasIniciais);
  const [novoPadrao, setNovoPadrao] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoTipo, setNovoTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const contasBancarias = contas.filter((c) => c.tipo === "BANCARIA" || c.tipo === "PIX");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ofx") setFormato("OFX");
    else setFormato("CSV");

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setArquivoTexto(content || "");
    };
    reader.readAsText(file, "ISO-8859-1"); // Padrão comum em extratos bancários brasileiros
  };

  const handleProcessarArquivo = () => {
    setFormError("");
    if (!unidadeId) return setFormError("Selecione a unidade.");
    if (!contaId) return setFormError("Selecione a conta bancária.");
    if (!arquivoTexto.trim()) return setFormError("Selecione um arquivo de extrato válido.");

    startTransition(async () => {
      const res = await processarUploadExtrato(
        arquivoTexto,
        nomeArquivo,
        formato,
        unidadeId,
        contaId,
        banco,
        "Administrador"
      );

      if (res.success && res.data) {
        setImportacaoAtiva(res.data as unknown as ImportacaoItem);
        // Inicializar estado das linhas
        const inicial: Record<string, { categoria: string; favorecido: string; status: "CONCILIADO" | "IGNORADO"; justificativa: string }> = {};
        res.data.linhas.forEach((l) => {
          inicial[l.id] = {
            categoria: l.categoriaSugerida || (l.tipo === "CREDITO" ? "Outras Receitas" : "Despesas Gerais"),
            favorecido: "",
            status: l.status === "DUPLICADO" ? "IGNORADO" : "CONCILIADO",
            justificativa: l.status === "DUPLICADO" ? "Lançamento duplicado identificado pelo sistema." : "",
          };
        });
        setLinhasEditadas(inicial);
        setAbaAtiva("CONFERENCIA");
      } else {
        setFormError(res.error || "Erro ao processar arquivo de extrato.");
      }
    });
  };

  const handleConfirmarConciliacao = () => {
    if (!importacaoAtiva) return;

    const payload: LinhaConfirmacaoItem[] = Object.entries(linhasEditadas).map(([id, info]) => ({
      id,
      categoriaConfirmada: info.categoria,
      favorecidoConfirmado: info.favorecido.trim() || undefined,
      status: info.status,
      justificativaIgnorado: info.justificativa.trim() || undefined,
    }));

    startTransition(async () => {
      const res = await confirmarConciliacaoExtrato(importacaoAtiva.id, payload, "Administrador");
      if (res.success) {
        setImportacaoAtiva(null);
        setAbaAtiva("HISTORICO");
      } else {
        setFormError(res.error || "Falha ao consolidar extrato.");
      }
    });
  };

  const handleCriarRegra = () => {
    if (!novoPadrao.trim() || !novaCategoria.trim()) return;

    startTransition(async () => {
      const res = await criarRegraClassificacao(novoPadrao, novaCategoria, novoTipo, "Administrador");
      if (res.success && res.data) {
        setRegras([...regras, res.data]);
        setNovoPadrao("");
        setNovaCategoria("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex border-b border-[#222] gap-1">
        <button
          onClick={() => setAbaAtiva("IMPORTAR")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "IMPORTAR" ? "border-[#E51E25] text-white bg-[#141414]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Importar Novo Extrato
        </button>

        {importacaoAtiva && (
          <button
            onClick={() => setAbaAtiva("CONFERENCIA")}
            className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              abaAtiva === "CONFERENCIA" ? "border-[#E51E25] text-white bg-[#141414]" : "border-transparent text-amber-400 hover:text-white"
            }`}
          >
            <Sparkles size={13} /> Conferência Ativa ({importacaoAtiva.totalTransacoes} transações)
          </button>
        )}

        <button
          onClick={() => setAbaAtiva("REGRAS")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "REGRAS" ? "border-[#E51E25] text-white bg-[#141414]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Regras Inteligentes ({regras.length})
        </button>

        <button
          onClick={() => setAbaAtiva("HISTORICO")}
          className={`px-5 py-3 text-xs font-rajdhani font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            abaAtiva === "HISTORICO" ? "border-[#E51E25] text-white bg-[#141414]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Histórico de Importações ({importacoes.length})
        </button>
      </div>

      {/* ABA 1: IMPORTAR EXTRATO */}
      {abaAtiva === "IMPORTAR" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#111] border border-[#222] p-6 rounded-sm">
            <h3 className="text-xl font-rajdhani font-bold text-white uppercase tracking-wider mb-2">
              Importação Segura de Extrato Bancário
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              O sistema lê automaticamente arquivos OFX e CSV, identifica todas as entradas e saídas e sugere categorias com base em regras de aprendizado.
            </p>

            {formError && <div className="p-3 mb-4 bg-red-950/40 border border-red-500/50 text-red-400 text-xs rounded">{formError}</div>}

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Unidade</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={unidadeId}
                    onChange={(e) => {
                      setUnidadeId(e.target.value);
                      setContaId("");
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
                  <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Conta Bancária Correspondente</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                  >
                    <option value="">Selecione a conta...</option>
                    {contasBancarias
                      .filter((c) => c.unidadeId === unidadeId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-rajdhani uppercase text-gray-400 block mb-1">Instituição Bancária</label>
                <select
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white p-2.5 rounded-sm text-sm"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                >
                  <option value="Itaú">Itaú Unibanco</option>
                  <option value="Bradesco">Banco Bradesco</option>
                  <option value="Santander">Banco Santander</option>
                  <option value="Banco do Brasil">Banco do Brasil</option>
                  <option value="Nubank">Nubank</option>
                  <option value="Inter">Banco Inter</option>
                  <option value="Sicredi">Sicredi</option>
                  <option value="Sicoob">Sicoob</option>
                  <option value="C6 Bank">C6 Bank</option>
                  <option value="Outro">Outro Banco</option>
                </select>
              </div>

              {/* Área de Upload de Arquivo */}
              <div className="border-2 border-dashed border-[#333] hover:border-[#E51E25] transition-colors p-8 rounded-sm text-center bg-[#141414] cursor-pointer">
                <input
                  type="file"
                  id="fileExtrato"
                  accept=".ofx,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label htmlFor="fileExtrato" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload size={32} className="text-[#E51E25]" />
                  <span className="font-rajdhani font-bold text-white text-base uppercase">
                    {nomeArquivo ? nomeArquivo : "Clique para selecionar o arquivo de extrato"}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    Formatos suportados: .OFX (Recomendado) e .CSV
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleProcessarArquivo}
                disabled={isPending || !nomeArquivo}
                className="bg-[#E51E25] hover:bg-red-700 disabled:opacity-50 text-white font-rajdhani font-bold text-sm uppercase tracking-wider p-3 rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(229,30,37,0.25)]"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processando Extrato Bancário...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Processar e Analisar Linhas do Extrato
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#111] border border-[#222] p-5 rounded-sm">
              <h4 className="font-rajdhani font-bold text-white uppercase text-base mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#E51E25]"></span> Segurança na Leitura Bancária
              </h4>
              <ul className="text-xs text-gray-400 flex flex-col gap-2.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Identificador Único (FITID):</strong> Transações em OFX possuem código exclusivo que impede qualquer importação duplicada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Conferência Obrigatória:</strong> As movimentações só alteram o saldo do caixa após a sua validação linha a linha.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Aprendizado Automático:</strong> Classificações recorrentes (ex: fornecedores e serviços) geram sugestões automáticas.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: TELA DE CONFERÊNCIA LINHA A LINHA */}
      {abaAtiva === "CONFERENCIA" && importacaoAtiva && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {/* Card Resumo do Extrato Lido */}
          <div className="bg-[#111] border border-[#222] p-4 rounded-sm flex flex-wrap justify-between items-center gap-4">
            <div>
              <div className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase">
                CONFERÊNCIA DE EXTRATO BANCÁRIO
              </div>
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase">
                {importacaoAtiva.banco} • {importacaoAtiva.arquivoNome}
              </h3>
              <div className="text-xs text-gray-400 mt-0.5">
                {importacaoAtiva.unidade.nome} • {importacaoAtiva.conta.nome}
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-rajdhani uppercase">
              <div>
                <span className="text-gray-500 block">Créditos Lidos:</span>
                <span className="font-mono text-emerald-400 text-sm font-bold">{formatter.format(importacaoAtiva.totalCreditos)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Débitos Lidos:</span>
                <span className="font-mono text-red-400 text-sm font-bold">-{formatter.format(importacaoAtiva.totalDebitos)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Total de Transações:</span>
                <span className="font-mono text-white text-sm font-bold">{importacaoAtiva.totalTransacoes}</span>
              </div>
            </div>

            <button
              onClick={handleConfirmarConciliacao}
              disabled={isPending}
              className="bg-[#E51E25] hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase px-5 py-2.5 rounded-sm shadow-[0_0_12px_rgba(229,30,37,0.3)] cursor-pointer"
            >
              {isPending ? "Consolidando..." : "Confirmar Conciliação e Lançar no Caixa"}
            </button>
          </div>

          {/* Tabela de Linhas do Extrato */}
          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#161616] border-b border-[#222]">
                  <tr>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Data</th>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Descrição no Banco</th>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Valor</th>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Categoria Sugerida</th>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Fornecedor / Favorecido</th>
                    <th className="px-4 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {importacaoAtiva.linhas.map((l) => {
                    const info = linhasEditadas[l.id] || { categoria: l.categoriaSugerida || "", favorecido: "", status: "CONCILIADO", justificativa: "" };
                    const isCredito = l.tipo === "CREDITO";

                    return (
                      <tr key={l.id} className={`hover:bg-[#151515] transition-colors ${info.status === "IGNORADO" ? "opacity-40" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">
                          {new Date(l.data).toLocaleDateString("pt-BR")}
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-white text-xs font-medium">{l.descricaoOriginal}</div>
                          {l.fitid && <div className="text-[9px] font-mono text-gray-500">{l.fitid}</div>}
                        </td>

                        <td className="px-4 py-3 text-right font-rajdhani font-bold text-sm">
                          <span className={isCredito ? "text-emerald-400" : "text-red-400"}>
                            {isCredito ? "+" : "-"} {formatter.format(Math.abs(l.valor))}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              className="bg-[#1C1C1C] border border-[#333] text-white p-1.5 rounded-sm text-xs w-48 focus:border-[#E51E25]"
                              value={info.categoria}
                              onChange={(e) =>
                                setLinhasEditadas({
                                  ...linhasEditadas,
                                  [l.id]: { ...info, categoria: e.target.value },
                                })
                              }
                            />
                            {l.confiancaSugestao && l.confiancaSugestao >= 0.9 && (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1 py-0.5 rounded">
                                Regra 95%
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Opcional..."
                            className="bg-[#1C1C1C] border border-[#333] text-white p-1.5 rounded-sm text-xs w-40 focus:border-[#E51E25]"
                            value={info.favorecido}
                            onChange={(e) =>
                              setLinhasEditadas({
                                ...linhasEditadas,
                                [l.id]: { ...info, favorecido: e.target.value },
                              })
                            }
                          />
                        </td>

                        <td className="px-4 py-3 text-center">
                          {info.status === "CONCILIADO" ? (
                            <button
                              onClick={() =>
                                setLinhasEditadas({
                                  ...linhasEditadas,
                                  [l.id]: { ...info, status: "IGNORADO", justificativa: "Ignorado manualmente pelo usuário." },
                                })
                              }
                              className="text-[11px] font-rajdhani text-gray-400 hover:text-red-400 cursor-pointer"
                            >
                              Ignorar
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setLinhasEditadas({
                                  ...linhasEditadas,
                                  [l.id]: { ...info, status: "CONCILIADO", justificativa: "" },
                                })
                              }
                              className="text-[11px] font-rajdhani text-emerald-400 hover:underline cursor-pointer"
                            >
                              Conciliar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: REGRAS INTELIGENTES */}
      {abaAtiva === "REGRAS" && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#111] border border-[#222] p-4 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider">
                Regras de Aprendizado e Classificação Automática
              </h3>
              <p className="text-xs text-gray-400">
                O sistema pesquisa palavras-chave na descrição do banco para sugerir a categoria automaticamente nas próximas importações.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Palavra-chave (ex: COPEL)"
                className="bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs font-mono"
                value={novoPadrao}
                onChange={(e) => setNovoPadrao(e.target.value)}
              />
              <input
                type="text"
                placeholder="Categoria (ex: Energia Elétrica)"
                className="bg-[#1C1C1C] border border-[#333] text-white p-2 rounded-sm text-xs"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
              />
              <button
                onClick={handleCriarRegra}
                disabled={isPending || !novoPadrao || !novaCategoria}
                className="bg-[#E51E25] hover:bg-red-700 disabled:opacity-50 text-white font-rajdhani font-bold text-xs uppercase px-3.5 py-2 rounded-sm cursor-pointer"
              >
                + Adicionar Regra
              </button>
            </div>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#161616] border-b border-[#222]">
                <tr>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Palavra-Chave / Padrão</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Categoria Associada</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">Tipo</th>
                  <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {regras.map((r) => (
                  <tr key={r.id} className="hover:bg-[#151515]">
                    <td className="px-5 py-3 font-mono text-xs text-white font-bold">{r.padraoTexto}</td>
                    <td className="px-5 py-3 text-xs text-gray-300">{r.categoria}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${r.tipoMovimento === "ENTRADA" ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400" : "bg-red-950/40 border-red-500/40 text-red-400"}`}>
                        {r.tipoMovimento}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-emerald-400">Ativa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: HISTÓRICO DE IMPORTAÇÕES */}
      {abaAtiva === "HISTORICO" && (
        <div className="bg-[#111] border border-[#222] rounded-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#161616] border-b border-[#222]">
              <tr>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Arquivo / Data</th>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px]">Banco & Unidade</th>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">Transações</th>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Créditos</th>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-right">Débitos</th>
                <th className="px-5 py-3 font-rajdhani text-[#777] font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {importacoes.map((imp) => (
                <tr key={imp.id} className="hover:bg-[#151515]">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs font-bold text-white">{imp.arquivoNome}</div>
                    <div className="text-[10px] text-gray-500">{new Date(imp.createdAt).toLocaleString("pt-BR")}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-rajdhani font-semibold text-white">{imp.unidade.nome}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{imp.banco} • {imp.conta.nome}</div>
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono text-xs text-white">
                    {imp.totalTransacoes}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-emerald-400">
                    +{formatter.format(imp.totalCreditos)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-red-400">
                    -{formatter.format(imp.totalDebitos)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-950/40 border-emerald-500/40 text-emerald-400">
                      {imp.status}
                    </span>
                  </td>
                </tr>
              ))}

              {importacoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500 font-rajdhani text-sm">
                    Nenhum extrato bancário importado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
