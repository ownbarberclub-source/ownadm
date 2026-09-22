"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, DollarSign, Wallet, FileText, Landmark, BarChart3, ChevronRight } from "lucide-react";

export default function SidebarNav() {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  const linkClass = (href: string) => {
    const active = isLinkActive(href);
    return `flex items-center gap-3 p-3 rounded-md transition-all text-sm font-medium ${
      active
        ? "bg-[#1A1A1A] text-white border-l-2 border-[#E51E25] shadow-[inset_4px_0_10px_rgba(229,30,37,0.1)]"
        : "text-gray-400 hover:text-white hover:bg-[#161616] border-l-2 border-transparent hover:border-[#444444]"
    }`;
  };

  const iconClass = (href: string) => {
    return isLinkActive(href) ? "text-[#E51E25]" : "text-gray-400 group-hover:text-white";
  };

  return (
    <nav className="p-4 flex-1 flex flex-col gap-1.5">
      {/* 1. Dashboard */}
      <Link href="/dashboard" className={linkClass("/dashboard")}>
        <Gauge size={18} className={iconClass("/dashboard")} />
        <span className="font-rajdhani font-bold tracking-wide uppercase text-[15px]">Dashboard</span>
      </Link>

      {/* Divisor Visual F1 */}
      <div className="text-[10px] font-bold text-[#555555] uppercase tracking-[0.15em] mt-4 mb-2 px-3 flex items-center gap-2">
        <span className="w-2.5 h-[2px] bg-[#E51E25]"></span>
        Operações Centrais
        <span className="flex-1 h-[1px] bg-[#222]"></span>
      </div>

      {/* 2. Faturamento Diário */}
      <Link href="/faturamento" className={linkClass("/faturamento")}>
        <DollarSign size={18} className={iconClass("/faturamento")} />
        <span className="font-rajdhani font-semibold tracking-wide uppercase text-[15px]">Faturamento Diário</span>
      </Link>

      {/* 3. Contas a Pagar */}
      <Link href="/contas" className={linkClass("/contas")}>
        <FileText size={18} className={iconClass("/contas")} />
        <span className="font-rajdhani font-semibold tracking-wide uppercase text-[15px]">Contas a Pagar</span>
      </Link>

      {/* Divisor Visual F1 */}
      <div className="text-[10px] font-bold text-[#555555] uppercase tracking-[0.15em] mt-4 mb-2 px-3 flex items-center gap-2">
        <span className="w-2.5 h-[2px] bg-[#E51E25]"></span>
        Resultados
        <span className="flex-1 h-[1px] bg-[#222]"></span>
      </div>

      {/* 4. Relatório DRE */}
      <Link href="/relatorios/dre" className={`${linkClass("/relatorios/dre")} justify-between`}>
        <div className="flex items-center gap-3">
          <BarChart3 size={18} className={iconClass("/relatorios/dre")} />
          <span className="font-rajdhani font-semibold tracking-wide uppercase text-[15px]">Relatório DRE</span>
        </div>
        <ChevronRight size={14} className="opacity-30" />
      </Link>
    </nav>
  );
}
