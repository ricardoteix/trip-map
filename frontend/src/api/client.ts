import {
  AuthMeResponse,
  MediaItem,
  Outing,
  Person,
  ScanStatus,
  TimelineStats,
  Trip,
  TripMember,
  TripShareResponse,
  User,
} from "../types";

export interface MediaFilterParams {
  personIds?: string[];
  peopleMode?: "AND" | "OR";
  startDate?: string | null;
  endDate?: string | null;
  tripId?: string | null;
  outingId?: string | null;
  untaggedOnly?: boolean;
  search?: string;
}

export async function fetchMedia(params: MediaFilterParams = {}): Promise<MediaItem[]> {
  const qs = new URLSearchParams();
  if (params.personIds && params.personIds.length > 0) {
    qs.set("person_ids", params.personIds.join(","));
  }
  if (params.peopleMode) {
    qs.set("people_mode", params.peopleMode);
  }
  if (params.startDate) {
    qs.set("start_date", params.startDate);
  }
  if (params.endDate) {
    qs.set("end_date", params.endDate);
  }
  if (params.tripId) {
    qs.set("trip_id", params.tripId);
  }
  if (params.outingId) {
    qs.set("outing_id", params.outingId);
  }
  if (params.untaggedOnly) {
    qs.set("untagged_only", "true");
  }
  if (params.search && params.search.trim()) {
    qs.set("search", params.search.trim());
  }

  const res = await fetch(`/api/media?${qs.toString()}`);
  if (!res.ok) throw new Error("Falha ao buscar mídias");
  return res.json();
}

export async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people");
  if (!res.ok) throw new Error("Falha ao buscar pessoas");
  return res.json();
}

export async function renamePerson(personId: string, name: string): Promise<Person> {
  const res = await fetch(`/api/people/${personId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Falha ao renomear pessoa");
  return res.json();
}

export async function mergePeople(sourceId: string, targetId: string): Promise<Person> {
  const res = await fetch("/api/people/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_person_id: sourceId,
      target_person_id: targetId,
    }),
  });
  if (!res.ok) throw new Error("Falha ao mesclar pessoas");
  return res.json();
}

export async function deletePersonCluster(personId: string): Promise<void> {
  const res = await fetch(`/api/people/${personId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Falha ao descartar grupo de rosto");
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch("/api/trips");
  if (!res.ok) throw new Error("Falha ao buscar viagens");
  return res.json();
}

export async function renameTrip(
  tripId: string,
  title: string,
  subtitle?: string
): Promise<Trip> {
  const res = await fetch(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, subtitle }),
  });
  if (!res.ok) throw new Error("Falha ao renomear viagem");
  return res.json();
}

export async function mergeTrips(sourceTripId: string, targetTripId: string): Promise<Trip> {
  const res = await fetch("/api/trips/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_trip_id: sourceTripId,
      target_trip_id: targetTripId,
    }),
  });
  if (!res.ok) throw new Error("Falha ao mesclar viagens");
  return res.json();
}

export async function createTripByDateRange(
  title: string,
  startDate?: string,
  endDate?: string,
  subtitle?: string
): Promise<Trip> {
  const res = await fetch("/api/trips/create-by-range", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      subtitle,
      start_date: startDate || null,
      end_date: endDate || null,
    }),
  });
  if (!res.ok) throw new Error("Falha ao criar viagem por período");
  return res.json();
}

export async function deleteTripGrouping(tripId: string): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Falha ao remover agrupamento de viagem");
}

export async function recomputeTrips(forceReset = false): Promise<Trip[]> {
  const res = await fetch(`/api/trips/recompute?force_reset=${forceReset}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Falha ao recalcular viagens");
  return res.json();
}

export async function batchAssignTrip(
  mediaIds: string[],
  options: { tripId?: string; newTripTitle?: string }
): Promise<MediaItem[]> {
  const res = await fetch("/api/media/batch-trip", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_ids: mediaIds,
      trip_id: options.tripId || null,
      new_trip_title: options.newTripTitle || null,
    }),
  });
  if (!res.ok) throw new Error("Falha ao mover fotos para a viagem");
  return res.json();
}

export async function fetchTimelineStats(
  tripId?: string | null,
  outingId?: string | null
): Promise<TimelineStats> {
  const qs = new URLSearchParams();
  if (tripId) qs.set("trip_id", tripId);
  if (outingId) qs.set("outing_id", outingId);
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/timeline${queryStr}`);
  if (!res.ok) throw new Error("Falha ao buscar linha do tempo");
  return res.json();
}

