## Why

Organizing thousands of travel photos and videos taken across modern devices (iPhone 16 Plus and Samsung Galaxy S25) requires a unified, self-hosted web platform that puts spatial exploration first. Users need an Apple Photos-inspired interactive map with a light, clean aesthetic, an interactive timeline slider, automated trip/moment grouping, and face recognition with multi-person intersection filtering (e.g., showing only photos where specific friends appear together).

## What Changes

- **Full-Stack Self-Hosted Architecture**: Create separate `backend/` (Python FastAPI) and `frontend/` (React + TypeScript + Vite + Tailwind CSS) applications orchestrated via a single `docker-compose.yml` alongside PostgreSQL (PostGIS + pgvector) and an S3-compatible object storage service (RustFS).
- **Dual Media Ingestion & S3 Storage**: Support both browser drag-and-drop uploads and local directory scanning (`/import`), deduplicating via SHA-256 hashes, extracting EXIF/GPS/timestamp metadata (including HEIC/HEIF and video support), generating fast WebP thumbnails, and storing assets in S3 buckets.
- **Interactive Light-Theme Map & Timeline**: Build a MapLibre GL JS + Supercluster map view defaulting to a clean Light Mode (CARTO Positron / OpenFreeMap) with photo-thumbnail cluster pins, manual batch geotagging for photos missing coordinates, and an interactive timeline histogram/range slider with route playback.
- **Face Detection, Clustering & Boolean Filtering**: Automatically detect faces, crop avatars, and group unknown faces into clusters so users can tag names and filter the map and gallery using `AND` (all selected people together in the same photo) or `OR` (any selected person) logic.
- **Automated Trip / Moment Grouping**: Automatically group chronologically and spatially proximate photos into Trips/Moments with reverse-geocoded city/country titles and chronological map routes.
- **Comprehensive Documentation**: Provide a complete `README.md` covering architecture, setup, Docker Compose usage, local folder ingestion, and development workflows.

## Capabilities

### New Capabilities
- `media-ingestion-and-storage`: Dual ingestion (web upload and local folder scanner), SHA-256 deduplication, EXIF/GPS extraction (JPEG, HEIC, MP4, MOV), thumbnail generation, and S3-compatible object storage integration (RustFS).
- `interactive-map-and-timeline`: Light-themed interactive map with photo thumbnail clustering, bounding-box filtering, batch manual location assignment, and an interactive timeline range slider with histogram and route visualization.
- `people-recognition-and-filtering`: Face detection, embedding extraction, automatic face clustering, person naming/merging, and boolean (`AND` / `OR`) multi-person filtering across map and gallery views.
- `trip-moments-grouping`: Spatio-temporal clustering of media into Trips/Moments with offline reverse geocoding (city/country) and route visualization.

### Modified Capabilities
<!-- None - greenfield project -->

## Impact

- **Repository Structure**: Introduces `docker-compose.yml`, `.env.example`, `README.md`, `backend/`, and `frontend/`.
- **Infrastructure Services**: PostgreSQL (with `postgis` and `vector` extensions) and RustFS (S3-compatible object storage).
- **External Map/Geocoding Providers**: Uses zero-API-key open vector/raster tiles (CARTO Positron Light / OpenFreeMap) for map rendering, offline coordinates-to-city resolution, and Nominatim/Photon for interactive place search.
