import React, { useState } from "react";
import { Plus, TreePine, X } from "lucide-react";
import { Outing } from "../types";

interface BatchOutingModalProps {
  isOpen: boolean;
  selectedCount: number;
  outings: Outing[];
  onClose: () => void;
  onAssignOuting: (options: {
    outingId?: string;
    newOutingTitle?: string;
    city?: string;
  }) => Promise<void>;
}

export const BatchOutingModal: React.FC<BatchOutingModalProps> = ({
  isOpen,
  selectedCount,
  outings,
  onClose,
  onAssignOuting,
}) => {
  const [selectedOutingId, setSelectedOutingId] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutingId && !newTitle.trim()) return;
    setSaving(true);
    try {
      await onAssignOuting({
        outingId: selectedOutingId || undefined,
        newOutingTitle: newTitle.trim() || undefined,
        city: city.trim() || undefined,
      });
      setNewTitle("");
      setCity("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TreePine className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Definir Passeio / Local Específico
              </h2>
              <p className="text-xs text-slate-500">
                Agrupando {selectedCount} foto(s) em um passeio da viagem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          {outings.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Escolher um passeio já existente
              </label>
              <select
                value={selectedOutingId}
                onChange={(e) => {
                  setSelectedOutingId(e.target.value);
                  if (e.target.value) setNewTitle("");
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Ou crie um novo passeio abaixo --</option>
                {outings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title} {o.city ? `(${o.city})` : ""} — {o.media_count} fotos
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ou criar novo Passeio / Atração Turística</span>
            </label>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Nome do Passeio / Local
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (e.target.value) setSelectedOutingId("");
                }}
                placeholder="Ex: Cachoeira do Buracão"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Município / Cidade (Opcional — corrige a cidade das fotos)
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Ibicoara - BA"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || (!selectedOutingId && !newTitle.trim())}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            {saving ? "Salvando..." : `Salvar Passeio em ${selectedCount} foto(s)`}
          </button>
        </form>
      </div>
    </div>
  );
};
