"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseOfx } from "@/lib/parsers/ofxParser";
import { parseCsvExtrato } from "@/lib/parsers/csvParser";

export async function processarUploadExtrato(
  conteudoTexto: string,
  nomeArquivo: string,
  formato: "OFX" | "CSV",
  unidadeId: string,
  contaId: string,
  banco: string,
  responsavel: string
) {
  try {
    if (!conteudoTexto?.trim()) return { success: false, error: "Arquivo vazio." };
    if (!unidadeId) return { success: false, error: "Unidade é obrigatória." };
    if (!contaId) return { success: false, error: "Conta financeira é obrigatória." };

    // 1. Parsing
    let transacoes;
    let saldoFinalArquivo: number | undefined;

    if (formato === "OFX") {
      const resOfx = parseOfx(conteudoTexto);
      transacoes = resOfx.transacoes;
      saldoFinalArquivo = resOfx.saldoFinal;
    } else {
      transacoes = parseCsvExtrato(conteudoTexto);
    }

    if (transacoes.length === 0) {
      return { success: false, error: "Nenhuma movimentação pôde ser identificada no arquivo fornecido." };
    }

    // 2. Hash do Arquivo para prevenir duplicidade de importação acidental
    const arquivoHash = `HASH-${nomeArquivo}-${transacoes.length}-${transacoes[0]?.data.getTime() || Date.now()}`;

    const importacaoExistente = await prisma.importacaoExtrato.findFirst({
      where: { arquivoHash, status: { not: "CANCELADO" } },
    });

    if (importacaoExistente) {
      return {
        success: false,
        error: `Este arquivo de extrato já foi importado anteriormente em ${importacaoExistente.createdAt.toLocaleDateString("pt-BR")}. Verifique o histórico de importações para evitar duplicidades.`,
      };
    }

    // 3. Buscar regras de classificação inteligente cadastradas
    const regras = await prisma.regraClassificacaoBancaria.findMany({
      where: { ativo: true },
    });

    // 4. Buscar FITIDs e movimentações existentes para detecção de duplicidades
    const fitidsExistentes = new Set(
      (
        await prisma.linhaExtrato.findMany({
          where: { importacao: { contaId } },
          select: { fitid: true },
        })
      )
        .map((l) => l.fitid)
        .filter(Boolean)
    );

    let totalCreditos = 0;
    let totalDebitos = 0;

    const linhasPrisma = transacoes.map((t) => {
      const isDuplicado = t.fitid ? fitidsExistentes.has(t.fitid) : false;

      if (t.tipo === "CREDITO") totalCreditos += t.valor;
      else totalDebitos += t.valor;

      // Aplicar motor de regras inteligente
      let categoriaSugerida = t.tipo === "CREDITO" ? "Outras Receitas" : "Despesas Gerais";
      let confiancaSugestao = 0.5;

      const descUpper = t.descricaoOriginal.toUpperCase();
      for (const r of regras) {
        if (descUpper.includes(r.padraoTexto.toUpperCase())) {
          categoriaSugerida = r.categoria;
          confiancaSugestao = 0.95; // 95% de certeza baseada em regra
          break;
        }
      }

      const hashLinha = `L-${contaId}-${t.data.getTime()}-${t.valor}-${t.descricaoOriginal.slice(0, 15)}`;

      return {
        fitid: t.fitid,
        hashLinha,
        data: t.data,
        descricaoOriginal: t.descricaoOriginal,
        documento: t.documento || null,
        valor: t.tipo === "DEBITO" ? -t.valor : t.valor,
        tipo: t.tipo,
        categoriaSugerida,
        confiancaSugestao,
        status: isDuplicado ? "DUPLICADO" : "PENDENTE",
      };
    });

    // 5. Criar registro de Importação e Linhas
    const importacao = await prisma.importacaoExtrato.create({
      data: {
        arquivoNome: nomeArquivo,
        arquivoHash,
        formato,
        banco: banco || "Banco",
        periodoInicio: transacoes[0]?.data,
        periodoFim: transacoes[transacoes.length - 1]?.data,
        saldoFinal: saldoFinalArquivo || null,
        unidadeId,
        contaId,
        totalTransacoes: transacoes.length,
        totalCreditos,
        totalDebitos,
        status: "PENDENTE_REVISAO",
        responsavel,
        linhas: {
          create: linhasPrisma,
        },
      },
      include: {
        linhas: true,
        conta: true,
        unidade: true,
      },
    });

    revalidatePath("/extratos");
    revalidatePath("/caixa");

    return { success: true, data: importacao };
  } catch (error) {
    console.error("Erro ao processar extrato:", error);
    return { success: false, error: "Erro interno ao ler e estruturar o extrato bancário." };
  }
}

