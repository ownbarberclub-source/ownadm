export interface TransacaoOfx {
  tipo: "DEBITO" | "CREDITO";
  data: Date;
  valor: number;
  fitid: string;
  descricaoOriginal: string;
  documento?: string;
}

export interface ResultadoOfx {
  bancoId?: string;
  contaId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  saldoFinal?: number;
  transacoes: TransacaoOfx[];
}

/**
 * Parser nativo para arquivos OFX (SGML/XML bancário brasileiro)
 */
export function parseOfx(conteudoOfx: string): ResultadoOfx {
  const transacoes: TransacaoOfx[] = [];

  // Extrair blocos STMTTRN (transações)
  const regexTransacao = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = regexTransacao.exec(conteudoOfx)) !== null) {
    const bloco = match[1];

    const getTag = (tag: string): string => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
      const m = bloco.match(r);
      return m ? m[1].trim() : "";
    };

    const trntype = getTag("TRNTYPE").toUpperCase();
    const dtpostedRaw = getTag("DTPOSTED");
    const trnamtRaw = getTag("TRNAMT");
    const fitid = getTag("FITID");
    const memo = getTag("MEMO");
    const name = getTag("NAME");
    const checknum = getTag("CHECKNUM");

    // Formatar data: ex 20260922120000[-03:EST] ou 20260922
    let dataTransacao = new Date();
    if (dtpostedRaw.length >= 8) {
      const ano = parseInt(dtpostedRaw.substring(0, 4), 10);
      const mes = parseInt(dtpostedRaw.substring(4, 6), 10) - 1;
      const dia = parseInt(dtpostedRaw.substring(6, 8), 10);
      dataTransacao = new Date(ano, mes, dia, 12, 0, 0);
    }

    const valorNum = parseFloat(trnamtRaw.replace(",", ".")) || 0;
    const valorAbsoluto = Math.abs(valorNum);
    const tipo = valorNum < 0 || trntype === "DEBIT" ? "DEBITO" : "CREDITO";
    const descricao = memo || name || "Transação Bancária";

    transacoes.push({
      tipo,
      data: dataTransacao,
      valor: valorAbsoluto,
      fitid: fitid || `OFX-${dataTransacao.getTime()}-${Math.abs(valorNum)}`,
      descricaoOriginal: descricao,
      documento: checknum || undefined,
    });
  }

  // Extrair saldo final se existir
  const saldoMatch = conteudoOfx.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i);
  const saldoFinal = saldoMatch ? parseFloat(saldoMatch[1].replace(",", ".")) : undefined;

  return {
    saldoFinal,
    transacoes,
  };
}
