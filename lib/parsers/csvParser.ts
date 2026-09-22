import { TransacaoOfx } from "./ofxParser";

/**
 * Parser flexível para extratos bancários em CSV brasileiros
 * Lida com delimitadores vírgula ou ponto-e-vírgula e datas no formato DD/MM/AAAA ou AAAA-MM-DD
 */
export function parseCsvExtrato(conteudoCsv: string): TransacaoOfx[] {
  const linhas = conteudoCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  // Detectar delimitador (normalmente ; em extratos de bancos brasileiros, ou ,)
  const primeiraLinha = linhas[0];
  const delimitador = primeiraLinha.includes(";") ? ";" : ",";

  const cabecalho = primeiraLinha.toLowerCase().split(delimitador).map((c) => c.replace(/"/g, "").trim());

  // Encontrar índices de colunas comuns
  const idxData = cabecalho.findIndex((c) => c.includes("data") || c.includes("dt"));
  const idxDescricao = cabecalho.findIndex(
    (c) => c.includes("hist") || c.includes("desc") || c.includes("memo") || c.includes("detalhe")
  );
  const idxValor = cabecalho.findIndex((c) => c.includes("valor") || c.includes("lancamento") || c.includes("quantia"));
  const idxDoc = cabecalho.findIndex((c) => c.includes("doc") || c.includes("numero") || c.includes("identificador"));

  const transacoes: TransacaoOfx[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(delimitador).map((col) => col.replace(/"/g, "").trim());
    if (colunas.length < 3) continue;

    const dataRaw = idxData !== -1 ? colunas[idxData] : colunas[0];
    const descRaw = idxDescricao !== -1 ? colunas[idxDescricao] : colunas[1];
    const valorRaw = idxValor !== -1 ? colunas[idxValor] : colunas[2];
    const docRaw = idxDoc !== -1 ? colunas[idxDoc] : undefined;

    // Converter data DD/MM/AAAA para Date
    let dataObj = new Date();
    if (dataRaw.includes("/")) {
      const partes = dataRaw.split("/");
      if (partes.length === 3) {
        dataObj = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 12, 0, 0);
      }
    } else if (dataRaw.includes("-")) {
      const partes = dataRaw.split("-");
      if (partes.length === 3) {
        dataObj = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10), 12, 0, 0);
      }
    }

    if (isNaN(dataObj.getTime())) continue;

    // Limpar valor numérico no formato brasileiro (ex: 1.250,50 ou -350,00)
    const valorLimpo = valorRaw.replace(/\./g, "").replace(",", ".");
    const valorNum = parseFloat(valorLimpo);
    if (isNaN(valorNum)) continue;

    const valorAbsoluto = Math.abs(valorNum);
    const tipo = valorNum < 0 ? "DEBITO" : "CREDITO";

    transacoes.push({
      tipo,
      data: dataObj,
      valor: valorAbsoluto,
      descricaoOriginal: descRaw || "Lançamento em Extrato",
      documento: docRaw,
      fitid: `CSV-${dataObj.getTime()}-${valorAbsoluto}-${descRaw.slice(0, 10)}`,
    });
  }

  return transacoes;
}
