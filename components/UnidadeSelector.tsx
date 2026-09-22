"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";

interface UnidadeItem {
  id: string;
  nome: string;
}

export default function UnidadeSelector({
  unidades,
  unidadeAtualId,
}: {
  unidades: UnidadeItem[];
  unidadeAtualId: string | null;
}) {
  const router = useRouter();

  const handleSelect = (id: string) => {
    document.cookie = `unidade_id=${id}; path=/; max-age=31536000`; // 1 ano
    router.refresh();
  };

  const unidadeAtual = unidades.find(u => u.id === unidadeAtualId) || { id: "GLOBAL", nome: "Consolidado Own Barber Club" };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] px-3 py-2 rounded-sm text-sm font-rajdhani text-white uppercase tracking-wider transition-colors w-full justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[#E51E25] truncate">
          <MapPin size={14} className="shrink-0" />
          <span className="truncate">{unidadeAtual.nome}</span>
        </span>
        <ChevronDown size={14} className="text-gray-500 group-hover:text-white shrink-0" />
      </button>
      
      <div className="absolute top-full left-0 mt-1 w-full bg-[#111] border border-[#333] rounded-sm shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button 
          onClick={() => handleSelect("GLOBAL")}
          className={`w-full text-left px-4 py-2.5 text-xs font-rajdhani uppercase tracking-wider transition-colors border-b border-[#222] cursor-pointer ${
            unidadeAtualId === "GLOBAL" || !unidadeAtualId ? "bg-[#1E1E1E] text-[#E51E25] font-bold" : "text-gray-300 hover:text-white hover:bg-[#1A1A1A]"
          }`}
        >
          🏛️ Consolidado Own Barber Club
        </button>
        {unidades.map(u => (
          <button 
            key={u.id}
            onClick={() => handleSelect(u.id)}
            className={`w-full text-left px-4 py-2.5 text-xs font-rajdhani uppercase tracking-wider transition-colors cursor-pointer ${
              unidadeAtualId === u.id ? "bg-[#1E1E1E] text-[#E51E25] font-bold" : "text-gray-300 hover:text-white hover:bg-[#1A1A1A]"
            }`}
          >
            📍 {u.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
