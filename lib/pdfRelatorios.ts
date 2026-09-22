import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

export const formatarBRL = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
};

export const formatarDataBR = (dataStr: string | Date): string => {
  if (!dataStr) return "-";
  // Evitar deslocamento de fuso se vier "YYYY-MM-DD"
  if (typeof dataStr === "string" && dataStr.includes("-") && dataStr.length <= 10) {
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return String(dataStr);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

interface HeaderPdfProps {
  doc: jsPDF;
  titulo: string;
  unidade: string;
  periodo: string;
}

function desenharCabecalho({ doc, titulo, unidade, periodo }: HeaderPdfProps) {
  // Faixa escura superior
  doc.setFillColor(13, 15, 18); // #0D0F12
  doc.rect(0, 0, 297, 24, "F");

  // Barra de destaque vermelha (telemetria Own Barber Club)
  doc.setFillColor(229, 30, 37); // #E51E25
  doc.rect(0, 0, 4, 24, "F");

  // Marca
  doc.setTextColor(229, 30, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OWN BARBER CLUB", 12, 10);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(titulo.toUpperCase(), 12, 17);

  // Informações de contexto
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Unidade: ${unidade}`, 210, 10);
  doc.text(`Período / Referência: ${periodo}`, 210, 15);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 210, 20);
}

// -------------------------------------------------------------
// 1. PDF DE FATURAMENTO DIÁRIO
// -------------------------------------------------------------

export interface ItemFaturamentoPdf {
  data: string | Date;
  unidade: string;
  pix: number;
  credito: number;
  debito: number;
  dinheiro: number;
  assinatura: number;
  total: number;
}

export interface TotaisFaturamentoPdf {
  totalPix: number;
  totalCredito: number;
  totalDebito: number;
  totalDinheiro: number;
  totalAssinatura: number;
  faturamentoTotal: number;
}

export function gerarPdfFaturamento({
  periodo,
  unidade,
  itens,
  totais,
}: {
  periodo: string;
  unidade: string;
  itens: ItemFaturamentoPdf[];
  totais: TotaisFaturamentoPdf;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  desenharCabecalho({
    doc,
    titulo: "Relatório de Faturamento Diário",
    unidade,
    periodo,
  });

  // Linhas da tabela
  const body = itens.map((item) => [
    formatarDataBR(item.data),
    item.unidade.replace("Own Barber Club ", ""),
    formatarBRL(item.pix),
    formatarBRL(item.credito),
    formatarBRL(item.debito),
    formatarBRL(item.dinheiro),
    formatarBRL(item.assinatura),
    formatarBRL(item.total),
  ]);

  // Linha de total geral
  const foot = [
    [
      "TOTAL GERAL",
      `${itens.length} registro(s)`,
      formatarBRL(totais.totalPix),
      formatarBRL(totais.totalCredito),
      formatarBRL(totais.totalDebito),
      formatarBRL(totais.totalDinheiro),
      formatarBRL(totais.totalAssinatura),
      formatarBRL(totais.faturamentoTotal),
    ],
  ];

  autoTable(doc, {
    startY: 30,
    head: [["Data", "Unidade", "PIX", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Assinatura", "Faturamento Total"]],
    body,
    foot,
    theme: "striped",
    headStyles: {
      fillColor: [18, 20, 24],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: [229, 30, 37],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 42 },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 34, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
      6: { cellWidth: 34, halign: "right" },
      7: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.text(str, 280, 202, { align: "right" });
      doc.text("Own Barber Club • Documento Gerencial de Faturamento Diário", 12, 202);
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`faturamento_${unidade.toLowerCase().replace(/\s+/g, "_")}_${timestamp}.pdf`);
}

// -------------------------------------------------------------
// 2. PDF DE CONTAS A PAGAR
// -------------------------------------------------------------

export interface ItemContaPdf {
  descricao: string;
  unidade: string;
  categoria: string;
  valor: number;
  dataVencimento: string | Date;
  status: "PAGA" | "PENDENTE" | "ATRASADA" | string;
  dataPagamento?: string | Date | null;
}

export interface TotaisContasPdf {
  totalPago: number;
  totalPendente: number;
  totalAtrasado: number;
  totalGeral: number;
}

export function gerarPdfContas({
  periodo,
  unidade,
  itens,
  totais,
}: {
  periodo: string;
  unidade: string;
  itens: ItemContaPdf[];
  totais: TotaisContasPdf;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  desenharCabecalho({
    doc,
    titulo: "Relatório de Contas a Pagar",
    unidade,
    periodo,
  });

  // Resumo em cards no topo
  doc.setFillColor(242, 244, 247);
  doc.rect(12, 28, 273, 14, "F");
  doc.setDrawColor(210, 215, 220);
  doc.rect(12, 28, 273, 14, "S");

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const w = 273 / 4;

  doc.text("TOTAL PAGO:", 16, 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(formatarBRL(totais.totalPago), 16, 39);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("TOTAL PENDENTE:", 16 + w, 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(217, 119, 6);
  doc.text(formatarBRL(totais.totalPendente), 16 + w, 39);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("TOTAL ATRASADO:", 16 + w * 2, 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(229, 30, 37);
  doc.text(formatarBRL(totais.totalAtrasado), 16 + w * 2, 39);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("TOTAL GERAL DE CONTAS:", 16 + w * 3, 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(18, 20, 24);
  doc.text(formatarBRL(totais.totalGeral), 16 + w * 3, 39);

  const body = itens.map((item) => [
    item.descricao,
    item.unidade.replace("Own Barber Club ", ""),
    item.categoria,
    formatarBRL(item.valor),
    formatarDataBR(item.dataVencimento),
    item.status.toUpperCase(),
    item.dataPagamento ? formatarDataBR(item.dataPagamento) : "-",
  ]);

  autoTable(doc, {
    startY: 46,
    head: [["Descrição", "Unidade", "Categoria", "Valor", "Vencimento", "Status", "Data Pagamento"]],
    body,
    theme: "striped",
    headStyles: {
      fillColor: [18, 20, 24],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { cellWidth: 42 },
      3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 28, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 30, halign: "center" },
    },
    didDrawPage: (data) => {
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.text(str, 280, 202, { align: "right" });
      doc.text("Own Barber Club • Documento Gerencial de Despesas & Contas a Pagar", 12, 202);
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`contas_pagar_${unidade.toLowerCase().replace(/\s+/g, "_")}_${timestamp}.pdf`);
}

// -------------------------------------------------------------
// 3. PDF DE RELATÓRIO DRE GERENCIAL
// -------------------------------------------------------------

export interface DrePdfData {
  mesReferencia: string; // "MM/AAAA"
  unidade: string;
  receitaPix: number;
  receitaCredito: number;
  receitaDebito: number;
  receitaDinheiro: number;
  receitaAssinaturas: number;
  receitaTotal: number;
  despesasPorCategoria: { categoria: string; valor: number }[];
  despesaTotal: number;
  despesaPaga: number;
  despesaPendente: number;
  despesaAtrasada: number;
  resultadoMes: number;
  margemPercentual: number;
}

export function gerarPdfDre(dados: DrePdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Faixa superior
  doc.setFillColor(13, 15, 18);
  doc.rect(0, 0, 210, 24, "F");
  doc.setFillColor(229, 30, 37);
  doc.rect(0, 0, 4, 24, "F");

  doc.setTextColor(229, 30, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OWN BARBER CLUB", 12, 10);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)", 12, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Unidade: ${dados.unidade}`, 135, 10);
  doc.text(`Mês de Referência: ${dados.mesReferencia}`, 135, 15);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 135, 20);

  // Tabela DRE
  const rows = [
    // Seção Receitas
    [{ content: "1. RECEITAS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 243, 246], textColor: [18, 20, 24] } }],
    ["  (+) PIX", formatarBRL(dados.receitaPix)],
    ["  (+) Cartão de Crédito", formatarBRL(dados.receitaCredito)],
    ["  (+) Cartão de Débito", formatarBRL(dados.receitaDebito)],
    ["  (+) Dinheiro em Espécie", formatarBRL(dados.receitaDinheiro)],
    ["  (+) Assinaturas", formatarBRL(dados.receitaAssinaturas)],
    [{ content: "(=) RECEITA TOTAL", styles: { fontStyle: "bold", textColor: [16, 185, 129] } }, { content: formatarBRL(dados.receitaTotal), styles: { fontStyle: "bold", textColor: [16, 185, 129], halign: "right" } }],

    // Espaço
    [{ content: "2. DESPESAS OPERACIONAIS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 243, 246], textColor: [18, 20, 24] } }],
    ...dados.despesasPorCategoria.map((d) => [`  (-) ${d.categoria}`, `-${formatarBRL(d.valor)}`]),
    [{ content: "(=) TOTAL DE DESPESAS DO MÊS", styles: { fontStyle: "bold", textColor: [229, 30, 37] } }, { content: `-${formatarBRL(dados.despesaTotal)}`, styles: { fontStyle: "bold", textColor: [229, 30, 37], halign: "right" } }],

    // Detalhamento Status Despesas
    [{ content: "  • Despesas Já Pagas", styles: { textColor: [100, 100, 100], fontSize: 7.5 } }, { content: formatarBRL(dados.despesaPaga), styles: { textColor: [100, 100, 100], fontSize: 7.5, halign: "right" } }],
    [{ content: "  • Despesas Pendentes (A Vencer)", styles: { textColor: [100, 100, 100], fontSize: 7.5 } }, { content: formatarBRL(dados.despesaPendente), styles: { textColor: [100, 100, 100], fontSize: 7.5, halign: "right" } }],
    [{ content: "  • Despesas Atrasadas (Vencidas)", styles: { textColor: [100, 100, 100], fontSize: 7.5 } }, { content: formatarBRL(dados.despesaAtrasada), styles: { textColor: [100, 100, 100], fontSize: 7.5, halign: "right" } }],

    // Resultado
    [{ content: "3. APURAÇÃO DO RESULTADO", colSpan: 2, styles: { fontStyle: "bold", fillColor: [240, 243, 246], textColor: [18, 20, 24] } }],
    [{ content: "(=) RESULTADO DO MÊS (Receitas - Despesas)", styles: { fontStyle: "bold", fontSize: 9 } }, { content: formatarBRL(dados.resultadoMes), styles: { fontStyle: "bold", fontSize: 9, halign: "right", textColor: dados.resultadoMes >= 0 ? [16, 185, 129] : [229, 30, 37] } }],
    [{ content: "MARGEM DE RESULTADO (%)", styles: { fontStyle: "bold", fontSize: 9 } }, { content: `${dados.margemPercentual.toFixed(2)}%`, styles: { fontStyle: "bold", fontSize: 9, halign: "right", textColor: dados.margemPercentual >= 0 ? [16, 185, 129] : [229, 30, 37] } }],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Linha de Demonstração Gerencial", "Valor Apurado (R$)"]],
    body: rows as RowInput[],
    theme: "plain",
    headStyles: {
      fillColor: [18, 20, 24],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 46, halign: "right" },
    },
    didDrawPage: (data) => {
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.text(str, 198, 287, { align: "right" });
      doc.text("Own Barber Club • Relatório DRE Oficial", 12, 287);
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`dre_${dados.unidade.toLowerCase().replace(/\s+/g, "_")}_${timestamp}.pdf`);
}
