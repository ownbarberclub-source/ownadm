import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import ContasClient from "./ContasClient";

export default async function ContasPage() {
  const cookieStore = await cookies();
  const unidadeCookieId = cookieStore.get("unidade_id")?.value || "GLOBAL";

  const unidades = await prisma.unidade.findMany({
    orderBy: { nome: "asc" },
  });

  const contas = await prisma.contaPagar.findMany({
    include: {
      unidade: true,
    },
    orderBy: { dataVencimento: "asc" },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E51E25] animate-pulse"></span>
            <span className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
              Módulo 3 • Saídas & Custos
            </span>
          </div>
          <h1 className="text-3xl font-rajdhani font-bold text-white uppercase tracking-wider">
            Contas a Pagar
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestão simplificada de despesas operacionais por mês de referência e controle de liquidação
          </p>
        </div>
      </div>

      <ContasClient
        contas={contas}
        unidades={unidades}
        unidadeInicialId={unidadeCookieId}
      />
    </div>
  );
}
