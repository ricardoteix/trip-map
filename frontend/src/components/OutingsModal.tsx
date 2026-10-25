import React, { useState } from "react";
import {
  Check,
  GitMerge,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
  TreePine,
  X,
} from "lucide-react";
import { Outing } from "../types";

interface OutingsModalProps {
  isOpen: boolean;
  outings: Outing[];
  onClose: () => void;
  onRenameOuting: (outingId: string, title: string, city?: string) => Promise<void>;
  onMergeOutings: (sourceId: string, targetId: string) => Promise<void>;
  onDeleteOuting: (outingId: string) => Promise<void>;
  onRecomputeOutings: () => Promise<void>;
}

export const OutingsModal: React.FC<OutingsModalProps> = ({
  isOpen,
  outings,
  onClose,
  onRenameOuting,
  onMergeOutings,
  onDeleteOuting,
  onRecomputeOutings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState<string>("");
  const [cityInput, setCityInput] = useState<string>("");
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const startEdit = (outing: Outing) => {
    setEditingId(outing.id);
    setTitleInput(outing.title);
    setCityInput(outing.city || "");
  };

  const submitRename = async (outingId: string) => {
    if (!titleInput.trim()) return;
    setBusy(true);
    try {
      await onRenameOuting(outingId, titleInput.trim(), cityInput.trim() || undefined);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleMergeClick = async (outingId: string) => {
    if (!mergeSourceId) {
      setMergeSourceId(outingId);
      return;
    }
    if (mergeSourceId === outingId) {
      setMergeSourceId(null);
      return;
    }
    setBusy(true);
    try {
      await onMergeOutings(mergeSourceId, outingId);
      setMergeSourceId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TreePine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Passeios & Locais Específicos (Subgrupos)
              </h2>
              <p className="text-xs text-slate-500">
                Renomeie as paradas para o nome real do passeio (ex: &quot;Cachoeira do Buracão&quot; em &quot;Ibicoara-BA&quot;) ou junte dois pontos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRecomputeOutings}
              title="Detectar paradas automaticamente para fotos ainda sem passeio"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Auto-detectar paradas</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mergeSourceId && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <span>
              Modo de união ativo: clique agora no <strong>passeio de destino</strong> para juntar as fotos.
            </span>
            <button
              onClick={() => setMergeSourceId(null)}
              className="font-semibold underline hover:text-emerald-950"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outings.map((outing) => {
            const isEditing = editingId === outing.id;
            const isMergeSource = mergeSourceId === outing.id;
            const dateStr = new Date(outing.start_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            });

            return (
              <div
                key={outing.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMergeSource
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    {outing.cover_thumb_url ? (
                      <img
                        src={outing.cover_thumb_url}
                        alt={outing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <MapPin className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-1.5 flex-1">
                      <input
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitRename(outing.id)}
                        autoFocus
                        placeholder="Ex: Cachoeira do Buracão"
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-emerald-500 focus:outline-none bg-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={cityInput}
                          onChange={(e) => setCityInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitRename(outing.id)}
                          placeholder="Município (ex: Ibicoara-BA)"
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none bg-white"
                        />
                        <button
                          disabled={busy}
                          onClick={() => submitRename(outing.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {outing.title}
                        </p>
                        {outing.is_manual && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold">
                            Nomeado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {outing.city ? `${outing.city} • ` : ""}
                        {outing.media_count} fotos • {dateStr}
                      </p>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => startEdit(outing)}
                      title="Renomear passeio e município (ex: Cachoeira do Buracão / Ibicoara-BA)"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMergeClick(outing.id)}
                      title={
                        mergeSourceId
                          ? "Juntar com este passeio"
                          : "Unir este passeio com outro"
                      }
                      className={`p-1.5 rounded-lg transition-colors ${
                        isMergeSource
                          ? "bg-emerald-600 text-white"
                          : mergeSourceId
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                      }`}
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteOuting(outing.id)}
                      title="Desfazer este subgrupo (as fotos são mantidas)"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
