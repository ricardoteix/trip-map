import React, { useState } from "react";
import {
  CalendarPlus,
  Check,
  Compass,
  GitMerge,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Trip } from "../types";

interface TripsModalProps {
  isOpen: boolean;
  trips: Trip[];
  onClose: () => void;
  onRenameTrip: (tripId: string, title: string) => Promise<void>;
  onMergeTrips: (sourceId: string, targetId: string) => Promise<void>;
  onCreateTripByRange: (
    title: string,
    startDate?: string,
    endDate?: string
  ) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onRecomputeAutoTrips: () => Promise<void>;
}

export const TripsModal: React.FC<TripsModalProps> = ({
  isOpen,
  trips,
  onClose,
  onRenameTrip,
  onMergeTrips,
  onCreateTripByRange,
  onDeleteTrip,
  onRecomputeAutoTrips,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState<string>("");
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);

  // Create Trip by Date Range state
  const [newTripTitle, setNewTripTitle] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const startEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setTitleInput(trip.title);
  };

  const submitRename = async (tripId: string) => {
    if (!titleInput.trim()) return;
    setBusy(true);
    try {
      await onRenameTrip(tripId, titleInput.trim());
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleMergeClick = async (tripId: string) => {
    if (!mergeSourceId) {
      setMergeSourceId(tripId);
      return;
    }
    if (mergeSourceId === tripId) {
      setMergeSourceId(null);
      return;
    }
    setBusy(true);
    try {
      await onMergeTrips(mergeSourceId, tripId);
      setMergeSourceId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateByRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim()) return;
    setBusy(true);
    try {
      const startIso = rangeStart ? `${rangeStart}T00:00:00Z` : undefined;
      const endIso = rangeEnd ? `${rangeEnd}T23:59:59Z` : undefined;
      await onCreateTripByRange(newTripTitle.trim(), startIso, endIso);
      setNewTripTitle("");
      setRangeStart("");
      setRangeEnd("");
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
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Organizar Momentos & Viagens
              </h2>
              <p className="text-xs text-slate-500">
                Renomeie viagens, junte várias cidades em uma única viagem ou agrupe por período de datas.
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

        {/* Create New Trip / Group by Date Range */}
        <form
          onSubmit={handleCreateByRange}
          className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4 text-blue-600" />
              <span>Criar Nova Viagem (Opcionalmente agrupando fotos de um período)</span>
            </span>
            <button
              type="button"
              onClick={onRecomputeAutoTrips}
              title="Reagrupar fotos não fixadas automaticamente"
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Recalcular Automáticas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5">
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                Nome da Viagem
              </label>
              <input
                type="text"
                value={newTripTitle}
                onChange={(e) => setNewTripTitle(e.target.value)}
                placeholder="Ex: Chapada Diamantina 2026"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                Data Inicial (Opcional)
              </label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                Data Final (Opcional)
              </label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={busy || !newTripTitle.trim()}
                className="w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                Criar
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            💡 Se você preencher a Data Inicial e Final, todas as fotos daquele período (inclusive fotos sem GPS!) serão agrupadas nessa viagem.
          </p>
        </form>

        {mergeSourceId && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-800">
            <span>
              Modo de união ativo: clique agora na <strong>viagem de destino</strong> para juntar todas as fotos em uma só.
            </span>
            <button
              onClick={() => setMergeSourceId(null)}
              className="font-semibold underline hover:text-blue-950"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Existing Trips List */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trips.map((trip) => {
            const isEditing = editingId === trip.id;
            const isMergeSource = mergeSourceId === trip.id;
            const startStr = new Date(trip.start_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const endStr = new Date(trip.end_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={trip.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMergeSource
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-slate-50/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    {trip.cover_thumb_url ? (
                      <img
                        src={trip.cover_thumb_url}
                        alt={trip.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Compass className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitRename(trip.id)}
                        autoFocus
                        placeholder="Nome da viagem..."
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-blue-400 focus:outline-none bg-white"
                      />
                      <button
                        disabled={busy}
                        onClick={() => submitRename(trip.id)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {trip.title}
                        </p>
                        {trip.is_manual && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold">
                            Fixada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {trip.media_count} fotos • {startStr}
                        {startStr !== endStr ? ` a ${endStr}` : ""}
                      </p>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => startEdit(trip)}
                      title="Renomear viagem (dica: dar o mesmo nome de outra viagem une as duas!)"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMergeClick(trip.id)}
                      title={
                        mergeSourceId
                          ? "Juntar com esta viagem"
                          : "Unir esta viagem com outra"
                      }
                      className={`p-1.5 rounded-lg transition-colors ${
                        isMergeSource
                          ? "bg-blue-600 text-white"
                          : mergeSourceId
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                      }`}
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTrip(trip.id)}
                      title="Desfazer este agrupamento (não apaga as fotos)"
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