export interface LinhaConfirmacaoItem {
  id: string;
  categoriaConfirmada: string;
  favorecidoConfirmado?: string;
  status: "CONCILIADO" | "IGNORADO";
  justificativaIgnorado?: string;
}

export async function confirmarConciliacaoExtrato(
  importacaoId: string,
  linhasConfirmadas: LinhaConfirmacaoItem[],
  responsavel: string
) {
  try {
    const importacao = await prisma.importacaoExtrato.findUnique({
      where: { id: importacaoId },
      include: { linhas: true, conta: true },
    });

    if (!importacao) return { success: false, error: "Importação não encontrada." };

    let valorTotalLiquidoConfirmado = 0;

    for (const item of linhasConfirmadas) {
      const linha = importacao.linhas.find((l) => l.id === item.id);
      if (!linha) continue;

      if (item.status === "CONCILIADO") {
        const isEntrada = linha.tipo === "CREDITO";
        const valorPositivo = Math.abs(linha.valor);

        // Criar movimentação financeira oficial no caixa da unidade
        const mov = await prisma.movimentacaoFinanceira.create({
          data: {
            codigoIdentificador: linha.fitid || `EXT-${linha.id.slice(-6)}`,
            dataCompetencia: linha.data,
            dataMovimento: linha.data,
            unidadeId: importacao.unidadeId,
            contaId: importacao.contaId,
            tipo: isEntrada ? "ENTRADA" : "SAIDA",
            categoria: item.categoriaConfirmada || linha.categoriaSugerida || "Extrato Bancário",
            descricao: linha.descricaoOriginal,
            valor: valorPositivo,
            formaPagamento: "TRANSFERENCIA",
            status: "CONFIRMADO",
            favorecido: item.favorecidoConfirmado || null,
            responsavel,
            conciliado: true,
            conciliadoEm: new Date(),
            linhaExtratoId: linha.id,
          },
        });

        valorTotalLiquidoConfirmado += isEntrada ? valorPositivo : -valorPositivo;

        // Atualizar linha do extrato
        await prisma.linhaExtrato.update({
          where: { id: linha.id },
          data: {
            categoriaConfirmada: item.categoriaConfirmada,
            favorecidoConfirmado: item.favorecidoConfirmado,
            status: "CONCILIADO",
            movimentacaoId: mov.id,
          },
        });
      } else if (item.status === "IGNORADO") {
        await prisma.linhaExtrato.update({
          where: { id: linha.id },
          data: {
            status: "IGNORADO",
            justificativaIgnorado: item.justificativaIgnorado || "Ignorado pelo usuário.",
          },
        });
      }
    }

    // Atualizar saldo atual da conta financeira bancária
    if (valorTotalLiquidoConfirmado !== 0) {
      await prisma.contaFinanceira.update({
        where: { id: importacao.contaId },
        data: { saldoAtual: { increment: valorTotalLiquidoConfirmado } },
      });
    }

    // Marcar importação como CONCILIADO
    await prisma.importacaoExtrato.update({
      where: { id: importacaoId },
      data: { status: "CONCILIADO" },
    });

    revalidatePath("/extratos");
    revalidatePath("/caixa");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao confirmar conciliação:", error);
    return { success: false, error: "Falha ao consolidar movimentações do extrato no caixa." };
  }
}

export async function criarRegraClassificacao(padraoTexto: string, categoria: string, tipoMovimento: "ENTRADA" | "SAIDA", criadoPor: string) {
  try {
    if (!padraoTexto?.trim() || !categoria?.trim()) {
      return { success: false, error: "Padrão de texto e categoria são obrigatórios." };
    }

    const regra = await prisma.regraClassificacaoBancaria.create({
      data: {
        padraoTexto: padraoTexto.trim().toUpperCase(),
        categoria: categoria.trim(),
        tipoMovimento,
        criadoPor,
      },
    });

    revalidatePath("/extratos");
    return { success: true, data: regra };
  } catch (error) {
    console.error("Erro ao criar regra:", error);
    return { success: false, error: "Erro ao cadastrar regra inteligente." };
  }
}
