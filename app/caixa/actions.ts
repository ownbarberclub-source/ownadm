"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface MovimentacaoInput {
  unidadeId: string;
  contaId: string;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  subcategoria?: string;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataMovimento: string;
  formaPagamento: string;
  status: "PENDENTE" | "CONFIRMADO";
  favorecido?: string;
  observacoes?: string;
  anexoUrl?: string;
  responsavel: string;
}

export async function criarMovimentacao(input: MovimentacaoInput) {
  try {
    if (!input.unidadeId) return { success: false, error: "A unidade é obrigatória." };
    if (!input.contaId) return { success: false, error: "A conta financeira é obrigatória." };
    if (!input.descricao?.trim()) return { success: false, error: "A descrição é obrigatória." };
    if (input.valor <= 0 || isNaN(input.valor)) return { success: false, error: "O valor deve ser maior que zero." };

    const mov = await prisma.movimentacaoFinanceira.create({
      data: {
        unidadeId: input.unidadeId,
        contaId: input.contaId,
        tipo: input.tipo,
        categoria: input.categoria,
        subcategoria: input.subcategoria?.trim() || null,
        descricao: input.descricao.trim(),
        valor: input.valor,
        dataCompetencia: new Date(input.dataCompetencia + "T12:00:00Z"),
        dataMovimento: new Date(input.dataMovimento + "T12:00:00Z"),
        formaPagamento: input.formaPagamento,
        status: input.status,
        favorecido: input.favorecido?.trim() || null,
        observacoes: input.observacoes?.trim() || null,
        anexoUrl: input.anexoUrl?.trim() || null,
        responsavel: input.responsavel,
      },
    });

    // Se confirmada, atualiza saldo atual da conta
    if (input.status === "CONFIRMADO") {
      const delta = input.tipo === "ENTRADA" ? input.valor : -input.valor;
      await prisma.contaFinanceira.update({
        where: { id: input.contaId },
        data: { saldoAtual: { increment: delta } },
      });
    }

    revalidatePath("/caixa");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios/dre");

    return { success: true, data: mov };
  } catch (error) {
    console.error("Erro ao criar movimentação:", error);
    return { success: false, error: "Falha ao registrar movimentação financeira." };
  }
}

export async function cancelarMovimentacao(id: string, motivo: string, usuario: string) {
  try {
    if (!motivo?.trim()) return { success: false, error: "O motivo do cancelamento é obrigatório." };

    const mov = await prisma.movimentacaoFinanceira.findUnique({
      where: { id },
    });

    if (!mov) return { success: false, error: "Movimentação não encontrada." };
    if (mov.status === "CANCELADO") return { success: false, error: "Esta movimentação já está cancelada." };

    // Se a movimentação pertencer a uma transferência entre unidades, cancela pela transferência
    if (mov.transferenciaId) {
      return {
        success: false,
        error: "Esta movimentação faz parte de uma transferência entre unidades. Cancele a transferência completa para manter a integridade dos caixas.",
      };
    }

    // Se a movimentação for uma compensação de cartão (par de baixa e crédito)
    if (mov.codigoIdentificador?.startsWith("CMP-")) {
      const parCompensacao = await prisma.movimentacaoFinanceira.findMany({
        where: { codigoIdentificador: mov.codigoIdentificador },
        include: { conta: true },
      });

      for (const m of parCompensacao) {
        if (m.status !== "CANCELADO") {
          await prisma.movimentacaoFinanceira.update({
            where: { id: m.id },
            data: {
              status: "CANCELADO",
              canceladoEm: new Date(),
              canceladoPor: usuario,
              motivoCancelamento: motivo.trim(),
            },
          });

          // Reverter saldo da conta correspondente
          if (m.conta.tipo === "CARTOES_RECEBER") {
            // Devolve o saldo para cartões a receber
            await prisma.contaFinanceira.update({
              where: { id: m.contaId },
              data: { saldoAtual: { increment: m.valor } },
            });
          } else {
            // Remove o crédito da conta bancária
            await prisma.contaFinanceira.update({
              where: { id: m.contaId },
              data: { saldoAtual: { decrement: m.valor } },
            });
          }
        }
      }

      revalidatePath("/caixa");
      revalidatePath("/dashboard");
      return { success: true };
    }

    await prisma.movimentacaoFinanceira.update({
      where: { id },
      data: {
        status: "CANCELADO",
        canceladoEm: new Date(),
        canceladoPor: usuario,
        motivoCancelamento: motivo.trim(),
      },
    });

    // Reverter saldo se estava confirmada
    if (mov.status === "CONFIRMADO") {
      const delta = mov.tipo === "ENTRADA" ? -mov.valor : mov.valor;
      await prisma.contaFinanceira.update({
        where: { id: mov.contaId },
        data: { saldoAtual: { increment: delta } },
      });
    }

    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao cancelar movimentação:", error);
    return { success: false, error: "Erro ao cancelar movimentação." };
  }
}

