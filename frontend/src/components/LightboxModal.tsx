import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { MediaItem } from "../types";

interface LightboxModalProps {
  item: MediaItem | null;
  items?: MediaItem[];
  onSelectItem?: (item: MediaItem) => void;
  onClose: () => void;
  onAddPersonTag: (mediaId: string, name: string) => Promise<void>;
  onRemovePersonTag: (mediaId: string, personId: string) => Promise<void>;
  onDeleteMedia: (item: MediaItem) => Promise<void>;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  item,
  items = [],
  onSelectItem,
  onClose,
  onAddPersonTag,
  onRemovePersonTag,
  onDeleteMedia,
}) => {
  const [newPersonName, setNewPersonName] = useState("");
  const [adding, setAdding] = useState(false);

  const currentIndex = useMemo(() => {
    if (!item || items.length === 0) return -1;
    return items.findIndex((m) => m.id === item.id);
  }, [item, items]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectItem) {
      onSelectItem(items[currentIndex - 1]);
    }
  }, [hasPrev, onSelectItem, items, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext && onSelectItem) {
      onSelectItem(items[currentIndex + 1]);
    }
  }, [hasNext, onSelectItem, items, currentIndex]);

  // Preload adjacent images for instant navigation
  useEffect(() => {
    if (currentIndex < 0) return;
    const neighbors = [items[currentIndex - 1], items[currentIndex + 1]].filter(
      (n): n is MediaItem => Boolean(n && n.media_type === "image")
    );
    neighbors.forEach((n) => {
      const img = new Image();
      img.src = n.thumb_web_url;
    });
  }, [currentIndex, items]);

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (isInputFocused) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, handlePrev, handleNext, onClose]);

  if (!item) return null;

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    setAdding(true);
    try {
      await onAddPersonTag(item.id, newPersonName.trim());
      setNewPersonName("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        {/* Left: Photo / Video Preview + Navigation Controls */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center relative min-h-[340px] max-h-[75vh] md:max-h-none select-none group">
          {/* Position Counter Badge */}
          {currentIndex >= 0 && items.length > 1 && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-full bg-slate-900/75 backdrop-blur-xs text-white text-xs font-semibold border border-white/15 shadow-md">
              {currentIndex + 1} / {items.length}
            </div>
          )}

          {/* Previous Button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Foto anterior (Seta Esquerda ←)"
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center border border-white/15 shadow-lg transition-all ${
                hasPrev
                  ? "bg-slate-900/70 hover:bg-blue-600 text-white cursor-pointer hover:scale-105"
                  : "bg-slate-900/30 text-white/30 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {item.media_type === "video" ? (
            <video
              key={item.id}
              src={item.original_url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] object-contain"
            />
          ) : (
            <img
              key={item.id}
              src={item.thumb_web_url}
              alt={item.filename}
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}

          {/* Next Button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              title="Próxima foto (Seta Direita →)"
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center border border-white/15 shadow-lg transition-all ${
                hasNext
                  ? "bg-slate-900/70 hover:bg-blue-600 text-white cursor-pointer hover:scale-105"
                  : "bg-slate-900/30 text-white/30 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Right: Metadata & People Tags */}
        <div className="w-full md:w-80 bg-white p-5 flex flex-col justify-between overflow-y-auto border-l border-slate-100">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 break-all">
                  {item.filename}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(item.file_size / 1024).toFixed(0)} KB{" "}
                  {item.width && item.height ? `• ${item.width}×${item.height}` : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {new Date(item.taken_at).toLocaleString("pt-BR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {item.outing_title
                    ? `${item.outing_title}${item.city ? ` • ${item.city}` : ""}`
                    : item.location_name ||
                      (item.city ? `${item.city}, ${item.country}` : "Sem coordenadas GPS")}
                </span>
              </div>

              {(item.camera_make || item.camera_model) && (
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {[item.camera_make, item.camera_model].filter(Boolean).join(" • ")}
                  </span>
                </div>
              )}
            </div>

            {/* People in this photo */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Pessoas nesta foto ({item.people.length})
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {item.people.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium"
                  >
                    {p.avatar_url && (
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span>{p.name}</span>
                    <button
                      onClick={() => onRemovePersonTag(item.id, p.id)}
                      title="Remover marcação desta foto"
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add person tag */}
              <form onSubmit={handleAddPerson} className="flex items-center gap-1.5 pt-1">
                <div className="relative flex-1">
                  <UserPlus className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="Marcar pessoa (ex: Ricardo)..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="p-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
            {items.length > 1 && (
              <div className="flex items-center justify-between gap-2 pb-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-semibold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <span className="text-[11px] font-medium text-slate-400 shrink-0">
                  {currentIndex + 1}/{items.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-semibold transition-colors"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <a
              href={item.original_url}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Abrir Arquivo Original
            </a>
            <button
              type="button"
              onClick={() => onDeleteMedia(item)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir esta foto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
