import React, { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Map, Search, Upload } from "lucide-react";
import {
  addPersonTag,
  batchAssignOuting,
  batchAssignTrip,
  batchDeleteMedia,
  batchSetLocation,
  createTripByDateRange,
  deleteMediaItem,
  deleteOuting,
  deletePersonCluster,
  deleteTripGrouping,
  fetchMedia,
  fetchOutings,
  fetchPeople,
  fetchTimelineStats,
  fetchTrips,
  mergeOutings,
  mergePeople,
  mergeTrips,
  recomputeOutings,
  recomputeTrips,
  removePersonTag,
  renameOuting,
  renamePerson,
  renameTrip,
} from "./api/client";
import { BackupModal } from "./components/BackupModal";
import { BatchLocationModal } from "./components/BatchLocationModal";
import { BatchOutingModal } from "./components/BatchOutingModal";
import { BatchTripModal } from "./components/BatchTripModal";
import { GalleryDrawer } from "./components/GalleryDrawer";
import { LightboxModal } from "./components/LightboxModal";
import { MapView } from "./components/MapView";
import { OutingsBar } from "./components/OutingsBar";
import { OutingsModal } from "./components/OutingsModal";
import { PeopleFilterBar } from "./components/PeopleFilterBar";
import { PeopleModal } from "./components/PeopleModal";
import { TimelineBar } from "./components/TimelineBar";
import { TripsModal } from "./components/TripsModal";
import { TripsPanel } from "./components/TripsPanel";
import { UploadModal } from "./components/UploadModal";
import { MediaItem, Outing, Person, TimelineStats, Trip } from "./types";

