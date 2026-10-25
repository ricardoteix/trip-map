import React, { useState } from "react";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";

interface BatchLocationModalProps {
  isOpen: boolean;
  selectedCount: number;
  pickedCoords: { lat: number; lng: number } | null;
  onClose: () => void;
  onStartPickOnMap: () => void;
  onApplyLocation: (lat: number, lng: number, locationName?: string) => Promise<void>;
}

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
}

export const BatchLocationModal: React.FC<BatchLocationModalProps> = ({
  isOpen,
  selectedCount,
  pickedCoords,
  onClose,
  onStartPickOnMap,
  onApplyLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [latInput, setLatInput] = useState<string>(
    pickedCoords ? String(pickedCoords.lat) : ""
  );
  const [lngInput, setLngInput] = useState<string>(
    pickedCoords ? String(pickedCoords.lng) : ""
  );
  const [customLabel, setCustomLabel] = useState<string>("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (pickedCoords) {
      setLatInput(String(pickedCoords.lat.toFixed(6)));
      setLngInput(String(pickedCoords.lng.toFixed(6)));
    }
  }, [pickedCoords]);

  if (!isOpen) return null;

  const handleSearchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: NominatimPlace) => {
    setLatInput(Number(place.lat).toFixed(6));
    setLngInput(Number(place.lon).toFixed(6));
    setCustomLabel(place.display_name.split(",").slice(0, 2).join(","));
    setResults([]);
  };

  const handleConfirm = async () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setSaving(true);
    try {
      await onApplyLocation(lat, lng, customLabel.trim() || undefined);
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
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Definir Localização em Grupo
              </h2>
              <p className="text-xs text-slate-500">
                Aplicando coordenadas para {selectedCount} foto(s) selecionada(s)
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

        <div className="p-6 space-y-4">
          {/* Place Search via OpenStreetMap Nominatim */}
          <form onSubmit={handleSearchPlace} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Buscar cidade ou ponto turístico
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: Torre Eiffel, Paris ou Gramado, Brasil..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1"
              >
                {searching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Buscar</span>
              </button>
            </div>

            {results.length > 0 && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto bg-slate-50">
                {results.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => selectPlace(r)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 truncate block"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Or Pick directly on Map */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-100">
            <span className="text-xs text-blue-900">
              Prefere clicar direto no ponto do mapa?
            </span>
            <button
              type="button"
              onClick={onStartPickOnMap}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Clicar no Mapa</span>
            </button>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Latitude
              </label>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="-22.9519"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Longitude
              </label>
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="-43.2105"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Nome do Local (Opcional)
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Ex: Miradouro de Santa Luzia, Lisboa"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <button
            onClick={handleConfirm}
            disabled={saving || !latInput || !lngInput}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            {saving ? "Salvando..." : `Salvar Localização em ${selectedCount} foto(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};
