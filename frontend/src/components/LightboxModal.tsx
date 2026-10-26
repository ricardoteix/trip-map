import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { MediaItem } from "../types";

export interface CopiedLocation {
  lat: number;
  lng: number;
  locationName?: string;
  city?: string;
}

interface LightboxModalProps {
  item: MediaItem | null;
  items?: MediaItem[];
  onSelectItem?: (item: MediaItem) => void;
  onClose: () => void;
  onAddPersonTag: (mediaId: string, name: string) => Promise<void>;
  onRemovePersonTag: (mediaId: string, personId: string) => Promise<void>;
  onDeleteMedia: (item: MediaItem) => Promise<void>;
  onUpdateLocation?: (
    item: MediaItem,
    lat: number,
    lng: number,
    locationName?: string
  ) => Promise<void>;
  copiedLocation?: CopiedLocation | null;
  onCopyLocation?: (item: MediaItem) => void;
  onPasteLocation?: (item: MediaItem) => Promise<void>;
  onPickLocationOnMap?: (item: MediaItem) => void;
  pickedCoords?: { lat: number; lng: number } | null;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  item,
  items = [],
  onSelectItem,
  onClose,
  onAddPersonTag,
  onRemovePersonTag,
  onDeleteMedia,
  onUpdateLocation,
  copiedLocation,
  onCopyLocation,
  onPasteLocation,
  onPickLocationOnMap,
  pickedCoords,
}) => {
  const [newPersonName, setNewPersonName] = useState("");
  const [adding, setAdding] = useState(false);

  // Location Editing State
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [customName, setCustomName] = useState(item?.location_name || "");
  const [latInput, setLatInput] = useState(item?.latitude != null ? String(item.latitude) : "");
  const [lngInput, setLngInput] = useState(item?.longitude != null ? String(item.longitude) : "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  useEffect(() => {
    if (item) {
      setCustomName(item.location_name || "");
      setLatInput(item.latitude != null ? String(item.latitude) : "");
      setLngInput(item.longitude != null ? String(item.longitude) : "");
      setSearchQuery("");
      setSearchResults([]);
      setIsEditingLocation(false);
      setCopiedFeedback(false);
    }
  }, [item?.id]);

  useEffect(() => {
    if (pickedCoords) {
      setLatInput(String(pickedCoords.lat.toFixed(6)));
      setLngInput(String(pickedCoords.lng.toFixed(6)));
      setIsEditingLocation(true);
    }
  }, [pickedCoords]);

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

  const handleCopyLocation = useCallback(() => {
    if (!item) return;
    if (onCopyLocation) {
      onCopyLocation(item);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  }, [item, onCopyLocation]);

  const handlePasteLocation = useCallback(async () => {
    if (!item || !copiedLocation || !onPasteLocation) return;
    await onPasteLocation(item);
  }, [item, copiedLocation, onPasteLocation]);

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

  // Keyboard navigation & Shortcuts (ArrowLeft, ArrowRight, Escape, Ctrl+C, Ctrl+V)
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

      // Copy location shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (typeof item.latitude === "number" && typeof item.longitude === "number") {
          e.preventDefault();
          handleCopyLocation();
          return;
        }
      }

      // Paste location shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (copiedLocation) {
          e.preventDefault();
          handlePasteLocation();
          return;
        }
      }

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
  }, [item, handlePrev, handleNext, onClose, handleCopyLocation, handlePasteLocation, copiedLocation]);

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

  const handleSearchNominatim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectNominatim = (place: { display_name: string; lat: string; lon: string }) => {
    setLatInput(Number(place.lat).toFixed(6));
    setLngInput(Number(place.lon).toFixed(6));
    if (!customName.trim()) {
      setCustomName(place.display_name.split(",").slice(0, 2).join(","));
    }
    setSearchResults([]);
  };

  const handlePasteFromMemory = () => {
    if (!copiedLocation) return;
    setLatInput(Number(copiedLocation.lat).toFixed(6));
    setLngInput(Number(copiedLocation.lng).toFixed(6));
    if (copiedLocation.locationName) {
      setCustomName(copiedLocation.locationName);
    }
  };

  const handleSaveLocation = async () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert("Por favor, informe coordenadas de Latitude e Longitude válidas.");
      return;
    }
    if (onUpdateLocation) {
      setIsSavingLocation(true);
      try {
        await onUpdateLocation(item, lat, lng, customName.trim() || undefined);
        setIsEditingLocation(false);
      } finally {
        setIsSavingLocation(false);
      }
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

              {/* Location display & inline editor */}
              {!isEditingLocation ? (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {item.location_name || item.outing_title || "Sem nome personalizado"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.city ? `${item.city}${item.country ? `, ${item.country}` : ""}` : "Coordenadas não definidas"}
                        </p>
                        {typeof item.latitude === "number" && typeof item.longitude === "number" && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {typeof item.latitude === "number" && typeof item.longitude === "number" && (
                        <button
                          type="button"
                          onClick={handleCopyLocation}
                          title="Copiar coordenadas e local (Ctrl+C)"
                          className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                            copiedFeedback
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {copiedFeedback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditingLocation(true)}
                        title="Editar coordenadas ou nome do local"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Paste Button if Copied Location Available */}
                  {copiedLocation && (
                    <button
                      type="button"
                      onClick={handlePasteLocation}
                      className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Colar coordenadas copiadas (Ctrl+V)"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          Colar local: {copiedLocation.locationName || `${copiedLocation.lat.toFixed(4)}, ${copiedLocation.lng.toFixed(4)}`}
                        </span>
                      </span>
                      <span className="text-[10px] text-indigo-500 font-mono shrink-0">Ctrl+V</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      Editar Localização
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingLocation(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Custom Location Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Nome do Ponto / Atração
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: Cachoeira do Buracão, Mirante..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Search Nominatim */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Buscar Local / Endereço (OpenStreetMap)
                    </label>
                    <form onSubmit={handleSearchNominatim} className="flex gap-1.5">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Digite para buscar no mapa..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isSearching}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium shrink-0 cursor-pointer"
                      >
                        {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <div className="mt-1.5 max-h-28 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-xs">
                        {searchResults.map((r, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectNominatim(r)}
                            className="w-full p-2 text-left text-[11px] text-slate-700 hover:bg-blue-50 transition-colors block truncate cursor-pointer"
                          >
                            {r.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lat / Lng inputs */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Coordenadas (Graus Decimais)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Latitude:</span>
                        <input
                          type="text"
                          value={latInput}
                          onChange={(e) => setLatInput(e.target.value)}
                          placeholder="-12.9714"
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Longitude:</span>
                        <input
                          type="text"
                          value={lngInput}
                          onChange={(e) => setLngInput(e.target.value)}
                          placeholder="-41.3412"
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Map pick & Memory paste shortcuts */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onPickLocationOnMap && onPickLocationOnMap(item)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ajustar no Mapa Principal</span>
                    </button>

                    {copiedLocation && (
                      <button
                        type="button"
                        onClick={handlePasteFromMemory}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Preencher da Memória ({copiedLocation.locationName || "Coordenadas"})</span>
                      </button>
                    )}
                  </div>

                  {/* Save / Cancel buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsEditingLocation(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingLocation}
                      onClick={handleSaveLocation}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      {isSavingLocation ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar Local</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

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