export async function fetchOutings(tripId?: string | null): Promise<Outing[]> {
  const qs = tripId ? `?trip_id=${encodeURIComponent(tripId)}` : "";
  const res = await fetch(`/api/outings${qs}`);
  if (!res.ok) throw new Error("Falha ao buscar passeios/locais");
  return res.json();
}

export async function renameOuting(
  outingId: string,
  title: string,
  city?: string
): Promise<Outing> {
  const res = await fetch(`/api/outings/${outingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, city }),
  });
  if (!res.ok) throw new Error("Falha ao renomear passeio/local");
  return res.json();
}

export async function mergeOutings(
  sourceOutingId: string,
  targetOutingId: string
): Promise<Outing> {
  const res = await fetch("/api/outings/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_outing_id: sourceOutingId,
      target_outing_id: targetOutingId,
    }),
  });
  if (!res.ok) throw new Error("Falha ao unir passeios");
  return res.json();
}

export async function deleteOuting(outingId: string): Promise<void> {
  const res = await fetch(`/api/outings/${outingId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Falha ao remover subgrupo de passeio");
}

export async function recomputeOutings(forceReset = false): Promise<Outing[]> {
  const res = await fetch(`/api/outings/recompute?force_reset=${forceReset}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Falha ao recalcular passeios");
  return res.json();
}

export async function batchAssignOuting(
  mediaIds: string[],
  options: {
    outingId?: string;
    newOutingTitle?: string;
    city?: string;
    tripId?: string | null;
  }
): Promise<MediaItem[]> {
  const res = await fetch("/api/media/batch-outing", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_ids: mediaIds,
      outing_id: options.outingId || null,
      new_outing_title: options.newOutingTitle || null,
      city: options.city || null,
      trip_id: options.tripId || null,
    }),
  });
  if (!res.ok) throw new Error("Falha ao definir passeio/local para as fotos");
  return res.json();
}

export async function uploadFiles(
  files: FileList | File[],
  options?: { tripId?: string; tripName?: string }
): Promise<MediaItem[]> {
  const formData = new FormData();
  Array.from(files).forEach((f) => formData.append("files", f));
  if (options?.tripId) {
    formData.append("trip_id", options.tripId);
  }
  if (options?.tripName && options.tripName.trim()) {
    formData.append("trip_name", options.tripName.trim());
  }
  const res = await fetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Falha ao enviar arquivos");
  return res.json();
}

export async function triggerFolderScan(options?: {
  tripId?: string;
  tripName?: string;
  groupBySubfolder?: boolean;
}): Promise<ScanStatus> {
  const qs = new URLSearchParams();
  if (options?.tripId) qs.set("trip_id", options.tripId);
  if (options?.tripName && options.tripName.trim()) qs.set("trip_name", options.tripName.trim());
  if (options?.groupBySubfolder) qs.set("group_by_subfolder", "true");

  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/media/scan-folder${queryStr}`, { method: "POST" });
  if (!res.ok) throw new Error("Falha ao iniciar escaneamento da pasta");
  return res.json();
}

export async function pollScanStatus(jobId: string): Promise<ScanStatus> {
  const res = await fetch(`/api/media/scan-status/${jobId}`);
  if (!res.ok) throw new Error("Falha ao consultar status da importação");
  return res.json();
}

export async function batchSetLocation(
  mediaIds: string[],
  latitude: number,
  longitude: number,
  locationName?: string
): Promise<MediaItem[]> {
  const res = await fetch("/api/media/batch-location", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_ids: mediaIds,
      latitude,
      longitude,
      location_name: locationName,
    }),
  });
  if (!res.ok) throw new Error("Falha ao salvar localização em lote");
  return res.json();
}

