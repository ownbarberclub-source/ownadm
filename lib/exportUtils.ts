import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ItemRelatorioExport {
  data: string | Date;
  unidade: string;
  categoria: string;
  subcategoria?: string;
  descricao: string;
  favorecido?: string;
  contaFinanceira: string;
  formaPagamento: string;
  status: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA" | "TRANSFERENCIA";
  observacao?: string;
}

export interface MetadadosRelatorio {
  titulo: string;
  periodo: string;
  unidadeSelecionada: string;
  filtrosAplicadosTexto: string[];
  totalReceitas: number;
  totalDespesas: number;
  saldoLiquido: number;
  quantidadeLancamentos: number;
  usuarioGerador?: string;
}

const formatarMoeda = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

const formatarData = (val: string | Date) => {
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("pt-BR");
};

/**
 * Exporta para arquivo Excel XLSX nativo com 2 abas (Resumo + Detalhado)
 */
export function exportarParaExcel(
  itens: ItemRelatorioExport[],
  meta: MetadadosRelatorio,
  nomeArquivoBase = "relatorio_financeiro"
) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo Executivo
  const resumoData = [
    ["OWN BARBER CLUB - CENTRO DE CONTROLE FINANCEIRO"],
    [meta.titulo],
    [""],
    ["Data de Geração", new Date().toLocaleString("pt-BR")],
    ["Usuário Responsável", meta.usuarioGerador || "Administrador"],
    ["Unidade / Visão", meta.unidadeSelecionada],
    ["Período Analisado", meta.periodo],
    [""],
    ["FILTROS ATIVOS NO MOMENTO DA EXPORTAÇÃO:"],
    ...meta.filtrosAplicadosTexto.map((f) => ["• " + f]),
    [""],
    ["RESUMO DOS VALORES:"],
    ["Total de Receitas / Entradas", meta.totalReceitas],
    ["Total de Despesas / Saídas", meta.totalDespesas],
    ["Saldo Líquido Filtrado", meta.saldoLiquido],
    ["Total de Lançamentos", meta.quantidadeLancamentos],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Lançamentos Detalhados
  const linhasDetalhadas = itens.map((item) => ({
    "Data": formatarData(item.data),
    "Unidade": item.unidade,
    "Tipo": item.tipo,
    "Categoria": item.categoria,
    "Subcategoria": item.subcategoria || "-",
    "Descrição": item.descricao,
    "Fornecedor / Favorecido": item.favorecido || "-",
    "Conta Financeira": item.contaFinanceira,
    "Forma de Pagamento": item.formaPagamento,
    "Status": item.status,
    "Valor (R$)": item.valor,
    "Observação": item.observacao || "",
  }));

  const wsDetalhes = XLSX.utils.json_to_sheet(linhasDetalhadas);

  // Adicionar linha de total no final
  XLSX.utils.sheet_add_aoa(
    wsDetalhes,
    [["TOTAL LÍQUIDO", "", "", "", "", "", "", "", "", "", meta.saldoLiquido, ""]],
    { origin: -1 }
  );

  XLSX.utils.book_append_sheet(wb, wsDetalhes, "Lançamentos");

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivoBase}_${timestamp}.xlsx`);
}

/**
 * Exporta para PDF diagramado profissional
 */
export function exportarParaPDF(
  itens: ItemRelatorioExport[],
  meta: MetadadosRelatorio,
  nomeArquivoBase = "relatorio_financeiro"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Cabeçalho Institucional
  doc.setFillColor(17, 17, 17); // #111
  doc.rect(0, 0, 297, 24, "F");

  doc.setTextColor(229, 30, 37); // #E51E25
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OWN BARBER CLUB", 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`CENTRO DE CONTROLE • ${meta.titulo.toUpperCase()}`, 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 235, 11);
  doc.text(`Unidade: ${meta.unidadeSelecionada}`, 235, 18);

  // Resumo Executivo em Box
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 28, 269, 16, "F");
  doc.setDrawColor(220, 220, 220);
  doc.rect(14, 28, 269, 16, "S");

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const colWidth = 269 / 4;
  doc.text("ENTRADAS:", 18, 35);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129); // Green
  doc.text(formatarMoeda(meta.totalReceitas), 18, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("SAÍDAS:", 18 + colWidth, 35);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(229, 30, 37); // Red
  doc.text(formatarMoeda(meta.totalDespesas), 18 + colWidth, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("SALDO RESULTADO:", 18 + colWidth * 2, 35);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(meta.saldoLiquido >= 0 ? 16 : 229, meta.saldoLiquido >= 0 ? 185 : 30, meta.saldoLiquido >= 0 ? 129 : 37);
  doc.text(formatarMoeda(meta.saldoLiquido), 18 + colWidth * 2, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("LANÇAMENTOS:", 18 + colWidth * 3, 35);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`${meta.quantidadeLancamentos} registros`, 18 + colWidth * 3, 41);

  // Lista de filtros aplicados
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  const filtrosTexto = meta.filtrosAplicadosTexto.join(" | ");
  doc.text(`Filtros: ${filtrosTexto.length > 140 ? filtrosTexto.slice(0, 140) + "..." : filtrosTexto}`, 14, 48);

  // Tabela Detalhada
  const rows = itens.map((item) => [
    formatarData(item.data),
    item.unidade.replace("Own Barber Club ", ""),
    item.categoria,
    item.descricao.length > 30 ? item.descricao.slice(0, 30) + "..." : item.descricao,
    item.favorecido || "-",
    item.contaFinanceira,
    item.formaPagamento,
    item.status,
    (item.tipo === "SAIDA" ? "-" : "+") + formatarMoeda(item.valor),
  ]);

  autoTable(doc, {
    startY: 51,
    head: [["Data", "Unidade", "Categoria", "Descrição", "Favorecido", "Conta", "Forma", "Status", "Valor (R$)"]],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [17, 17, 17],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { cellWidth: 35 },
      3: { cellWidth: 50 },
      4: { cellWidth: 35 },
      5: { cellWidth: 35 },
      6: { cellWidth: 20 },
      7: { cellWidth: 22 },
      8: { cellWidth: 27, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      // Rodapé com numeração de página
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.text(str, 280, 202, { align: "right" });
      doc.text("Own Barber Club - Sistema de Controle Financeiro • Documento Oficial", 14, 202);
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`${nomeArquivoBase}_${timestamp}.pdf`);
}

/**
 * Exporta para arquivo CSV com UTF-8 BOM
 */
export function exportarParaCSV(
  itens: ItemRelatorioExport[],
  meta: MetadadosRelatorio,
  nomeArquivoBase = "relatorio_financeiro"
) {
  const headers = [
    "Data",
    "Unidade",
    "Tipo",
    "Categoria",
    "Subcategoria",
    "Descrição",
    "Favorecido",
    "Conta Financeira",
    "Forma Pagamento",
    "Status",
    "Valor (R$)",
    "Observação",
  ];

  const linhas = itens.map((i) => [
    `"${formatarData(i.data)}"`,
    `"${i.unidade}"`,
    `"${i.tipo}"`,
    `"${i.categoria}"`,
    `"${i.subcategoria || ""}"`,
    `"${i.descricao.replace(/"/g, '""')}"`,
    `"${(i.favorecido || "").replace(/"/g, '""')}"`,
    `"${i.contaFinanceira}"`,
    `"${i.formaPagamento}"`,
    `"${i.status}"`,
    `"${i.valor.toFixed(2).replace(".", ",")}"`,
    `"${(i.observacao || "").replace(/"/g, '""')}"`,
  ]);

  // Linha de total
  linhas.push([
    '"TOTAL"',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    `"${meta.saldoLiquido.toFixed(2).replace(".", ",")}"`,
    '""',
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...linhas.map((l) => l.join(";"))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `${nomeArquivoBase}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
