import { buscarUnidades, buscarFechamentos, buscarContasPagar } from "@/lib/supabaseData";
import { cookies } from "next/headers";
import DreClient from "./DreClient";

export default async function DrePage() {
  const cookieStore = await cookies();
  const unidadeCookieId = cookieStore.get("unidade_id")?.value || "GLOBAL";

  const [unidades, fechamentos, contas] = await Promise.all([
    buscarUnidades(),
    buscarFechamentos(),
    buscarContasPagar(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E51E25] animate-pulse"></span>
            <span className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
              Módulo 4 • Controladoria & Resultados
            </span>
          </div>
          <h1 className="text-3xl font-rajdhani font-bold text-white uppercase tracking-wider">
            Relatório DRE Gerencial
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Demonstração do Resultado do Exercício com apuração automática de receitas, despesas e margem
          </p>
        </div>
      </div>

      <DreClient
        fechamentos={fechamentos}
        contas={contas}
        unidades={unidades}
        unidadeInicialId={unidadeCookieId}
      />
    </div>
  );
}
