import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando configuração das 3 unidades e contas financeiras...");

  // 1. Atualizar ou criar as 3 unidades oficiais da Own Barber Club
  const nomesOficiais = [
    { antigo: "Efapi", oficial: "Own Barber Club Efapi" },
    { antigo: "Avenida", oficial: "Own Barber Club Avenida" },
    { antigo: "Centro", oficial: "Own Barber Club Centro" },
  ];

  const unidadesCriadasOuAtualizadas = [];

  for (const item of nomesOficiais) {
    // Tenta achar pelo nome antigo ou pelo novo
    let unidade = await prisma.unidade.findFirst({
      where: {
        OR: [
          { nome: item.antigo },
          { nome: item.oficial },
          { nome: { contains: item.antigo } }
        ]
      }
    });

    if (unidade) {
      unidade = await prisma.unidade.update({
        where: { id: unidade.id },
        data: { nome: item.oficial },
      });
      console.log(`Unidade atualizada: ${unidade.nome} (ID: ${unidade.id})`);
    } else {
      unidade = await prisma.unidade.create({
        data: { nome: item.oficial },
      });
      console.log(`Unidade criada: ${unidade.nome} (ID: ${unidade.id})`);
    }

    unidadesCriadasOuAtualizadas.push(unidade);
  }

  // 2. Criar Contas Financeiras padrão para cada unidade se ainda não existirem
  const contasPadrao = [
    { nome: "Dinheiro em Espécie (Caixa Físico)", tipo: "DINHEIRO", saldoInicial: 0 },
    { nome: "Conta Bancária Principal", tipo: "BANCARIA", saldoInicial: 0 },
    { nome: "Conta PIX", tipo: "PIX", saldoInicial: 0 },
    { nome: "Cartões a Receber (A Compensar)", tipo: "CARTOES_RECEBER", saldoInicial: 0 },
  ];

  for (const unid of unidadesCriadasOuAtualizadas) {
    for (const c of contasPadrao) {
      const contaExistente = await prisma.contaFinanceira.findFirst({
        where: {
          unidadeId: unid.id,
          tipo: c.tipo,
        }
      });

      if (!contaExistente) {
        await prisma.contaFinanceira.create({
          data: {
            nome: `${c.nome} - ${unid.nome.replace("Own Barber Club ", "")}`,
            tipo: c.tipo,
            saldoInicial: c.saldoInicial,
            saldoAtual: c.saldoInicial,
            unidadeId: unid.id,
          }
        });
        console.log(`Conta criada: ${c.nome} para ${unid.nome}`);
      }
    }
  }

  // 3. Regras inteligentes padrão de classificação bancária
  const regrasPadrao = [
    { padraoTexto: "ENEL", categoria: "Energia Elétrica", tipoMovimento: "SAIDA" },
    { padraoTexto: "COPEL", categoria: "Energia Elétrica", tipoMovimento: "SAIDA" },
    { padraoTexto: "CELESC", categoria: "Energia Elétrica", tipoMovimento: "SAIDA" },
    { padraoTexto: "CASAN", categoria: "Água e Esgoto", tipoMovimento: "SAIDA" },
    { padraoTexto: "SANEPAR", categoria: "Água e Esgoto", tipoMovimento: "SAIDA" },
    { padraoTexto: "LAVANDERIA", categoria: "Lavagem de Toalhas", tipoMovimento: "SAIDA" },
    { padraoTexto: "TOALHA", categoria: "Lavagem de Toalhas", tipoMovimento: "SAIDA" },
    { padraoTexto: "ALUGUEL", categoria: "Aluguel", tipoMovimento: "SAIDA" },
    { padraoTexto: "INTERNET", categoria: "Internet / Telecom", tipoMovimento: "SAIDA" },
    { padraoTexto: "CLARO", categoria: "Internet / Telecom", tipoMovimento: "SAIDA" },
    { padraoTexto: "VIVO", categoria: "Internet / Telecom", tipoMovimento: "SAIDA" },
    { padraoTexto: "PRODUTO", categoria: "Produtos", tipoMovimento: "SAIDA" },
    { padraoTexto: "COCA", categoria: "Bebidas", tipoMovimento: "SAIDA" },
    { padraoTexto: "CERVEJA", categoria: "Bebidas", tipoMovimento: "SAIDA" },
    { padraoTexto: "AMBEV", categoria: "Bebidas", tipoMovimento: "SAIDA" },
    { padraoTexto: "FOLHA", categoria: "Folha de Pagamento", tipoMovimento: "SAIDA" },
    { padraoTexto: "SALARIO", categoria: "Folha de Pagamento", tipoMovimento: "SAIDA" },
    { padraoTexto: "COMISSAO", categoria: "Pagamento de Comissão", tipoMovimento: "SAIDA" },
    { padraoTexto: "TARIFA", categoria: "Tarifas Bancárias", tipoMovimento: "SAIDA" },
    { padraoTexto: "DOC/TED", categoria: "Tarifas Bancárias", tipoMovimento: "SAIDA" },
    { padraoTexto: "MANUTENCAO", categoria: "Manutenção", tipoMovimento: "SAIDA" },
  ];

  for (const r of regrasPadrao) {
    const existe = await prisma.regraClassificacaoBancaria.findFirst({
      where: { padraoTexto: r.padraoTexto }
    });

    if (!existe) {
      await prisma.regraClassificacaoBancaria.create({
        data: {
          padraoTexto: r.padraoTexto,
          categoria: r.categoria,
          tipoMovimento: r.tipoMovimento,
          criadoPor: "SISTEMA",
        }
      });
    }
  }

  console.log("Configuração financeira inicial concluída com sucesso!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
