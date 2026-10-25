## Context

The user has thousands of travel photos and videos (~3,000 initially) captured on an iPhone 16 Plus and a Samsung Galaxy S25. Both devices produce high-resolution HEIC/JPEG photos and 4K HEVC/MP4/MOV videos rich in EXIF/GPS metadata, though occasional imported or shared images may lack coordinates. The platform must be self-hosted via a single `docker-compose.yml` with separate `backend/` (Python) and `frontend/` (React) directories, using an open-source S3-compatible storage engine (RustFS) and a clean, simple Light Mode interface featuring an interactive map, timeline filter, automated trip grouping, and multi-person boolean filtering (`AND`/`OR`).

## Goals / Non-Goals

**Goals:**
- Provide a unified `docker-compose.yml` running PostgreSQL (with PostGIS/pgvector support), RustFS (S3-compatible object storage), FastAPI backend, and React frontend.
- Support both Web Upload (drag-and-drop) and Local Folder Scanning (`/import` bind mount) with SHA-256 deduplication.
- Extract EXIF metadata (coordinates, timestamps, device model, dimensions) from JPEG, HEIC/HEIF, PNG, WebP, MP4, and MOV files, generating lightweight WebP thumbnails for map markers and gallery grids.
- Deliver a clean, Apple Photos-inspired Light Mode UI (`#F8FAFC` / `#FFFFFF`) with MapLibre GL JS + Supercluster using zero-API-key CARTO Positron Light / OpenFreeMap tiles.
- Enable an interactive Timeline Range Slider + Histogram at the bottom of the map with animated chronological route playback.
- Automatically detect faces, crop face thumbnails, cluster embeddings into people groups, allow naming/merging people, and support strict boolean (`AND` for "all selected people together in the same photo", `OR` for "any selected person") filtering.
- Automatically group media into Trips/Moments using spatio-temporal heuristics and offline reverse geocoding.
- Allow batch manual geotagging (assigning coordinates via map click or place search) for media missing GPS data.

**Non-Goals:**
- Multi-tenant cloud SaaS billing or complex RBAC (designed as a personal/family self-hosted system).
- Heavy RAW photo color grading or non-linear video editing.
- Paid proprietary map API dependencies (Google Maps / Mapbox tokens).

## Decisions

### 1. S3-Compatible Storage: RustFS (with boto3 S3 API)
- **Choice**: Use `rustfs/rustfs` in `docker-compose.yml` configured with standard S3 credentials and accessed via `boto3` in Python. Backend automatically initializes the buckets (`originals`, `thumbnails-map`, `thumbnails-web`, `face-crops`) on startup.
- **Rationale**: RustFS is lightweight, written in Rust, S3-compatible, and includes a built-in web console without licensing friction. Using standard S3 presigned URLs or backend proxy routes makes it seamlessly compatible with Garage or MinIO as well.

### 2. Map Engine & Base Tiles: MapLibre GL JS + Supercluster + CARTO Positron (Light Mode)
- **Choice**: `maplibre-gl` with `supercluster` on the frontend, using CARTO Positron Light (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`) as the default base style, plus an optional toggle for OpenFreeMap Bright and Esri World Imagery (Satellite).
- **Rationale**: Requires zero API keys, renders at 60fps via WebGL when scrubbing the timeline slider, and provides the clean, light, minimal aesthetic requested by the user so photo thumbnails stand out clearly.

### 3. Face Detection & Clustering Pipeline: InsightFace / OpenCV + DBSCAN / Cosine Similarity
- **Choice**: Extract face bounding boxes and embeddings during media ingestion (via InsightFace `buffalo_l`/`buffalo_sc` with graceful fallback to OpenCV/lightweight embeddings if running in constrained environments), save cropped WebP avatars to S3 (`face-crops`), and cluster unassigned faces using cosine distance threshold matching against existing named/unnamed clusters.
- **Rationale**: Runs fast on CPU for ~3,000 photos, groups faces automatically without prior labels, and enables exact SQL intersection queries (`GROUP BY media_id HAVING COUNT(DISTINCT person_id) = :selected_count`) for the "Ricardo AND Saulo AND Michele AND Lorena" filter.

### 4. Spatio-Temporal Trip Grouping & Offline Reverse Geocoding
- **Choice**: Group photos sorted by `taken_at` into a Trip/Moment when consecutive items are within a configurable time gap (e.g., 36 hours) and spatial distance (e.g., 80 km), resolving the centroid coordinates via `reverse_geocoder` (offline GeoNames dataset) to generate titles like *"Lisbon, Portugal — May 2025"*.
- **Rationale**: Works 100% offline during batch ingestion of 3,000+ photos without hitting external rate limits, while interactive place search in the UI uses Nominatim/Photon.

### 5. Synchronous-First + Background Task Queue for Simple Single-Command Deployment
- **Choice**: Use FastAPI `BackgroundTasks` / internal async worker pool backed by PostgreSQL job status tracking so the entire stack runs with fewer moving parts while processing uploads and folder scans asynchronously with real-time progress polling on the frontend.
- **Rationale**: Keeps `docker-compose.yml` fast, reliable, and low-memory while still processing folder scans and face clustering asynchronously in the background.

## Risks / Trade-offs

- **[HEIC & Video Decoding in Docker]** → Install `pillow-heif`, `libheif`, and `ffmpeg` directly in `backend/Dockerfile` so iPhone 16 Plus `.HEIC`/`.MOV` and Galaxy S25 `.HEIC`/`.mp4` files decode reliably out of the box.
- **[Cold Start for Face Detection Models]** → Cache model weights in a persistent Docker volume (`model_cache`) so container restarts do not re-download weights.
- **[Photos Missing EXIF GPS]** → Provide a dedicated "Untagged Location" filter and a Batch Location Assignment modal in the UI where users can select multiple photos and click on the map or search a city name to set coordinates.