export interface TransferenciaInput {
  unidadeOrigemId: string;
  contaOrigemId: string;
  unidadeDestinoId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
  descricao: string;
  responsavel: string;
  comprovanteUrl?: string;
}

export async function realizarTransferencia(input: TransferenciaInput) {
  try {
    if (!input.unidadeOrigemId || !input.unidadeDestinoId) {
      return { success: false, error: "Unidade de origem e destino são obrigatórias." };
    }
    if (!input.contaOrigemId || !input.contaDestinoId) {
      return { success: false, error: "Contas financeiras de origem e destino são obrigatórias." };
    }
    if (input.contaOrigemId === input.contaDestinoId) {
      return { success: false, error: "A conta de origem e destino não podem ser a mesma." };
    }
    if (input.valor <= 0 || isNaN(input.valor)) {
      return { success: false, error: "O valor da transferência deve ser maior que zero." };
    }
    if (!input.descricao?.trim()) {
      return { success: false, error: "A descrição ou motivo da transferência é obrigatório." };
    }

    const dataObj = new Date(input.data + "T12:00:00Z");
    const codigoIdentificador = `TRF-${Date.now().toString().slice(-6)}`;

    // Criar registro da Transferência
    const trf = await prisma.transferenciaUnidade.create({
      data: {
        codigoIdentificador,
        data: dataObj,
        valor: input.valor,
        descricao: input.descricao.trim(),
        responsavel: input.responsavel,
        comprovanteUrl: input.comprovanteUrl?.trim() || null,
        status: "CONFIRMADO",
        unidadeOrigemId: input.unidadeOrigemId,
        contaOrigemId: input.contaOrigemId,
        unidadeDestinoId: input.unidadeDestinoId,
        contaDestinoId: input.contaDestinoId,
      },
    });

    // 1. Saída na Origem
    await prisma.movimentacaoFinanceira.create({
      data: {
        codigoIdentificador,
        dataCompetencia: dataObj,
        dataMovimento: dataObj,
        unidadeId: input.unidadeOrigemId,
        contaId: input.contaOrigemId,
        tipo: "SAIDA",
        categoria: "TRANSFERENCIA_SAIDA",
        descricao: `Transferência enviada: ${input.descricao.trim()}`,
        valor: input.valor,
        formaPagamento: "TRANSFERENCIA",
        status: "CONFIRMADO",
        responsavel: input.responsavel,
        transferenciaId: trf.id,
      },
    });

    // Atualizar saldo conta origem
    await prisma.contaFinanceira.update({
      where: { id: input.contaOrigemId },
      data: { saldoAtual: { decrement: input.valor } },
    });

    // 2. Entrada no Destino
    await prisma.movimentacaoFinanceira.create({
      data: {
        codigoIdentificador,
        dataCompetencia: dataObj,
        dataMovimento: dataObj,
        unidadeId: input.unidadeDestinoId,
        contaId: input.contaDestinoId,
        tipo: "ENTRADA",
        categoria: "TRANSFERENCIA_ENTRADA",
        descricao: `Transferência recebida: ${input.descricao.trim()}`,
        valor: input.valor,
        formaPagamento: "TRANSFERENCIA",
        status: "CONFIRMADO",
        responsavel: input.responsavel,
        transferenciaId: trf.id,
      },
    });

    // Atualizar saldo conta destino
    await prisma.contaFinanceira.update({
      where: { id: input.contaDestinoId },
      data: { saldoAtual: { increment: input.valor } },
    });

    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true, data: trf };
  } catch (error) {
    console.error("Erro ao realizar transferência:", error);
    return { success: false, error: "Falha ao processar transferência entre unidades." };
  }
}

