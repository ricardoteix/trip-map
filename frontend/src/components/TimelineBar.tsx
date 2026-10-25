import React, { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, Pause, Play, RotateCcw, Route } from "lucide-react";
import { TimelineBucket, TimelineStats } from "../types";

export type TimelineGranularity = "day" | "month";

interface TimelineBarProps {
  stats: TimelineStats | null;
  startDate: string | null;
  endDate: string | null;
  selectedTripId: string | null;
  showRoute: boolean;
  onToggleRoute: () => void;
  onChangeRange: (start: string | null, end: string | null) => void;
  filteredCount: number;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  stats,
  startDate,
  endDate,
  selectedTripId,
  showRoute,
  onToggleRoute,
  onChangeRange,
  filteredCount,
}) => {
  const monthBuckets = stats?.buckets ?? [];
  const dayBuckets = stats?.day_buckets ?? [];

  // Default to "day" when a Trip is selected or when photos span <= 2 months
  const [granularity, setGranularity] = useState<TimelineGranularity>("day");
  const [focusedMonth, setFocusedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTripId) {
      setGranularity("day");
      setFocusedMonth(null);
    } else if (monthBuckets.length > 0 && monthBuckets.length <= 2) {
      setGranularity("day");
    }
  }, [selectedTripId, monthBuckets.length]);

  const activeBuckets: TimelineBucket[] = useMemo(() => {
    if (granularity === "month") {
      return monthBuckets;
    }
    if (focusedMonth) {
      const filteredDays = dayBuckets.filter((d) => d.month === focusedMonth);
      if (filteredDays.length > 0) return filteredDays;
    }
    return dayBuckets;
  }, [granularity, monthBuckets, dayBuckets, focusedMonth]);

  const [startIdx, setStartIdx] = useState<number>(0);
  const [endIdx, setEndIdx] = useState<number>(Math.max(0, activeBuckets.length - 1));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Sync slider indices when bucket list or mode changes
  useEffect(() => {
    setStartIdx(0);
    setEndIdx(Math.max(0, activeBuckets.length - 1));
  }, [activeBuckets.length, granularity, focusedMonth, selectedTripId]);

  // Route playback animation (step-by-step across days or months)
  useEffect(() => {
    if (!isPlaying || activeBuckets.length === 0) return;

    const timer = setInterval(() => {
      setEndIdx((prev) => {
        const next = prev + 1;
        if (next >= activeBuckets.length) {
          setIsPlaying(false);
          return activeBuckets.length - 1;
        }
        onChangeRange(activeBuckets[0].start_date, activeBuckets[next].end_date);
        return next;
      });
    }, 1150);

    return () => clearInterval(timer);
  }, [isPlaying, activeBuckets, onChangeRange]);

  if (!stats || activeBuckets.length === 0) {
    return null;
  }

  const maxCount = Math.max(...activeBuckets.map((b) => b.count), 1);

  const handleStartSlide = (idx: number) => {
    const clamped = Math.min(idx, endIdx);
    setStartIdx(clamped);
    onChangeRange(activeBuckets[clamped].start_date, activeBuckets[endIdx].end_date);
  };

  const handleEndSlide = (idx: number) => {
    const clamped = Math.max(idx, startIdx);
    setEndIdx(clamped);
    onChangeRange(activeBuckets[startIdx].start_date, activeBuckets[clamped].end_date);
  };

  const handleSelectYear = (year: number) => {
    setIsPlaying(false);
    setFocusedMonth(null);
    const firstIdx = activeBuckets.findIndex((b) => b.month.startsWith(`${year}-`));
    let lastIdx = -1;
    for (let i = activeBuckets.length - 1; i >= 0; i--) {
      if (activeBuckets[i].month.startsWith(`${year}-`)) {
        lastIdx = i;
        break;
      }
    }
    if (firstIdx !== -1 && lastIdx !== -1) {
      setStartIdx(firstIdx);
      setEndIdx(lastIdx);
      onChangeRange(activeBuckets[firstIdx].start_date, activeBuckets[lastIdx].end_date);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setFocusedMonth(null);
    setStartIdx(0);
    setEndIdx(activeBuckets.length - 1);
    onChangeRange(null, null);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (!showRoute) onToggleRoute();
      setStartIdx(0);
      setEndIdx(0);
      onChangeRange(activeBuckets[0].start_date, activeBuckets[0].end_date);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSwitchGranularity = (mode: TimelineGranularity) => {
    setIsPlaying(false);
    setGranularity(mode);
    if (mode === "month") {
      setFocusedMonth(null);
    }
    onChangeRange(null, null);
  };

  const isFiltered = Boolean(startDate || endDate || focusedMonth);
  const safeStartBucket = activeBuckets[Math.min(startIdx, activeBuckets.length - 1)];
  const safeEndBucket = activeBuckets[Math.min(endIdx, activeBuckets.length - 1)];

  return (
    <div className="bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-2.5 shadow-sm select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Top Row: Granularity Toggle (Dia / Mês), Play Route, Years & Active Range */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Granularity Toggle: Por Dia vs Por Mês */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => handleSwitchGranularity("day")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  granularity === "day"
                    ? "bg-white text-blue-600 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Por Dia ({dayBuckets.length})</span>
              </button>
              <button
                onClick={() => handleSwitchGranularity("month")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  granularity === "month"
                    ? "bg-white text-blue-600 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Por Mês ({monthBuckets.length})</span>
              </button>
            </div>

            {focusedMonth && granularity === "day" && (
              <button
                onClick={() => {
                  setFocusedMonth(null);
                  onChangeRange(null, null);
                }}
                className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium"
              >
                ← Todos os dias
              </button>
            )}

            <button
              onClick={togglePlay}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                isPlaying
                  ? "bg-amber-500 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? "Pausar" : "Play Viagem"}</span>
            </button>

            <button
              onClick={onToggleRoute}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                showRoute
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>Rota no Mapa</span>
            </button>
          </div>

          {/* Quick Year Pills */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                !isFiltered
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tudo
            </button>
            {stats.years.map((yr) => (
              <button
                key={yr}
                onClick={() => handleSelectYear(yr)}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {yr}
              </button>
            ))}
            {isFiltered && (
              <button
                onClick={handleReset}
                title="Limpar filtro de data"
                className="ml-1 p-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Window Summary */}
          <div className="text-xs text-slate-600 font-medium">
            <span className="text-slate-900 font-semibold">
              {safeStartBucket?.label}
              {safeStartBucket?.key !== safeEndBucket?.key ? ` — ${safeEndBucket?.label}` : ""}
            </span>{" "}
            <span className="text-slate-400">•</span>{" "}
            <span className="text-blue-600 font-semibold">{filteredCount} fotos</span>
          </div>
        </div>

        {/* Interactive Histogram Bars (Scrollable when many days exist) */}
        <div className="relative pt-1 pb-1">
          <div className="flex items-end gap-1.5 h-12 px-1 overflow-x-auto pb-1">
            {activeBuckets.map((bucket, idx) => {
              const active = idx >= startIdx && idx <= endIdx;
              const heightPct = Math.max(18, Math.round((bucket.count / maxCount) * 100));
              return (
                <button
                  key={bucket.key}
                  onClick={() => {
                    if (granularity === "month") {
                      // Clicking a month bar filters to that month and drills down to its days!
                      setFocusedMonth(bucket.month);
                      setGranularity("day");
                      onChangeRange(bucket.start_date, bucket.end_date);
                    } else {
                      setStartIdx(idx);
                      setEndIdx(idx);
                      onChangeRange(bucket.start_date, bucket.end_date);
                    }
                  }}
                  title={
                    granularity === "month"
                      ? `${bucket.label}: ${bucket.count} fotos (clique para abrir os dias deste mês)`
                      : `${bucket.label}${bucket.sublabel ? ` (${bucket.sublabel})` : ""}: ${
                          bucket.count
                        } fotos`
                  }
                  className="flex-1 min-w-[38px] flex flex-col items-center group shrink-0"
                >
                  <div className="w-full h-7 flex items-end justify-center">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[26px] rounded-t-md transition-all ${
                        active
                          ? "bg-blue-500 group-hover:bg-blue-600"
                          : "bg-slate-200 group-hover:bg-slate-300"
                      }`}
                    />
                  </div>
                  <span
                    className={`mt-1 text-[10px] leading-tight truncate ${
                      active ? "text-slate-800 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {bucket.label}
                  </span>
                  {bucket.sublabel && (
                    <span className="text-[9px] text-slate-400 truncate max-w-[54px] leading-none">
                      {bucket.sublabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dual Range Inputs for smooth scrubbing across days or months */}
          {activeBuckets.length > 1 && (
            <div className="flex items-center gap-3 mt-1 px-1">
              <span className="text-[11px] text-slate-400 w-12">
                {granularity === "day" ? "Dia Ini." : "Mês Ini."}
              </span>
              <input
                type="range"
                min={0}
                max={activeBuckets.length - 1}
                value={Math.min(startIdx, activeBuckets.length - 1)}
                onChange={(e) => handleStartSlide(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-[11px] text-slate-400 w-12 text-right">
                {granularity === "day" ? "Dia Fim" : "Mês Fim"}
              </span>
              <input
                type="range"
                min={0}
                max={activeBuckets.length - 1}
                value={Math.min(endIdx, activeBuckets.length - 1)}
                onChange={(e) => handleEndSlide(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
