const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Criar Unidades
  const centro = await prisma.unidade.create({ data: { nome: 'Centro' } });
  const avenida = await prisma.unidade.create({ data: { nome: 'Avenida' } });
  const efapi = await prisma.unidade.create({ data: { nome: 'Efapi' } });
  
  const unidades = [centro, avenida, efapi];

  // 2. Criar Admin
  await prisma.user.upsert({
    where: { email: 'admin@barbearia.com' },
    update: {},
    create: {
      email: 'admin@barbearia.com',
      password: 'senha_segura',
      name: 'Administrador',
    },
  });

  // 3. Barbeiros distribuídos nas unidades
  const barbeirosNomes = [
    'Marcus Vinicius', 'Rafael Souza', 'Diego Almeida', 'Thiago Costa', 
    'Lucas Ferreira', 'Rodrigo Lima', 'Gabriel Silva', 'Matheus Santos', 
    'Felipe Costa', 'João Pedro', 'Pedro Henrique', 'Marcos Paulo'
  ];

  for (let i = 0; i < barbeirosNomes.length; i++) {
    // Distribui os 12 barbeiros (4 para cada unidade)
    const unidadeId = unidades[Math.floor(i / 4)].id;
    
    await prisma.funcionario.create({
      data: {
        nome: barbeirosNomes[i],
        comissaoAvulsa: 40 + (Math.random() > 0.5 ? 5 : 0),
        comissaoAssinatura: 30 + (Math.random() > 0.5 ? 5 : 0),
        unidadeId: unidadeId
      }
    });
  }
  
  const funcCriados = await prisma.funcionario.findMany();

  // 4. Receitas
  for(let i=0; i<30; i++) {
    const f = funcCriados[Math.floor(Math.random() * funcCriados.length)];
    const tipo = Math.random() > 0.5 ? 'AVULSO' : 'ASSINATURA';
    const perc = tipo === 'AVULSO' ? f.comissaoAvulsa : f.comissaoAssinatura;
    const comissao = Math.floor(Math.random() * 200) + 50; 
    const faturamento = comissao / (perc / 100);
    
    await prisma.lancamentoReceita.create({
      data: {
        tipo,
        valorComissao: comissao,
        faturamentoCadeira: faturamento,
        formaPagamento: ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'][Math.floor(Math.random()*4)],
        data: new Date(new Date().setDate(new Date().getDate() - Math.floor(Math.random()*10))),
        funcionarioId: f.id,
        unidadeId: f.unidadeId // Receita atrelada à mesma unidade do barbeiro
      }
    });
  }

  // 5. Contas a Pagar (Despesas) - Distribuídas
  const categoriasFixas = ['Aluguel', 'Utilities', 'Salários'];
  for (const unid of unidades) {
    for (const cat of categoriasFixas) {
      await prisma.contaPagar.create({
        data: {
          nome: `${cat} Setembro`,
          valor: Math.floor(Math.random() * 2000) + 500,
          dataVencimento: new Date(new Date().setDate(Math.floor(Math.random() * 15) + 1)),
          tipoDespesa: 'FIXO',
          categoria: cat,
          unidadeId: unid.id
        }
      });
    }
  }

  console.log('Seed Multi-Unidades completo!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
