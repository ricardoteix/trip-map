## ADDED Requirements

### Requirement: Dual Media Ingestion
The system SHALL support ingesting photos and videos both via browser drag-and-drop upload and via scanning a mounted local directory (`/import`).

#### Scenario: Upload photos and videos via browser
- **WHEN** the user uploads one or more image/video files (JPEG, HEIC, PNG, WebP, MP4, MOV) through the web interface
- **THEN** the system computes the SHA-256 hash, stores the original file in the S3 `originals` bucket, generates map and web WebP thumbnails, extracts EXIF/GPS/timestamp metadata, and queues face detection and trip grouping

#### Scenario: Scan local import directory
- **WHEN** the user triggers a local directory scan from the web interface
- **THEN** the backend recursively scans the configured `/import` directory, skips files whose SHA-256 hash already exists in the database, and ingests all new supported media files

### Requirement: Metadata Extraction and Thumbnail Generation
The system SHALL extract EXIF metadata (capture date, GPS latitude/longitude, altitude, camera make/model, dimensions) from iPhone 16 Plus and Samsung Galaxy S25 media formats and generate optimized WebP thumbnails.

#### Scenario: Ingest HEIC photo with GPS metadata
- **WHEN** a HEIC or JPEG image containing EXIF GPS and timestamp tags is ingested
- **THEN** the system converts it into a 256x256 square map thumbnail and a 1200px web preview thumbnail in WebP format, stores them in S3, and persists the exact latitude, longitude, and capture timestamp in PostgreSQL

### Requirement: Direct Single and Batch Media Deletion
The system SHALL allow users to permanently delete one or multiple media items directly (without a trash bin), removing associated S3 objects, updating people and trip counts, and recording the deleted SHA-256 hash so local folder scans do not re-import deleted items automatically.

#### Scenario: Delete selected photos in batch or from lightbox
- **WHEN** the user selects one or more photos in the gallery (or opens a photo in the lightbox) and confirms deletion
- **THEN** the system deletes the original file, thumbnails, and face crops from S3, removes the database records, updates person photo counts and trips, and prevents `/import` folder scans from re-importing those SHA-256 hashes

### Requirement: Curation Backup Export and Import (Server Migration)
The system SHALL allow users to export all curation data (Trips, Outings/Passeios, People with face embeddings and base64-encoded avatar crops, Deleted SHA-256 Hashes, and per-photo SHA-256 curation mappings) into a portable JSON backup file and import it on another instance either before or after ingesting media files.

#### Scenario: Export curation backup from local instance
- **WHEN** the user clicks "Exportar Curadoria" in the Backup modal
- **THEN** the backend generates and downloads a portable `tripmap-curation-backup.json` containing all Trips, Outings, People (including `centroid_embedding` and base64 avatar images), `deleted_media_hashes`, and per-`sha256` curation attributes

#### Scenario: Import curation backup on server before or after scanning media
- **WHEN** the user uploads `tripmap-curation-backup.json` in the Backup modal
- **THEN** the system restores Trips, Outings, People (re-uploading avatar crops to S3), and `deleted_media_hashes`, immediately applies curation to any matching `sha256` media items already in the database (and removes any already-imported items present in `deleted_media_hashes`), and caches the per-`sha256` curation rules in `MediaCurationBackup` so subsequent `/import` scans or uploads automatically inherit their Trip, Outing, Location, and People tags
