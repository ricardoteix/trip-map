import React from "react";
import { MapPin, Settings2, TreePine, X } from "lucide-react";
import { Outing } from "../types";

interface OutingsBarProps {
  outings: Outing[];
  selectedOutingId: string | null;
  onSelectOuting: (outing: Outing | null) => void;
  onOpenManageOutings: () => void;
}

export const OutingsBar: React.FC<OutingsBarProps> = ({
  outings,
  selectedOutingId,
  onSelectOuting,
  onOpenManageOutings,
}) => {
  return (
    <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-1.5 flex items-center justify-between gap-3 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
          <TreePine className="w-3.5 h-3.5 text-emerald-600" />
          <span>Passeios & Locais:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {outings.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              Nenhum passeio específico agrupado
            </span>
          ) : (
            outings.map((outing) => {
              const isSelected = selectedOutingId === outing.id;
              return (
                <button
                  key={outing.id}
                  onClick={() => onSelectOuting(isSelected ? null : outing)}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full border text-left transition-all shrink-0 ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40"
                  }`}
                >
                  {outing.cover_thumb_url ? (
                    <img
                      src={outing.cover_thumb_url}
                      alt={outing.title}
                      className="w-5 h-5 rounded-full object-cover bg-slate-100 shrink-0"
                    />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 ml-1 shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate max-w-[180px]">
                    {outing.title}
                  </span>
                  {outing.city && !outing.title.toLowerCase().includes(outing.city.toLowerCase()) && (
                    <span
                      className={`text-[10px] truncate max-w-[95px] ${
                        isSelected ? "text-emerald-100" : "text-slate-400"
                      }`}
                    >
                      • {outing.city}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-emerald-700 text-emerald-50"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {outing.media_count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedOutingId && (
          <button
            onClick={() => onSelectOuting(null)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 shrink-0"
          >
            <X className="w-3 h-3" />
            <span>Todos os passeios</span>
          </button>
        )}
      </div>

      <button
        onClick={onOpenManageOutings}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
      >
        <Settings2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Nomear / Unir Passeios</span>
      </button>
    </div>
  );
};
