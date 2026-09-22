import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando ajuste das compensações e saldos...");

  // 1. Atualizar todas as movimentações de compensação de cartão para tipo 'TRANSFERENCIA' e categoria 'COMPENSACAO_CARTAO'
  const movsCompensacao = await prisma.movimentacaoFinanceira.findMany({
    where: {
      OR: [
        { categoria: "COMPENSACAO_CARTAO_SAIDA" },
        { categoria: "RECEBIMENTO_CARTAO" },
        { codigoIdentificador: { startsWith: "CMP-" } },
      ],
    },
  });

  console.log(`Encontradas ${movsCompensacao.length} movimentações de compensação para ajustar.`);

  for (const m of movsCompensacao) {
    // Alinhar os pares cancelados: se uma das pontas do CMP- estiver cancelada, cancela a outra
    let statusFinal = m.status;
    if (m.codigoIdentificador) {
      const par = await prisma.movimentacaoFinanceira.findFirst({
        where: {
          codigoIdentificador: m.codigoIdentificador,
          status: "CANCELADO",
        },
      });
      if (par) {
        statusFinal = "CANCELADO";
      }
    }

    await prisma.movimentacaoFinanceira.update({
      where: { id: m.id },
      data: {
        tipo: "TRANSFERENCIA",
        categoria: "COMPENSACAO_CARTAO",
        status: statusFinal,
      },
    });
  }

  // 2. Ajustar o saldo da Conta Bancária Principal e Cartões a Receber de Avenida
  const unidAvenida = await prisma.unidade.findFirst({
    where: { nome: { contains: "Avenida" } },
  });

  if (unidAvenida) {
    // Saldo real de Cartões a Receber = 456 (do fechamento diário)
    await prisma.contaFinanceira.updateMany({
      where: {
        unidadeId: unidAvenida.id,
        tipo: "CARTOES_RECEBER",
      },
      data: {
        saldoAtual: 456,
      },
    });

    // Saldo real da Conta Bancária = 232 (do faturamento no débito)
    await prisma.contaFinanceira.updateMany({
      where: {
        unidadeId: unidAvenida.id,
        tipo: "BANCARIA",
      },
      data: {
        saldoAtual: 232,
      },
    });

    console.log("Saldos da unidade Avenida ajustados perfeitamente (Banco: 232, Cartões a Compensar: 456).");
  }

  console.log("Ajuste concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
