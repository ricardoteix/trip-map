## 1. Infrastructure & Project Scaffolding

- [x] 1.1 Create `.env.example`, `.gitignore`, and unified `docker-compose.yml` configuring PostgreSQL (PostGIS + pgvector), RustFS (S3-compatible object storage), FastAPI backend, and React frontend
- [x] 1.2 Create `backend/` directory structure (`Dockerfile`, `requirements.txt`, `app/config.py`, `app/database.py`, `app/models.py`, `app/schemas.py`)

## 2. Backend Storage, Ingestion & AI Services

- [x] 2.1 Implement S3 storage service (`app/services/storage.py`) using `boto3` to auto-initialize buckets (`originals`, `thumbnails-map`, `thumbnails-web`, `face-crops`) and stream/serve objects
- [x] 2.2 Implement EXIF/GPS extraction (`pillow-heif`, `Pillow`, `ffprobe`), WebP thumbnail generation, and offline reverse geocoding (`app/services/media_processor.py`)
- [x] 2.3 Implement face detection, face crop generation, embedding extraction, and automatic person clustering (`app/services/face_service.py`)
- [x] 2.4 Implement spatio-temporal Trip/Moment automatic grouping service (`app/services/trip_service.py`) and demo sample generator for immediate testing

## 3. Backend REST API Endpoints

- [x] 3.1 Implement media upload, local folder `/import` scanner, media listing with combined filters (bounding box, timeline date range, trip, untagged GPS, boolean `AND`/`OR` people filter), and batch manual geotagging (`app/routers/media.py`)
- [x] 3.2 Implement people management endpoints (list clusters, rename person, merge clusters, assign/remove face tags) (`app/routers/people.py`)
- [x] 3.3 Implement trips & timeline endpoints (list trips, recompute trips, timeline histogram buckets) and FastAPI application entrypoint (`app/routers/trips.py`, `app/main.py`)

## 4. Frontend Application (React + TypeScript + Light Theme)

- [x] 4.1 Scaffold `frontend/` (`Dockerfile`, `nginx.conf`, `package.json`, `vite.config.ts`, `tsconfig.json`, Tailwind CSS light theme setup, API client `src/api/client.ts` and types `src/types.ts`)
- [x] 4.2 Build Interactive Map (`src/components/MapView.tsx`) using MapLibre GL JS + Supercluster with CARTO Positron Light default style, Apple Photos-style thumbnail cluster markers, and chronological route polyline
- [x] 4.3 Build Interactive Timeline Filter (`src/components/TimelineBar.tsx`) with activity histogram, draggable start/end range sliders, quick year pills, and animated route playback
- [x] 4.4 Build People Filter Bar & People Manager (`src/components/PeopleFilterBar.tsx`, `src/components/PeopleModal.tsx`) supporting multi-person selection with `AND` ("Todos juntos") / `OR` ("Qualquer um") toggle, naming, and cluster merging
- [x] 4.5 Build Trips Drawer, Photo Gallery Grid, Lightbox Viewer, Upload/Folder Scanner Modal, and Batch Location Picker (`src/components/TripsPanel.tsx`, `src/components/GalleryDrawer.tsx`, `src/components/UploadModal.tsx`, `src/components/BatchLocationModal.tsx`, `src/App.tsx`)

## 5. Documentation & Verification

- [x] 5.1 Write comprehensive `README.md` in Portuguese documenting architecture, features, Docker Compose setup, local folder mapping for iPhone 16 Plus / Galaxy S25 photos, and usage instructions
- [x] 5.2 Verify backend and frontend build/tests to ensure all components integrate cleanly

## 6. Multi-Resolution Timeline (Day & Month Grouping)

- [x] 6.1 Update backend `/api/timeline` (`app/schemas.py`, `app/routers/trips.py`) to return both `month` and `day` buckets (including city subtitle per day and optional filtering by `trip_id`)
- [x] 6.2 Update `TimelineBar.tsx`, `GalleryDrawer.tsx`, and `App.tsx` to support `[ Dia | Mês ]` toggle, automatic switch to `Dia` when selecting a Trip or when <= 2 months exist, and day-by-day headers in the photo gallery
- [x] 6.3 Rebuild frontend/backend containers and verify daily & monthly timeline endpoints

## 7. Direct Media Deletion (Single & Batch)

- [x] 7.1 Add `DeletedMediaHash` model (`app/models.py`), `delete_object` in `StorageService` (`app/services/storage.py`), and batch/single delete endpoints (`POST /api/media/batch-delete` and `DELETE /api/media/{media_id}`) in `app/routers/media.py`
- [x] 7.2 Add batch delete button in `GalleryDrawer.tsx`, single delete button in `LightboxModal.tsx`, and wire handlers in `App.tsx` and `client.ts`
- [x] 7.3 Rebuild/restart Docker containers and verify deletion flow

## 8. Trip Management & Import-to-Trip Grouping

