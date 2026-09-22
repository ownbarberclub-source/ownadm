import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { buscarUnidades } from "@/lib/supabaseData";
import Image from "next/image";
import UnidadeSelector from "@/components/UnidadeSelector";
import SidebarNav from "@/components/SidebarNav";

// Fontes para estética F1/Telemetria
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-rajdhani" });

export const metadata: Metadata = {
  title: "OWN BARBER CLUB - Gestão",
  description: "Centro de Controle de Performance",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const unidadeCookie = cookieStore.get("unidade_id")?.value || "GLOBAL";
  const unidades = await buscarUnidades();

  return (
    <html lang="pt-BR" className={`${inter.variable} ${rajdhani.variable} dark`}>
      <body className="bg-[#0D0F12] text-gray-100 antialiased m-0 p-0 min-h-screen font-sans selection:bg-[#E51E25] selection:text-white">
        <div className="flex min-h-screen bg-[#0D0F12]">
          {/* Sidebar */}
          <aside className="w-64 bg-[#121418] border-r border-[#22262E] min-h-screen flex flex-col shrink-0 relative overflow-hidden">
            {/* Detalhe de linha vermelha (telemetria) */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#E51E25] via-transparent to-transparent opacity-50"></div>
            
            <div className="p-6 flex flex-col gap-4 border-b border-[#22262E]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  <Image src="/logo.png" alt="OWN BARBER CLUB Logo" width={48} height={48} className="w-full h-full object-contain" priority />
                </div>
                <div>
                  <div className="font-rajdhani font-bold text-lg tracking-wide uppercase text-white leading-tight">OWN BARBER</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-medium">Centro de Controle</div>
                </div>
              </div>
              <UnidadeSelector unidades={unidades} unidadeAtualId={unidadeCookie} />
            </div>

            <SidebarNav />
            
            <div className="p-4 border-t border-[#22262E] bg-[#0E1013]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A1A] border border-[#333] flex items-center justify-center font-rajdhani font-bold text-[#E51E25] skew-x-[-10deg]">
                  ADM
                </div>
                <div>
                  <div className="text-sm font-rajdhani font-bold text-gray-200 tracking-wide uppercase">Unidade Principal</div>
                  <div className="text-[10px] font-mono text-[#E51E25]">SISTEMA: ONLINE</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6 md:p-8 h-screen overflow-y-auto bg-[#0D0F12] text-gray-100">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
