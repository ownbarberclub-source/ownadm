-- ========================================================
-- SCRIPT DE CONFIGURAÇÃO DO SISTEMA ADMINISTRATIVO
-- OWN BARBER CLUB - SUPABASE
-- ========================================================

-- 1. TABELA DE UNIDADES
CREATE TABLE IF NOT EXISTS adm_unidades (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE FATURAMENTO DIÁRIO
CREATE TABLE IF NOT EXISTS adm_faturamento_diario (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "data" TIMESTAMPTZ NOT NULL,
  "unidadeId" TEXT REFERENCES adm_unidades("id"),
  "valorAssinaturas" NUMERIC DEFAULT 0,
  "valorAvulsos" NUMERIC DEFAULT 0,
  "valorExtras" NUMERIC DEFAULT 0,
  "valorProdutos" NUMERIC DEFAULT 0,
  "valorBebidas" NUMERIC DEFAULT 0,
  "valorOutrasReceitas" NUMERIC DEFAULT 0,
  "valorDescontos" NUMERIC DEFAULT 0,
  "valorEstornos" NUMERIC DEFAULT 0,
  "faturamentoBruto" NUMERIC DEFAULT 0,
  "faturamentoLiquido" NUMERIC DEFAULT 0,
  "valorDinheiro" NUMERIC DEFAULT 0,
  "valorPix" NUMERIC DEFAULT 0,
  "valorDebito" NUMERIC DEFAULT 0,
  "valorCredito" NUMERIC DEFAULT 0,
  "valorOutros" NUMERIC DEFAULT 0,
  "totalMeiosPagamento" NUMERIC DEFAULT 0,
  "diferencaPagamento" NUMERIC DEFAULT 0,
  "justificativaDiferenca" TEXT,
  "status" TEXT DEFAULT 'FECHADO',
  "responsavel" TEXT DEFAULT 'Administrador',
  "observacoes" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("unidadeId", "data")
);

-- 3. TABELA DE CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS adm_contas_pagar (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "nome" TEXT NOT NULL,
  "valor" NUMERIC NOT NULL,
  "dataVencimento" TIMESTAMPTZ NOT NULL,
  "dataPagamento" TIMESTAMPTZ,
  "tipoDespesa" TEXT DEFAULT 'FIXO',
  "categoria" TEXT NOT NULL,
  "descricao" TEXT,
  "mesReferencia" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'PENDENTE',
  "observacao" TEXT,
  "unidadeId" TEXT REFERENCES adm_unidades("id"),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. POLÍTICAS DE ACESSO (RLS)
ALTER TABLE adm_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_faturamento_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total adm_unidades" ON adm_unidades;
CREATE POLICY "Acesso total adm_unidades" ON adm_unidades FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total adm_faturamento_diario" ON adm_faturamento_diario;
CREATE POLICY "Acesso total adm_faturamento_diario" ON adm_faturamento_diario FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total adm_contas_pagar" ON adm_contas_pagar;
CREATE POLICY "Acesso total adm_contas_pagar" ON adm_contas_pagar FOR ALL USING (true) WITH CHECK (true);

-- 5. DADOS DAS UNIDADES OFICIAIS
INSERT INTO adm_unidades ("id", "nome") VALUES
  ('cmubrzybg0000lz0d4kkmj7bx', 'Own Barber Club Centro'),
  ('cmubrzygd0001lz0doyo02ao5', 'Own Barber Club Avenida'),
  ('cmubrzyii0002lz0dzc79bddr', 'Own Barber Club Efapi')
ON CONFLICT ("id") DO UPDATE SET "nome" = EXCLUDED."nome";

-- 6. LANÇAMENTOS EXISTENTES
INSERT INTO adm_faturamento_diario ("id", "data", "unidadeId", "valorPix", "valorCredito", "valorDebito", "valorDinheiro", "valorAssinaturas", "faturamentoBruto", "faturamentoLiquido", "totalMeiosPagamento", "status", "responsavel", "observacoes") VALUES ('cmud47dtb00035qdv4vwvyx8x', '2026-09-01T12:00:00.000Z', 'cmubrzygd0001lz0doyo02ao5', 310, 15, 59.99, 15, 0, 399.99, 399.99, 399.99, 'FECHADO', 'Administrador', NULL) ON CONFLICT ("unidadeId", "data") DO NOTHING;
INSERT INTO adm_faturamento_diario ("id", "data", "unidadeId", "valorPix", "valorCredito", "valorDebito", "valorDinheiro", "valorAssinaturas", "faturamentoBruto", "faturamentoLiquido", "totalMeiosPagamento", "status", "responsavel", "observacoes") VALUES ('cmud48xsx00055qdvhitv4ejv', '2026-09-02T12:00:00.000Z', 'cmubrzygd0001lz0doyo02ao5', 200, 77, 348, 0, 0, 625, 625, 625, 'FECHADO', 'Administrador', NULL) ON CONFLICT ("unidadeId", "data") DO NOTHING;
INSERT INTO adm_faturamento_diario ("id", "data", "unidadeId", "valorPix", "valorCredito", "valorDebito", "valorDinheiro", "valorAssinaturas", "faturamentoBruto", "faturamentoLiquido", "totalMeiosPagamento", "status", "responsavel", "observacoes") VALUES ('cmud4gd7600075qdvhyz2fgyg', '2026-09-03T12:00:00.000Z', 'cmubrzygd0001lz0doyo02ao5', 273.5, 189.99, 478.98, 50, 0, 992.47, 992.47, 992.47, 'FECHADO', 'Administrador', NULL) ON CONFLICT ("unidadeId", "data") DO NOTHING;
INSERT INTO adm_faturamento_diario ("id", "data", "unidadeId", "valorPix", "valorCredito", "valorDebito", "valorDinheiro", "valorAssinaturas", "faturamentoBruto", "faturamentoLiquido", "totalMeiosPagamento", "status", "responsavel", "observacoes") VALUES ('cmud4lhex000f5qdvznpp3tn8', '2026-09-01T12:00:00.000Z', 'cmubrzybg0000lz0d4kkmj7bx', 400, 200, 100, 300, 0, 1000, 1000, 1000, 'FECHADO', 'Administrador', NULL) ON CONFLICT ("unidadeId", "data") DO NOTHING;

INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4i7yr00095qdvbybrxlyb', 'ALUGUEL AVENIDA', 1500, '2026-09-08T12:00:00.000Z', '2026-09-22T12:00:00.000Z', 'FIXO', 'Aluguel', 'ALUGUEL AVENIDA', '2026-09', 'PAGA', NULL, 'cmubrzygd0001lz0doyo02ao5') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4j1ay000b5qdvtlm14pnm', 'LUZ', 200, '2026-09-30T12:00:00.000Z', NULL, 'FIXO', 'Aluguel', 'LUZ', '2026-09', 'PENDENTE', NULL, 'cmubrzygd0001lz0doyo02ao5') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4jhjn000d5qdvkrovxyax', 'SALARIO SUH', 500, '2026-09-16T12:00:00.000Z', NULL, 'FIXO', 'Aluguel', 'SALARIO SUH', '2026-09', 'ATRASADA', NULL, 'cmubrzygd0001lz0doyo02ao5') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4mhq3000h5qdvd3v3dmix', 'ALUGUEL', 500, '2026-09-22T12:00:00.000Z', '2026-09-22T12:00:00.000Z', 'FIXO', 'Aluguel', 'ALUGUEL', '2026-09', 'PAGA', NULL, 'cmubrzybg0000lz0d4kkmj7bx') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4owue000j5qdviw158g4r', 'NASSER', 200, '2026-09-09T12:00:00.000Z', '2026-09-22T12:00:00.000Z', 'FIXO', 'Comissões', 'NASSER', '2026-09', 'PAGA', NULL, 'cmubrzygd0001lz0doyo02ao5') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4pmaq000l5qdvs5scl8hr', 'EDU', 100, '2026-09-22T12:00:00.000Z', '2026-09-22T12:00:00.000Z', 'FIXO', 'Comissões', 'EDU', '2026-09', 'PAGA', NULL, 'cmubrzyii0002lz0dzc79bddr') ON CONFLICT ("id") DO NOTHING;
INSERT INTO adm_contas_pagar ("id", "nome", "valor", "dataVencimento", "dataPagamento", "tipoDespesa", "categoria", "descricao", "mesReferencia", "status", "observacao", "unidadeId") VALUES ('cmud4q9wn000n5qdvvoi9odsh', 'JOHN', 230, '2026-09-22T12:00:00.000Z', '2026-09-22T12:00:00.000Z', 'FIXO', 'Comissões', 'JOHN', '2026-09', 'PAGA', NULL, 'cmubrzybg0000lz0d4kkmj7bx') ON CONFLICT ("id") DO NOTHING;
