import React, { useState } from "react";
import { Compass, Plus, X } from "lucide-react";
import { Trip } from "../types";

interface BatchTripModalProps {
  isOpen: boolean;
  selectedCount: number;
  trips: Trip[];
  onClose: () => void;
  onAssignTrip: (options: { tripId?: string; newTripTitle?: string }) => Promise<void>;
}

export const BatchTripModal: React.FC<BatchTripModalProps> = ({
  isOpen,
  selectedCount,
  trips,
  onClose,
  onAssignTrip,
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [newTripTitle, setNewTripTitle] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId && !newTripTitle.trim()) return;
    setSaving(true);
    try {
      await onAssignTrip({
        tripId: selectedTripId || undefined,
        newTripTitle: newTripTitle.trim() || undefined,
      });
      setNewTripTitle("");
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
            <Compass className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Mover Fotos para uma Viagem
              </h2>
              <p className="text-xs text-slate-500">
                Agrupando {selectedCount} foto(s) selecionada(s)
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
          {trips.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Escolher uma viagem já existente
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => {
                  setSelectedTripId(e.target.value);
                  if (e.target.value) setNewTripTitle("");
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Ou crie uma nova viagem abaixo --</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.media_count} fotos)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Criar uma nova viagem com estas fotos</span>
            </label>
            <input
              type="text"
              value={newTripTitle}
              onChange={(e) => {
                setNewTripTitle(e.target.value);
                if (e.target.value) setSelectedTripId("");
              }}
              placeholder="Ex: Chapada Diamantina • Out 2026"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving || (!selectedTripId && !newTripTitle.trim())}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            {saving ? "Salvando..." : `Agrupar ${selectedCount} foto(s) na Viagem`}
          </button>
        </form>
      </div>
    </div>
  );
};
