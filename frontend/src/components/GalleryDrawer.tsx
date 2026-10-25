import React, { useMemo } from "react";
import {
  CalendarDays,
  Camera,
  CheckSquare,
  Compass,
  MapPin,
  MapPinOff,
  Signpost,
  Smartphone,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { MediaItem } from "../types";

interface GalleryDrawerProps {
  media: MediaItem[];
  title?: string | null;
  selectedMediaIds: string[];
  untaggedOnly: boolean;
  untaggedTotalCount: number;
  onToggleUntaggedOnly: () => void;
  onToggleSelectMedia: (mediaId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenBatchTripModal: () => void;
  onOpenBatchOutingModal: () => void;
  onQuickNameClusterOuting?: () => void;
  onOpenBatchLocationModal: () => void;
  onBatchDeleteSelected: () => void;
  onDeleteSingleMedia: (item: MediaItem) => void;
  onOpenLightbox: (item: MediaItem) => void;
  onFocusOnMap: (item: MediaItem) => void;
}

export const GalleryDrawer: React.FC<GalleryDrawerProps> = ({
  media,
  title,
  selectedMediaIds,
  untaggedOnly,
  untaggedTotalCount,
  onToggleUntaggedOnly,
  onToggleSelectMedia,
  onSelectAll,
  onClearSelection,
  onOpenBatchTripModal,
  onOpenBatchOutingModal,
  onQuickNameClusterOuting,
  onOpenBatchLocationModal,
  onBatchDeleteSelected,
  onDeleteSingleMedia,
  onOpenLightbox,
  onFocusOnMap,
}) => {
  // Group media items by Day (YYYY-MM-DD) for clear multi-day trip browsing
  const groupedByDay = useMemo(() => {
    const groups: {
      dayKey: string;
      dayLabel: string;
      cityLabel: string | null;
      items: MediaItem[];
    }[] = [];
    const map = new Map<
      string,
      { dayKey: string; dayLabel: string; cityLabel: string | null; items: MediaItem[] }
    >();

    for (const item of media) {
      const dt = new Date(item.taken_at);
      const dayKey = item.taken_at.slice(0, 10);
      let entry = map.get(dayKey);
      if (!entry) {
        const formatted = dt.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        entry = {
          dayKey,
          dayLabel: formatted,
          cityLabel: item.city || null,
          items: [],
        };
        map.set(dayKey, entry);
        groups.push(entry);
      }
      if (!entry.cityLabel && item.city) {
        entry.cityLabel = item.city;
      }
      entry.items.push(item);
    }
    return groups;
  }, [media]);

  return (
    <aside className="w-full lg:w-[410px] xl:w-[450px] h-full bg-white border-l border-slate-200/90 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {title || "Galeria por Dia"}
            </h2>
            <p className="text-xs text-slate-500">
              {media.length} {media.length === 1 ? "foto/vídeo" : "fotos/vídeos"} em{" "}
              {groupedByDay.length} {groupedByDay.length === 1 ? "dia" : "dias"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {title && onQuickNameClusterOuting && (
              <button
                onClick={onQuickNameClusterOuting}
                title="Definir todas as fotos deste pino do mapa como um Passeio / Local específico"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <Signpost className="w-3.5 h-3.5" />
                <span>Nomear Passeio</span>
              </button>
            )}

            <button
              onClick={onToggleUntaggedOnly}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                untaggedOnly
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <MapPinOff className="w-3.5 h-3.5" />
              <span>Sem GPS ({untaggedTotalCount})</span>
            </button>
          </div>
        </div>

        {/* Batch selection toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={selectedMediaIds.length === media.length ? onClearSelection : onSelectAll}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {selectedMediaIds.length > 0 && selectedMediaIds.length === media.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {selectedMediaIds.length > 0
                  ? `${selectedMediaIds.length} selecionada(s)`
                  : "Selecionar fotos"}
              </span>
            </button>
            {selectedMediaIds.length > 0 && (
              <button
                onClick={onClearSelection}
                className="text-xs text-slate-400 hover:text-slate-700 underline"
              >
                Limpar
              </button>
            )}
          </div>

          {selectedMediaIds.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={onOpenBatchOutingModal}
                title="Agrupar fotos selecionadas em um Passeio / Atrativo (ex: Cachoeira do Buracão)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs transition-colors"
              >
                <Signpost className="w-3.5 h-3.5" />
                <span>Passeio ({selectedMediaIds.length})</span>
              </button>
              <button
                onClick={onOpenBatchTripModal}
                title="Mover fotos selecionadas para uma Viagem"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-xs transition-colors"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Viagem</span>
              </button>
              <button
                onClick={onOpenBatchLocationModal}
                title="Definir localização para as fotos selecionadas"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>GPS</span>
              </button>
              <button
                onClick={onBatchDeleteSelected}
                title="Excluir permanentemente as fotos selecionadas"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Day-Grouped Photo Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {media.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Camera className="w-10 h-10 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-600">
              Nenhuma mídia encontrada para este filtro
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Experimente selecionar outras pessoas ou ampliar o período da linha do tempo.
            </p>
          </div>
        ) : (
          groupedByDay.map((dayGroup) => (
            <div key={dayGroup.dayKey} className="space-y-2">
              {/* Day Section Header */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-1.5 px-2 rounded-lg border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 capitalize">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                  <span>{dayGroup.dayLabel}</span>
                  {dayGroup.cityLabel && (
                    <span className="text-blue-600 font-medium">• {dayGroup.cityLabel}</span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {dayGroup.items.length} {dayGroup.items.length === 1 ? "foto" : "fotos"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
                {dayGroup.items.map((item) => {
                  const isSelected = selectedMediaIds.includes(item.id);
                  const timeStr = new Date(item.taken_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={item.id}
                      className={`group relative rounded-2xl overflow-hidden border bg-slate-50 transition-all ${
                        isSelected
                          ? "ring-2 ring-blue-600 border-blue-600"
                          : "border-slate-200/80 hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div
                        onClick={() => onOpenLightbox(item)}
                        className="relative aspect-4/3 w-full overflow-hidden bg-slate-100 cursor-pointer"
                      >
                        <img
                          src={item.thumb_web_url}
                          alt={item.filename}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {item.media_type === "video" && (
                          <span className="absolute top-2 right-2 p-1 rounded-md bg-slate-900/70 text-white">
                            <Video className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {/* Selection Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelectMedia(item.id);
                          }}
                          title="Selecionar para editar localização ou excluir em lote"
                          className={`absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center transition-opacity ${
                            isSelected
                              ? "bg-blue-600 text-white opacity-100"
                              : "bg-white/90 text-slate-600 opacity-0 group-hover:opacity-100 shadow-xs"
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Single Delete Button on Hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSingleMedia(item);
                          }}
                          title="Excluir esta foto"
                          className="absolute bottom-2 right-2 w-6 h-6 rounded-lg bg-white/90 hover:bg-rose-600 text-rose-600 hover:text-white opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-xs transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Metadata Footer */}
                      <div className="p-2.5 bg-white">
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => onFocusOnMap(item)}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-blue-600 truncate text-left"
                            title={
                              item.latitude
                                ? "Centralizar no mapa"
                                : "Sem GPS — clique para selecionar e atribuir local"
                            }
                          >
                            <MapPin
                              className={`w-3.5 h-3.5 shrink-0 ${
                                item.latitude ? "text-blue-600" : "text-amber-500"
                              }`}
                            />
                            <span className="truncate">
                              {item.outing_title
                                ? `${item.outing_title}${item.city ? ` • ${item.city}` : ""}`
                                : item.city || item.location_name || "Sem localização"}
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                        </div>

                        {/* People tags & Camera Badge */}
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {item.people.slice(0, 4).map((p) => (
                              <span
                                key={p.id}
                                className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium truncate max-w-[75px]"
                              >
                                {p.name}
                              </span>
                            ))}
                            {item.people.length > 4 && (
                              <span className="px-1 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                                +{item.people.length - 4}
                              </span>
                            )}
                          </div>

                          {item.camera_model && (
                            <span
                              title={`${item.camera_make || ""} ${item.camera_model}`}
                              className="flex items-center gap-0.5 text-[10px] text-slate-400 shrink-0"
                            >
                              <Smartphone className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[72px]">{item.camera_model}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
