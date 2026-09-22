import { buscarUnidades, buscarFechamentos } from "@/lib/supabaseData";
import { cookies } from "next/headers";
import FaturamentoClient from "./FaturamentoClient";

export default async function FaturamentoPage() {
  const cookieStore = await cookies();
  const unidadeCookieId = cookieStore.get("unidade_id")?.value || "GLOBAL";

  const [unidades, fechamentos] = await Promise.all([
    buscarUnidades(),
    buscarFechamentos(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E51E25] animate-pulse"></span>
            <span className="text-[10px] font-mono text-[#E51E25] tracking-widest uppercase font-semibold">
              Módulo 2 • Caixa & Entradas
            </span>
          </div>
          <h1 className="text-3xl font-rajdhani font-bold text-white uppercase tracking-wider">
            Faturamento Diário
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Lançamento e controle de fechamentos por meio de recebimento (PIX, Cartão, Dinheiro e Assinatura)
          </p>
        </div>
      </div>

      <FaturamentoClient
        fechamentos={fechamentos}
        unidades={unidades}
        unidadeInicialId={unidadeCookieId}
      />
    </div>
  );
}
