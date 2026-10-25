import React from "react";
import { Compass, MapPin, Settings2, Sparkles, X } from "lucide-react";
import { Trip } from "../types";

interface TripsPanelProps {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (trip: Trip | null) => void;
  onOpenManageTrips: () => void;
}

export const TripsPanel: React.FC<TripsPanelProps> = ({
  trips,
  selectedTripId,
  onSelectTrip,
  onOpenManageTrips,
}) => {
  return (
    <div className="bg-white border-b border-slate-200/80 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto">
      <div className="flex items-center gap-2.5 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Momentos & Viagens:</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {trips.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              Nenhuma viagem agrupada ainda
            </span>
          ) : (
            trips.map((trip) => {
              const isSelected = selectedTripId === trip.id;
              return (
                <button
                  key={trip.id}
                  onClick={() => onSelectTrip(isSelected ? null : trip)}
                  className={`flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl border text-left transition-all shrink-0 ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {trip.cover_thumb_url ? (
                    <img
                      src={trip.cover_thumb_url}
                      alt={trip.title}
                      className="w-8 h-8 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Compass className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{trip.title}</p>
                    <div
                      className={`flex items-center gap-1.5 text-[10px] ${
                        isSelected ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{trip.media_count} fotos</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selectedTripId && (
          <button
            onClick={() => onSelectTrip(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ver todas</span>
          </button>
        )}
      </div>

      {/* Manage Trips Button */}
      <button
        onClick={onOpenManageTrips}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
      >
        <Settings2 className="w-3.5 h-3.5 text-slate-500" />
        <span>Organizar / Nomear Viagens</span>
      </button>
    </div>
  );
};