export async function cancelarTransferencia(id: string, motivo: string, usuario: string) {
  try {
    if (!motivo?.trim()) return { success: false, error: "O motivo do cancelamento é obrigatório." };

    const trf = await prisma.transferenciaUnidade.findUnique({
      where: { id },
      include: { movimentacoes: true },
    });

    if (!trf) return { success: false, error: "Transferência não encontrada." };
    if (trf.status === "CANCELADO") return { success: false, error: "Esta transferência já foi cancelada." };

    // Cancelar a transferência
    await prisma.transferenciaUnidade.update({
      where: { id },
      data: {
        status: "CANCELADO",
        canceladoEm: new Date(),
        canceladoPor: usuario,
        motivoCancelamento: motivo.trim(),
      },
    });

    // Cancelar as duas movimentações vinculadas juntas
    for (const m of trf.movimentacoes) {
      await prisma.movimentacaoFinanceira.update({
        where: { id: m.id },
        data: {
          status: "CANCELADO",
          canceladoEm: new Date(),
          canceladoPor: usuario,
          motivoCancelamento: `Estorno de transferência: ${motivo.trim()}`,
        },
      });

      // Reverter saldos
      const delta = m.tipo === "ENTRADA" ? -m.valor : m.valor;
      await prisma.contaFinanceira.update({
        where: { id: m.contaId },
        data: { saldoAtual: { increment: delta } },
      });
    }

    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao cancelar transferência:", error);
    return { success: false, error: "Falha ao estornar transferência." };
  }
}

export interface CompensacaoCartaoInput {
  contaCartaoId: string;
  contaDestinoId: string;
  valorBruto: number;
  taxaCartao: number;
  data: string;
  responsavel: string;
  unidadeId: string;
}

export async function compensarCartao(input: CompensacaoCartaoInput) {
  try {
    if (input.valorBruto <= 0) return { success: false, error: "Valor bruto deve ser maior que zero." };
    if (input.taxaCartao < 0) return { success: false, error: "Taxa do cartão inválida." };

    const valorLiquido = input.valorBruto - input.taxaCartao;
    if (valorLiquido <= 0) return { success: false, error: "O valor líquido a creditar deve ser positivo." };

    const dataObj = new Date(input.data + "T12:00:00Z");
    const cod = `CMP-${Date.now().toString().slice(-6)}`;

    // 1. Baixa da conta de cartões a receber (transferência interna de saldo, NÃO despesa)
    await prisma.movimentacaoFinanceira.create({
      data: {
        codigoIdentificador: cod,
        dataCompetencia: dataObj,
        dataMovimento: dataObj,
        unidadeId: input.unidadeId,
        contaId: input.contaCartaoId,
        tipo: "TRANSFERENCIA",
        categoria: "COMPENSACAO_CARTAO",
        descricao: `Compensação de Cartão (Transferência para Conta Bancária)`,
        valor: input.valorBruto,
        formaPagamento: "TRANSFERENCIA",
        status: "CONFIRMADO",
        responsavel: input.responsavel,
      },
    });

    await prisma.contaFinanceira.update({
      where: { id: input.contaCartaoId },
      data: { saldoAtual: { decrement: input.valorBruto } },
    });

    // 2. Crédito na conta bancária (transferência interna de saldo, NÃO receita duplicada)
    await prisma.movimentacaoFinanceira.create({
      data: {
        codigoIdentificador: cod,
        dataCompetencia: dataObj,
        dataMovimento: dataObj,
        unidadeId: input.unidadeId,
        contaId: input.contaDestinoId,
        tipo: "TRANSFERENCIA",
        categoria: "COMPENSACAO_CARTAO",
        descricao: `Crédito de Cartão Compensado (${cod})`,
        valor: valorLiquido,
        formaPagamento: "TRANSFERENCIA",
        status: "CONFIRMADO",
        responsavel: input.responsavel,
      },
    });

    await prisma.contaFinanceira.update({
      where: { id: input.contaDestinoId },
      data: { saldoAtual: { increment: valorLiquido } },
    });

    // 3. Taxa da maquininha: apenas se informada expressamente
    if (input.taxaCartao > 0) {
      await prisma.movimentacaoFinanceira.create({
        data: {
          codigoIdentificador: cod,
          dataCompetencia: dataObj,
          dataMovimento: dataObj,
          unidadeId: input.unidadeId,
          contaId: input.contaDestinoId,
          tipo: "SAIDA",
          categoria: "Taxas Bancárias e Cartão",
          descricao: `Taxa da Maquininha de Cartão (${cod})`,
          valor: input.taxaCartao,
          formaPagamento: "OUTROS",
          status: "CONFIRMADO",
          responsavel: input.responsavel,
        },
      });
    }

    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao compensar cartão:", error);
    return { success: false, error: "Falha ao processar compensação de cartão." };
  }
}

