import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import { Compass, Layers, MapPin, Navigation } from "lucide-react";
import { MediaItem } from "../types";

export type MapStyleKey = "positron" | "bright" | "satellite";

const MAP_STYLES: Record<MapStyleKey, { label: string; style: string | maplibregl.StyleSpecification }> = {
  positron: {
    label: "Claro Minimalista",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  bright: {
    label: "Claro Detalhado",
    style: "https://tiles.openfreemap.org/styles/bright",
  },
  satellite: {
    label: "Satélite",
    style: {
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Esri World Imagery",
        },
      },
      layers: [
        {
          id: "esri-satellite",
          type: "raster",
          source: "esri",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

interface MapViewProps {
  media: MediaItem[];
  showRoute: boolean;
  focusCoords?: { lat: number; lng: number; zoom?: number } | null;
  isPickingLocation: boolean;
  onPickLocation: (lat: number, lng: number) => void;
  onSelectClusterMedia: (items: MediaItem[], title: string) => void;
  onOpenLightbox: (item: MediaItem) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  media,
  showRoute,
  focusCoords,
  isPickingLocation,
  onPickLocation,
  onSelectClusterMedia,
  onOpenLightbox,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [mapStyle, setMapStyle] = useState<MapStyleKey>("positron");
  const [zoom, setZoom] = useState<number>(2.5);
  const [bbox, setBbox] = useState<[number, number, number, number]>([-180, -85, 180, 85]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const geotaggedMedia = useMemo(
    () =>
      media.filter(
        (m): m is MediaItem & { latitude: number; longitude: number } =>
          typeof m.latitude === "number" && typeof m.longitude === "number"
      ),
    [media]
  );

  // Build Supercluster index
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<{ media: MediaItem }>({
      radius: 56,
      maxZoom: 16,
    });
    const points: Supercluster.PointFeature<{ media: MediaItem }>[] = geotaggedMedia.map((m) => ({
      type: "Feature",
      properties: { media: m },
      geometry: {
        type: "Point",
        coordinates: [m.longitude, m.latitude],
      },
    }));
    index.load(points);
    return index;
  }, [geotaggedMedia]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[mapStyle].style,
      center: [-18.0, 15.0],
      zoom: 2.3,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    const syncViewport = () => {
      const b = map.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setZoom(map.getZoom());
    };

    map.on("load", () => {
      setMapLoaded(true);
      syncViewport();
    });
    map.on("moveend", syncViewport);
    map.on("zoomend", syncViewport);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Map Click for Batch Location Picking
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (isPickingLocation) {
        onPickLocation(e.lngLat.lat, e.lngLat.lng);
      }
    };

    map.getCanvas().style.cursor = isPickingLocation ? "crosshair" : "";
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [isPickingLocation, onPickLocation]);

  // Fly to trip or focused coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    map.flyTo({
      center: [focusCoords.lng, focusCoords.lat],
      zoom: focusCoords.zoom ?? 11.5,
      speed: 1.4,
      essential: true,
    });
  }, [focusCoords]);

  // Auto-fit bounds when filtered media list changes significantly
  const fitAllPoints = () => {
    const map = mapRef.current;
    if (!map || geotaggedMedia.length === 0) return;
    if (geotaggedMedia.length === 1) {
      map.flyTo({
        center: [geotaggedMedia[0].longitude, geotaggedMedia[0].latitude],
        zoom: 13,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    geotaggedMedia.forEach((m) => bounds.extend([m.longitude, m.latitude]));
    map.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: 900 });
  };

  // Switch map style
  const handleStyleChange = (newKey: MapStyleKey) => {
    setMapStyle(newKey);
    const map = mapRef.current;
    if (!map) return;
    setMapLoaded(false);
    map.setStyle(MAP_STYLES[newKey].style);
    map.once("styledata", () => {
      setMapLoaded(true);
    });
  };

  // Draw / Update chronological route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = "trip-route-source";
    const layerId = "trip-route-layer";

    const coordinates = showRoute
      ? [...geotaggedMedia]
          .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime())
          .map((m) => [m.longitude, m.latitude])
      : [];

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    };

    const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      try {
        map.addSource(sourceId, { type: "geojson", data: geojson });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 3,
            "line-dasharray": [2, 2],
            "line-opacity": 0.75,
          },
        });
      } catch {
        // Style transition in progress
      }
    }
  }, [geotaggedMedia, showRoute, mapLoaded]);

  // Render Apple Photos-style Photo Thumbnail Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const clusters = clusterIndex.getClusters(bbox, Math.round(zoom));

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties as any;
      const isCluster = Boolean(props.cluster);

      let coverItem: MediaItem;
      let count = 1;
      let clusterLeaves: MediaItem[] = [];

      if (isCluster) {
        const clusterId = props.cluster_id as number;
        count = props.point_count as number;
        const leaves = clusterIndex.getLeaves(clusterId, 100);
        clusterLeaves = leaves.map((l) => l.properties.media);
        coverItem = clusterLeaves[0];
      } else {
        coverItem = props.media as MediaItem;
        clusterLeaves = [coverItem];
      }

      if (!coverItem) return;

      const el = document.createElement("div");
      el.className = "tripmap-marker cursor-pointer select-none group";

      const sizeClass = count > 20 ? "w-16 h-16" : count > 1 ? "w-14 h-14" : "w-12 h-12";
      const cityLabel = coverItem.outing_title || coverItem.city || coverItem.location_name || "";

      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="relative ${sizeClass} rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-900/10 transition-shadow group-hover:shadow-xl">
            <img
              src="${coverItem.thumb_map_url}"
              alt="${coverItem.filename}"
              class="w-full h-full object-cover rounded-xl bg-slate-100"
              loading="lazy"
            />
            ${
              count > 1
                ? `<span class="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shadow-md ring-2 ring-white">
                    ${count}
                   </span>`
                : ""
            }
          </div>
          <div class="w-2.5 h-2.5 bg-white rotate-45 -mt-1.5 shadow-sm ring-1 ring-slate-900/5"></div>
          ${
            cityLabel
              ? `<span class="mt-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-sm text-[11px] font-medium text-slate-700 shadow-sm border border-slate-200/80 max-w-[130px] truncate">
                  ${cityLabel}
                 </span>`
              : ""
          }
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPickingLocation) {
          onPickLocation(lat, lng);
          return;
        }
        if (isCluster) {
          const currentZoom = map.getZoom();
          if (currentZoom < 12 && count > 4) {
            const expansionZoom = Math.min(
              clusterIndex.getClusterExpansionZoom(props.cluster_id),
              15
            );
            map.flyTo({ center: [lng, lat], zoom: expansionZoom, speed: 1.4 });
          }
          onSelectClusterMedia(
            clusterLeaves,
            coverItem.outing_title
              ? `${coverItem.outing_title} (${count} fotos)`
              : coverItem.city
                ? `${coverItem.city} (${count} fotos)`
                : `Local selecionado (${count} fotos)`
          );
        } else {
          onOpenLightbox(coverItem);
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [clusterIndex, bbox, zoom, isPickingLocation]);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Picking Location Banner */}
      {isPickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium shadow-lg animate-bounce">
          <MapPin className="w-4 h-4" />
          <span>Clique em qualquer ponto do mapa para definir a localização das fotos</span>
        </div>
      )}

      {/* Map Floating Controls (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-1 shadow-sm">
          <Layers className="w-4 h-4 text-slate-400 ml-2 mr-1.5" />
          {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleStyleChange(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                mapStyle === key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {MAP_STYLES[key].label}
            </button>
          ))}
        </div>

        <button
          onClick={fitAllPoints}
          title="Centralizar em todas as fotos filtradas"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          <span>Enquadrar Fotos ({geotaggedMedia.length})</span>
        </button>
      </div>

      {/* Empty state overlay when filter returns 0 geotagged items */}
      {geotaggedMedia.length === 0 && !isPickingLocation && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-6 py-4 rounded-2xl shadow-lg text-center max-w-sm">
            <Navigation className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              Nenhuma foto com GPS para este filtro
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ajuste o período na linha do tempo abaixo, limpe o filtro de pessoas ou atribua um local às fotos sem GPS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