export async function addPersonTag(mediaId: string, personName: string): Promise<MediaItem> {
  const res = await fetch(`/api/media/${mediaId}/people`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_name: personName }),
  });
  if (!res.ok) throw new Error("Falha ao adicionar pessoa na foto");
  return res.json();
}

export async function removePersonTag(mediaId: string, personId: string): Promise<MediaItem> {
  const res = await fetch(`/api/media/${mediaId}/people/${personId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Falha ao remover pessoa da foto");
  return res.json();
}

export async function clearAllMedia(): Promise<void> {
  const res = await fetch("/api/media/clear-all", {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Falha ao limpar biblioteca");
}

export async function deleteMediaItem(mediaId: string): Promise<void> {
  const res = await fetch(`/api/media/${mediaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Falha ao excluir mídia");
}

export async function batchDeleteMedia(mediaIds: string[]): Promise<void> {
  const res = await fetch("/api/media/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_ids: mediaIds }),
  });
  if (!res.ok) throw new Error("Falha ao excluir mídias selecionadas");
}

export interface BackupImportResult {
  status: string;
  trips_restored: number;
  outings_restored: number;
  people_restored: number;
  deleted_hashes_restored: number;
  deleted_media_removed: number;
  media_updated_now: number;
  media_cached_for_scan: number;
}

export async function importCurationBackup(file: File): Promise<BackupImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/backup/import", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Falha ao importar arquivo de backup");
  }
  return res.json();
}

export async function fetchGoogleAuthUrl(): Promise<string> {
  const res = await fetch("/api/gdrive/auth-url");
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao obter URL de autenticação do Google");
  }
  const data = await res.json();
  return data.url;
}

export async function fetchGoogleAccounts(): Promise<import("../types").GoogleAccount[]> {
  const res = await fetch("/api/gdrive/accounts");
  if (!res.ok) throw new Error("Falha ao buscar contas do Google");
  return res.json();
}

export async function disconnectGoogleAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/gdrive/accounts/${accountId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Falha ao desconectar conta");
}

export async function fetchDriveFolders(
  accountId: string,
  parentId?: string
): Promise<import("../types").GoogleDriveFolderItem[]> {
  const qs = new URLSearchParams({ account_id: accountId });
  if (parentId) qs.set("parent_id", parentId);
  const res = await fetch(`/api/gdrive/folders?${qs.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao listar pastas do Google Drive");
  }
  return res.json();
}

export async function triggerDriveFolderSync(options: {
  accountId: string;
  folderId: string;
  folderName?: string;
  tripId?: string;
  tripName?: string;
}): Promise<ScanStatus> {
  const res = await fetch("/api/gdrive/sync-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: options.accountId,
      folder_id: options.folderId,
      folder_name: options.folderName || null,
      trip_id: options.tripId || null,
      trip_name: options.tripName || null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao iniciar sincronização do Google Drive");
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("Falha ao obter status de autenticação");
  return res.json();
}

export async function fetchLoginUrl(joinToken?: string): Promise<string> {
  const qs = new URLSearchParams();
  if (joinToken) qs.set("join_token", joinToken);
  const res = await fetch(`/api/auth/google/login-url?${qs.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao obter URL de login Google");
  }
  const data = await res.json();
  return data.url;
}

export async function logoutUser(): Promise<void> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("Falha ao deslogar");
}

export async function fetchTripShareInfo(tripId: string): Promise<TripShareResponse> {
  const res = await fetch(`/api/trips/${tripId}/share`);
  if (!res.ok) throw new Error("Falha ao carregar informações de compartilhamento");
  return res.json();
}

export async function updateTripShareInfo(
  tripId: string,
  visibility: "private" | "shared"
): Promise<TripShareResponse> {
  const res = await fetch(`/api/trips/${tripId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao atualizar compartilhamento da viagem");
  }
  return res.json();
}

export async function fetchTripMembers(tripId: string): Promise<TripMember[]> {
  const res = await fetch(`/api/trips/${tripId}/members`);
  if (!res.ok) throw new Error("Falha ao buscar membros da viagem");
  return res.json();
}

export async function joinTripByToken(token: string): Promise<Trip> {
  const res = await fetch(`/api/trips/join/${token}`, { method: "POST" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Falha ao entrar na viagem");
  }
  return res.json();
}