export const App: React.FC = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [clusterOverrideMedia, setClusterOverrideMedia] = useState<MediaItem[] | null>(null);
  const [clusterTitle, setClusterTitle] = useState<string | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [outings, setOutings] = useState<Outing[]>([]);
  const [timelineStats, setTimelineStats] = useState<TimelineStats | null>(null);

  // Filter State
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [peopleMode, setPeopleMode] = useState<"AND" | "OR">("AND");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedOutingId, setSelectedOutingId] = useState<string | null>(null);
  const [untaggedOnly, setUntaggedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showRoute, setShowRoute] = useState<boolean>(true);

  // Map focus & Batch Location State
  const [focusCoords, setFocusCoords] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isPickingLocationOnMap, setIsPickingLocationOnMap] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Modals
  const [isPeopleModalOpen, setIsPeopleModalOpen] = useState(false);
  const [isTripsModalOpen, setIsTripsModalOpen] = useState(false);
  const [isOutingsModalOpen, setIsOutingsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBatchLocationModalOpen, setIsBatchLocationModalOpen] = useState(false);
  const [isBatchTripModalOpen, setIsBatchTripModalOpen] = useState(false);
  const [isBatchOutingModalOpen, setIsBatchOutingModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  const loadMetadata = useCallback(async () => {
    const [peopleData, tripsData, outingsData, timelineData] = await Promise.all([
      fetchPeople(),
      fetchTrips(),
      fetchOutings(selectedTripId),
      fetchTimelineStats(selectedTripId, selectedOutingId),
    ]);
    setPeople(peopleData);
    setTrips(tripsData);
    setOutings(outingsData);
    setTimelineStats(timelineData);
  }, [selectedTripId, selectedOutingId]);

  const loadMedia = useCallback(
    async (preserveCluster = false) => {
      const items = await fetchMedia({
        personIds: selectedPersonIds,
        peopleMode,
        startDate,
        endDate,
        tripId: selectedTripId,
        outingId: selectedOutingId,
        untaggedOnly,
        search: searchQuery,
      });
      setMedia(items);
      if (preserveCluster) {
        const byId = new globalThis.Map(items.map((m) => [m.id, m]));
        setClusterOverrideMedia((prev) => {
          if (!prev) return null;
          const updated = prev
            .map((oldItem) => byId.get(oldItem.id))
            .filter((x): x is MediaItem => Boolean(x));
          return updated.length > 0 ? updated : null;
        });
      } else {
        setClusterOverrideMedia(null);
        setClusterTitle(null);
      }
    },
    [
      selectedPersonIds,
      peopleMode,
      startDate,
      endDate,
      selectedTripId,
      selectedOutingId,
      untaggedOnly,
      searchQuery,
    ]
  );

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleTogglePerson = (personId: string) => {
    setSelectedPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  const handleSelectTrip = (trip: Trip | null) => {
    setStartDate(null);
    setEndDate(null);
    setSelectedOutingId(null);
    if (!trip) {
      setSelectedTripId(null);
      return;
    }
    setSelectedTripId(trip.id);
    setUntaggedOnly(false);
    setFocusCoords({ lat: trip.center_lat, lng: trip.center_lng, zoom: 10 });
  };

  const handleSelectOuting = (outing: Outing | null) => {
    if (!outing) {
      setSelectedOutingId(null);
      return;
    }
    setSelectedOutingId(outing.id);
    setUntaggedOnly(false);
    setFocusCoords({ lat: outing.center_lat, lng: outing.center_lng, zoom: 13.5 });
  };

  const handleRenamePerson = async (personId: string, newName: string) => {
    await renamePerson(personId, newName);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleMergePeople = async (sourceId: string, targetId: string) => {
    await mergePeople(sourceId, targetId);
    setSelectedPersonIds((prev) => prev.filter((id) => id !== sourceId));
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleDeletePersonCluster = async (person: Person) => {
    if (
      !window.confirm(
        `Descartar "${person.name}" (ex: quadro, estátua ou desconhecido)?\n\nIsso removerá apenas a marcação de rosto (${person.photo_count} foto(s)). As fotos originais da viagem NÃO serão apagadas.`
      )
    ) {
      return;
    }
    await deletePersonCluster(person.id);
    setSelectedPersonIds((prev) => prev.filter((id) => id !== person.id));
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleApplyBatchLocation = async (
    lat: number,
    lng: number,
    locationName?: string
  ) => {
    await batchSetLocation(selectedMediaIds, lat, lng, locationName);
    setSelectedMediaIds([]);
    setPickedCoords(null);
    setIsPickingLocationOnMap(false);
    await Promise.all([loadMetadata(), loadMedia()]);
    setFocusCoords({ lat, lng, zoom: 12 });
  };

  const handleAddPersonTag = async (mediaId: string, personName: string) => {
    const updated = await addPersonTag(mediaId, personName);
    setLightboxItem(updated);
    await Promise.all([loadMetadata(), loadMedia(true)]);
  };

  const handleRemovePersonTag = async (mediaId: string, personId: string) => {
    const updated = await removePersonTag(mediaId, personId);
    setLightboxItem(updated);
    await Promise.all([loadMetadata(), loadMedia(true)]);
  };

  const handleDeleteSingleMedia = async (item: MediaItem) => {
    if (!window.confirm(`Deseja realmente excluir "${item.filename}" permanentemente?`)) {
      return;
    }
    const activeList = clusterOverrideMedia ?? media;
    const currentIdx = activeList.findIndex((m) => m.id === item.id);
    const nextItem =
      currentIdx >= 0
        ? activeList[currentIdx + 1] ?? activeList[currentIdx - 1] ?? null
        : null;

    await deleteMediaItem(item.id);
    if (lightboxItem?.id === item.id) {
      setLightboxItem(nextItem);
    }
    setSelectedMediaIds((prev) => prev.filter((id) => id !== item.id));
    await Promise.all([loadMetadata(), loadMedia(true)]);
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedMediaIds.length === 0) return;
    if (
      !window.confirm(
        `Deseja realmente excluir ${selectedMediaIds.length} foto(s) selecionada(s) permanentemente?`
      )
    ) {
      return;
    }
    await batchDeleteMedia(selectedMediaIds);
    setSelectedMediaIds([]);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleBatchAssignTrip = async (options: {
    tripId?: string;
    newTripTitle?: string;
  }) => {
    await batchAssignTrip(selectedMediaIds, options);
    setSelectedMediaIds([]);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleRenameTrip = async (tripId: string, title: string) => {
    await renameTrip(tripId, title);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleMergeTrips = async (sourceId: string, targetId: string) => {
    await mergeTrips(sourceId, targetId);
    if (selectedTripId === sourceId) {
      setSelectedTripId(targetId);
    }
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleCreateTripByRange = async (
    title: string,
    startIso?: string,
    endIso?: string
  ) => {
    const created = await createTripByDateRange(title, startIso, endIso);
    setSelectedTripId(created.id);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleDeleteTripGrouping = async (tripId: string) => {
    if (
      !window.confirm(
        "Deseja desfazer este agrupamento de viagem? (As fotos não serão excluídas)."
      )
    ) {
      return;
    }
    await deleteTripGrouping(tripId);
    if (selectedTripId === tripId) {
      setSelectedTripId(null);
    }
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleRecomputeAutoTrips = async () => {
    await recomputeTrips(false);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleBatchAssignOuting = async (options: {
    outingId?: string;
    newOutingTitle?: string;
    city?: string;
  }) => {
    await batchAssignOuting(selectedMediaIds, {
      ...options,
      tripId: selectedTripId,
    });
    setSelectedMediaIds([]);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleRenameOuting = async (outingId: string, title: string, city?: string) => {
    await renameOuting(outingId, title, city);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleMergeOutings = async (sourceId: string, targetId: string) => {
    await mergeOutings(sourceId, targetId);
    if (selectedOutingId === sourceId) {
      setSelectedOutingId(targetId);
    }
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleDeleteOuting = async (outingId: string) => {
    if (
      !window.confirm(
        "Deseja remover este passeio/local? (As fotos da viagem não serão excluídas)."
      )
    ) {
      return;
    }
    await deleteOuting(outingId);
    if (selectedOutingId === outingId) {
      setSelectedOutingId(null);
    }
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const handleRecomputeAutoOutings = async () => {
    await recomputeOutings(false);
    await Promise.all([loadMetadata(), loadMedia()]);
  };

  const displayedGalleryMedia = clusterOverrideMedia ?? media;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Top Navbar (Clean Light Mode) */}
      <header className="bg-white border-b border-slate-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">TripMap</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                iPhone 16 Plus & Galaxy S25
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Suas viagens no mapa • Filtros por pessoas e linha do tempo
            </p>
          </div>
        </div>

        {/* Search & Upload Actions */}
        <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cidade, país, arquivo ou celular..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 border border-transparent focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={() => setIsBackupModalOpen(true)}
            title="Exportar ou importar curadoria (Viagens, Passeios, Pessoas e Locais)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0"
          >
            <DatabaseBackup className="w-3.5 h-3.5 text-blue-600" />
            <span>Backup / Migrar</span>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Fotos</span>
          </button>
        </div>
      </header>

      {/* People Filter Bar (Multi-select + Boolean AND / OR) */}
      <PeopleFilterBar
        people={people}
        selectedIds={selectedPersonIds}
        peopleMode={peopleMode}
        onTogglePerson={handleTogglePerson}
        onChangeMode={setPeopleMode}
        onClearPeople={() => setSelectedPersonIds([])}
        onOpenManageModal={() => setIsPeopleModalOpen(true)}
      />

      {/* Trips / Moments Horizontal Bar */}
      <TripsPanel
        trips={trips}
        selectedTripId={selectedTripId}
        onSelectTrip={handleSelectTrip}
        onOpenManageTrips={() => setIsTripsModalOpen(true)}
      />

      {/* Outings / Specific Places Sub-Bar (Passeios & Locais inside Trip) */}
      <OutingsBar
        outings={outings}
        selectedOutingId={selectedOutingId}
        onSelectOuting={handleSelectOuting}
        onOpenManageOutings={() => setIsOutingsModalOpen(true)}
      />

      {/* Main Split Workspace: Interactive Map + Photo Gallery */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-[340px] h-full relative">
          <div className="flex-1 relative">
            <MapView
              media={media}
              showRoute={showRoute}
              focusCoords={focusCoords}
              isPickingLocation={isPickingLocationOnMap}
              onPickLocation={(lat, lng) => {
                setPickedCoords({ lat, lng });
                setIsPickingLocationOnMap(false);
                setIsBatchLocationModalOpen(true);
              }}
              onSelectClusterMedia={(items, title) => {
                setClusterOverrideMedia(items);
                setClusterTitle(title);
              }}
              onOpenLightbox={(item) => setLightboxItem(item)}
            />
          </div>

          {/* Interactive Timeline Range Filter Bar */}
          <TimelineBar
            stats={timelineStats}
            startDate={startDate}
            endDate={endDate}
            selectedTripId={selectedTripId}
            showRoute={showRoute}
            onToggleRoute={() => setShowRoute((prev) => !prev)}
            onChangeRange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            filteredCount={media.length}
          />
        </div>

        {/* Right Side Photo Gallery Drawer */}
        <GalleryDrawer
          media={displayedGalleryMedia}
          title={clusterTitle}
          selectedMediaIds={selectedMediaIds}
          untaggedOnly={untaggedOnly}
          untaggedTotalCount={timelineStats?.untagged_count ?? 0}
          onToggleUntaggedOnly={() => setUntaggedOnly((prev) => !prev)}
          onToggleSelectMedia={(id) =>
            setSelectedMediaIds((prev) =>
              prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
            )
          }
          onSelectAll={() => setSelectedMediaIds(displayedGalleryMedia.map((m) => m.id))}
          onClearSelection={() => setSelectedMediaIds([])}
          onOpenBatchTripModal={() => setIsBatchTripModalOpen(true)}
          onOpenBatchOutingModal={() => setIsBatchOutingModalOpen(true)}
          onQuickNameClusterOuting={() => {
            setSelectedMediaIds(displayedGalleryMedia.map((m) => m.id));
            setIsBatchOutingModalOpen(true);
          }}
          onOpenBatchLocationModal={() => setIsBatchLocationModalOpen(true)}
          onBatchDeleteSelected={handleBatchDeleteSelected}
          onDeleteSingleMedia={handleDeleteSingleMedia}
          onOpenLightbox={(item) => setLightboxItem(item)}
          onFocusOnMap={(item) => {
            if (typeof item.latitude === "number" && typeof item.longitude === "number") {
              setFocusCoords({ lat: item.latitude, lng: item.longitude, zoom: 14 });
            } else {
              setSelectedMediaIds([item.id]);
              setIsBatchLocationModalOpen(true);
            }
          }}
        />
      </div>

      {/* Modals */}
      <PeopleModal
        isOpen={isPeopleModalOpen}
        people={people}
        onClose={() => setIsPeopleModalOpen(false)}
        onRename={handleRenamePerson}
        onMerge={handleMergePeople}
        onDelete={handleDeletePersonCluster}
      />

      <TripsModal
        isOpen={isTripsModalOpen}
        trips={trips}
        onClose={() => setIsTripsModalOpen(false)}
        onRenameTrip={handleRenameTrip}
        onMergeTrips={handleMergeTrips}
        onCreateTripByRange={handleCreateTripByRange}
        onDeleteTrip={handleDeleteTripGrouping}
        onRecomputeAutoTrips={handleRecomputeAutoTrips}
      />

      <OutingsModal
        isOpen={isOutingsModalOpen}
        outings={outings}
        onClose={() => setIsOutingsModalOpen(false)}
        onRenameOuting={handleRenameOuting}
        onMergeOutings={handleMergeOutings}
        onDeleteOuting={handleDeleteOuting}
        onRecomputeOutings={handleRecomputeAutoOutings}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        trips={trips}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          loadMetadata();
          loadMedia();
        }}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccess={() => {
          loadMetadata();
          loadMedia();
        }}
      />

      <BatchTripModal
        isOpen={isBatchTripModalOpen}
        selectedCount={selectedMediaIds.length}
        trips={trips}
        onClose={() => setIsBatchTripModalOpen(false)}
        onAssignTrip={handleBatchAssignTrip}
      />

      <BatchOutingModal
        isOpen={isBatchOutingModalOpen}
        selectedCount={selectedMediaIds.length}
        outings={outings}
        onClose={() => setIsBatchOutingModalOpen(false)}
        onAssignOuting={handleBatchAssignOuting}
      />

      <BatchLocationModal
        isOpen={isBatchLocationModalOpen}
        selectedCount={selectedMediaIds.length}
        pickedCoords={pickedCoords}
        onClose={() => setIsBatchLocationModalOpen(false)}
        onStartPickOnMap={() => {
          setIsBatchLocationModalOpen(false);
          setIsPickingLocationOnMap(true);
        }}
        onApplyLocation={handleApplyBatchLocation}
      />

      <LightboxModal
        item={lightboxItem}
        items={displayedGalleryMedia}
        onSelectItem={(item) => setLightboxItem(item)}
        onClose={() => setLightboxItem(null)}
        onAddPersonTag={handleAddPersonTag}
        onRemovePersonTag={handleRemovePersonTag}
        onDeleteMedia={handleDeleteSingleMedia}
      />
    </div>
  );
};

export default App;