- [x] 8.1 Add `is_manual` to `Trip` and `is_manual_trip` to `MediaItem` (`app/models.py`, `app/main.py` auto-migration), update `rebuild_trips` (`app/services/trip_service.py`) to preserve manual trips and attach same-day untagged photos
- [x] 8.2 Add Trip CRUD & batch assignment endpoints (`PATCH /api/trips/{trip_id}`, `POST /api/trips/merge`, `POST /api/trips/create-by-range`, `PATCH /api/media/batch-trip`, and `trip_id`/`trip_name` support in `/api/media/upload` and `/api/media/scan-folder`)
- [x] 8.3 Build `TripsModal.tsx` (rename, merge, create by date range, delete trip) and `BatchTripModal.tsx` (assign selected gallery photos to existing or new trip), and update `UploadModal.tsx`, `TripsPanel.tsx`, `GalleryDrawer.tsx`, and `App.tsx`
- [x] 8.4 Restart backend, rebuild frontend container, and verify trip management endpoints

## 9. Dismissing Non-Person / False-Positive Face Clusters

- [x] 9.1 Add `DELETE /api/people/{person_id}` in `backend/app/routers/people.py` to remove a person cluster, its `FaceDetection` rows, and its cropped face avatars in S3 while keeping the photos intact
- [x] 9.2 Add `deletePerson` in `frontend/src/api/client.ts` and a delete/dismiss button (`Trash2`) with confirmation in `frontend/src/components/PeopleModal.tsx` and `frontend/src/App.tsx`
- [x] 9.3 Restart backend and rebuild frontend container

## 10. Outings / Specific Places Subgroups (Passeios & Locais)

- [x] 10.1 Add `Outing` model (`app/models.py`), `outing_id` / `is_manual_outing` on `MediaItem`, auto-migration in `app/main.py`, and automatic micro-stop clustering (~3.5 km radius) in `app/services/trip_service.py`
- [x] 10.2 Add Outing endpoints (`GET /api/outings`, `PATCH /api/outings/{outing_id}`, `POST /api/outings/merge`, `DELETE /api/outings/{outing_id}`, `PATCH /api/media/batch-outing`, and `outing_id` filter in `GET /api/media` and `GET /api/timeline`)
- [x] 10.3 Build `OutingsBar.tsx` and `OutingsModal.tsx` (filter chips for Passeios/Locais, rename, merge, batch assign from Gallery or Map Cluster click), update `MapView.tsx` to display `outing_name` on map pins, and wire into `App.tsx`
- [x] 10.4 Restart backend, trigger initial outing auto-discovery on existing 890 photos, and rebuild frontend container

## 11. Lightbox Sequential Navigation & Curation

- [x] 11.1 Update `LightboxModal.tsx` to support Previous/Next navigation buttons, keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `Escape`), position counter (`X / N`), and background preloading of adjacent images
- [x] 11.2 Update `App.tsx` to pass `displayedGalleryMedia` and navigation handlers into `LightboxModal`, and auto-advance to the next/previous photo when deleting an item from inside the Lightbox
- [x] 11.3 Rebuild `tripmap-frontend` container and verify Lightbox navigation

## 12. Curation Backup Export & Import (Local-to-Server Migration)

- [x] 12.1 Add `MediaCurationCache` model in `backend/app/models.py` to persist imported per-`sha256` curation rules (trip, outing, manual location/city, face detections) for photos not yet scanned
- [x] 12.2 Add `GET /api/backup/export` and `POST /api/backup/import` endpoints in `backend/app/routers/trips.py` (or `backup.py`) and hook `MediaCurationCache` into `_ingest_single_file` in `backend/app/routers/media.py`
- [x] 12.3 Build `BackupModal.tsx` and wire "Backup / Migrar" button in `App.tsx` and `frontend/src/api/client.ts`
- [x] 12.4 Rebuild backend and frontend containers and verify `/api/backup/export` payload on the existing 890 curated Chapada Diamantina photos

## 13. Google Drive Integration (Zero-Disk Originals & Multi-Account Import)

- [x] 13.1 Add `GoogleAccount` model in `backend/app/models.py`, `storage_provider` / `gdrive_file_id` columns in `MediaItem`, and schema migrations in `backend/app/main.py`
- [x] 13.2 Add Google Drive service and OAuth endpoints (`/api/gdrive/auth-url`, `/api/gdrive/callback`, `/api/gdrive/accounts`, `/api/gdrive/folders`, `/api/gdrive/sync-folder`, `/api/gdrive/stream/{media_id}`)
- [x] 13.3 Build `GoogleDriveModal.tsx` in frontend and wire into top navigation bar
- [x] 13.4 Rebuild containers and verify Google Drive OAuth and folder scanning flows

## 14. Multi-User Authentication, Private Trips & Collaboration Invites

- [x] 14.1 Add `User` and `TripMember` models in `backend/app/models.py`, add `owner_id`, `visibility` ("private" | "shared"), and `share_token` to `Trip`, and `uploaded_by_user_id` to `MediaItem`
- [x] 14.2 Implement JWT / Cookie authentication middleware with Google OAuth user creation in `backend/app/routers/auth.py`, associate legacy trips/photos to first admin user
- [x] 14.3 Add trip sharing and membership endpoints (`POST /api/trips/{id}/share`, `POST /api/trips/join/{token}`, `GET /api/trips/{id}/members`, `DELETE /api/trips/{id}/members/{user_id}`) and filter all media/timeline/trips by membership
- [x] 14.4 Build `ShareTripModal.tsx`, user profile header button (Login/Logout) and wire invitation acceptance flow in frontend
- [x] 14.5 Rebuild containers, test private vs shared trip visibility and collaborator upload flow