export interface FechamentoCaixaInput {
  unidadeId: string;
  data: string;
  saldoEsperadoDinheiro: number;
  saldoContadoDinheiro: number;
  saldoBancarioInformado?: number;
  justificativa?: string;
  observacoes?: string;
  responsavel: string;
}

export async function salvarFechamentoCaixa(input: FechamentoCaixaInput) {
  try {
    if (!input.unidadeId) return { success: false, error: "Unidade é obrigatória." };
    if (!input.data) return { success: false, error: "Data é obrigatória." };

    const diferenca = input.saldoContadoDinheiro - input.saldoEsperadoDinheiro;

    if (Math.abs(diferenca) > 0.01 && !input.justificativa?.trim()) {
      return {
        success: false,
        error: `Há uma diferença de R$ ${diferenca.toFixed(2)} no caixa físico. A justificativa é estritamente obrigatória.`,
      };
    }

    const fechamento = await prisma.fechamentoCaixa.create({
      data: {
        unidadeId: input.unidadeId,
        data: new Date(input.data + "T12:00:00Z"),
        saldoEsperadoDinheiro: input.saldoEsperadoDinheiro,
        saldoContadoDinheiro: input.saldoContadoDinheiro,
        diferencaDinheiro: diferenca,
        saldoBancarioInformado: input.saldoBancarioInformado || null,
        justificativa: input.justificativa?.trim() || null,
        observacoes: input.observacoes?.trim() || null,
        responsavel: input.responsavel,
      },
    });

    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true, data: fechamento };
  } catch (error) {
    console.error("Erro ao registrar conciliação de caixa:", error);
    return { success: false, error: "Falha ao salvar conciliação de caixa." };
  }
}

export async function criarContaFinanceira(input: { nome: string; tipo: string; saldoInicial: number; unidadeId: string }) {
  try {
    if (!input.nome?.trim()) return { success: false, error: "Nome da conta é obrigatório." };
    if (!input.unidadeId) return { success: false, error: "Unidade é obrigatória." };

    const conta = await prisma.contaFinanceira.create({
      data: {
        nome: input.nome.trim(),
        tipo: input.tipo,
        saldoInicial: input.saldoInicial || 0,
        saldoAtual: input.saldoInicial || 0,
        unidadeId: input.unidadeId,
      },
    });

    revalidatePath("/caixa");
    return { success: true, data: conta };
  } catch (error) {
    console.error("Erro ao criar conta financeira:", error);
    return { success: false, error: "Erro ao cadastrar conta financeira." };
  }
}
