import mimetypes
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import (
    DeletedMediaHash,
    FaceDetection,
    MediaCurationCache,
    MediaItem,
    Outing,
    Person,
    ScanJob,
    Trip,
    TripMember,
    User,
)
from app.routers.auth import get_accessible_trip_ids, get_current_user_optional
from app.schemas import (
    AddPersonTagRequest,
    BatchAssignOutingRequest,
    BatchAssignTripRequest,
    BatchDeleteRequest,
    BatchGeotagRequest,
    FaceBrief,
    MediaResponse,
    PersonBrief,
    ScanStatusResponse,
)
from app.services.face_service import face_service
from app.services.media_processor import (
    IMAGE_EXTENSIONS,
    SUPPORTED_EXTENSIONS,
    VIDEO_EXTENSIONS,
    compute_sha256,
    extract_image_metadata,
    extract_video_metadata,
    generate_image_thumbnails,
    generate_video_thumbnails,
    resolve_city_country,
)
from app.services.storage import storage_service
from app.services.trip_service import rebuild_trips, refresh_outing_summary, refresh_trip_summary

router = APIRouter(prefix="/api", tags=["media"])


def serialize_media(item: MediaItem) -> MediaResponse:
    people_map: dict[str, PersonBrief] = {}
    faces_list: list[FaceBrief] = []

    for f in item.faces:
        if f.person:
            avatar_url = (
                f"/api/storage/face-crops/{f.person.cover_face_key}"
                if f.person.cover_face_key
                else f"/api/storage/face-crops/{f.crop_key}"
            )
            people_map[f.person.id] = PersonBrief(
                id=f.person.id,
                name=f.person.name,
                is_named=f.person.is_named,
                avatar_url=avatar_url,
            )
            faces_list.append(
                FaceBrief(
                    id=f.id,
                    person_id=f.person.id,
                    person_name=f.person.name,
                    is_named=f.person.is_named,
                    bbox_x=f.bbox_x,
                    bbox_y=f.bbox_y,
                    bbox_w=f.bbox_w,
                    bbox_h=f.bbox_h,
                    crop_url=f"/api/storage/face-crops/{f.crop_key}",
                )
            )

    return MediaResponse(
        id=item.id,
        filename=item.filename,
        media_type=item.media_type,
        mime_type=item.mime_type,
        file_size=item.file_size,
        width=item.width,
        height=item.height,
        duration_sec=item.duration_sec,
        camera_make=item.camera_make,
        camera_model=item.camera_model,
        taken_at=item.taken_at,
        latitude=item.latitude,
        longitude=item.longitude,
        altitude=item.altitude,
        location_name=item.location_name,
        city=item.city,
        country=item.country,
        is_manual_location=item.is_manual_location,
        trip_id=item.trip_id,
        outing_id=item.outing_id,
        outing_title=item.outing.title if item.outing else None,
        storage_provider=getattr(item, "storage_provider", "s3") or "s3",
        gdrive_file_id=getattr(item, "gdrive_file_id", None),
        thumb_map_url=f"/api/storage/thumbnails-map/{item.thumb_map_key}",
        thumb_web_url=f"/api/storage/thumbnails-web/{item.thumb_web_key}",
        original_url=(
            f"/api/gdrive/stream/{item.id}"
            if getattr(item, "storage_provider", "s3") == "gdrive"
            else f"/api/storage/originals/{item.original_key}"
        ),
        people=list(people_map.values()),
        faces=faces_list,
    )


def ingest_single_file(
    db: Session,
    filename: str,
    raw_bytes: bytes,
    fallback_dt: Optional[datetime] = None,
    respect_deleted_list: bool = False,
    uploaded_by_user_id: Optional[str] = None,
) -> tuple[Optional[MediaItem], bool]:
    """
    Ingests a single media file into S3 and PostgreSQL.
    Returns (MediaItem, is_new).
    """
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return None, False

    sha = compute_sha256(raw_bytes)
    if respect_deleted_list:
        was_deleted = db.query(DeletedMediaHash).filter(DeletedMediaHash.sha256 == sha).first()
        if was_deleted:
            return None, False
    else:
        # Explicit browser upload un-ignores a previously deleted photo
        db.query(DeletedMediaHash).filter(DeletedMediaHash.sha256 == sha).delete()

    existing = db.query(MediaItem).filter(MediaItem.sha256 == sha).first()
    if existing:
        return existing, False

    media_id = str(uuid4())
    mime_type = mimetypes.guess_type(filename)[0] or (
        "video/mp4" if ext in VIDEO_EXTENSIONS else "image/jpeg"
    )
    is_video = ext in VIDEO_EXTENSIONS
    media_type = "video" if is_video else "image"

    orig_key = f"{media_id}_{Path(filename).name}"
    map_key = f"{media_id}_map.webp"
    web_key = f"{media_id}_web.webp"

    pil_img = None
    if is_video:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(raw_bytes)
            tmp_path = Path(tmp.name)
        try:
            meta = extract_video_metadata(tmp_path, fallback_dt=fallback_dt)
            map_bytes, web_bytes = generate_video_thumbnails(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        meta = extract_image_metadata(raw_bytes, fallback_dt=fallback_dt)
        map_bytes, web_bytes, pil_img = generate_image_thumbnails(raw_bytes)

    storage_service.put_bytes("originals", orig_key, raw_bytes, mime_type)
    storage_service.put_bytes("thumbnails-map", map_key, map_bytes, "image/webp")
    storage_service.put_bytes("thumbnails-web", web_key, web_bytes, "image/webp")

    city, country, loc_name = resolve_city_country(meta.get("latitude"), meta.get("longitude"))

    media = MediaItem(
        id=media_id,
        sha256=sha,
        filename=Path(filename).name,
        media_type=media_type,
        mime_type=mime_type,
        file_size=len(raw_bytes),
        width=meta.get("width"),
        height=meta.get("height"),
        duration_sec=meta.get("duration_sec"),
        camera_make=meta.get("camera_make"),
        camera_model=meta.get("camera_model"),
        taken_at=meta.get("taken_at") or datetime.now(timezone.utc),
        latitude=meta.get("latitude"),
        longitude=meta.get("longitude"),
        altitude=meta.get("altitude"),
        location_name=loc_name,
        city=city,
        country=country,
        original_key=orig_key,
        thumb_map_key=map_key,
        thumb_web_key=web_key,
        uploaded_by_user_id=uploaded_by_user_id,
    )
    db.add(media)
    db.flush()

    cached = db.query(MediaCurationCache).filter(MediaCurationCache.sha256 == sha).first()
    if cached is not None:
        apply_curation_to_media_item(db, media, cached, pil_img=pil_img)
    elif pil_img is not None:
        face_service.detect_and_cluster_faces(db, media, pil_img)

    return media, True


def apply_curation_to_media_item(
    db: Session,
    media: MediaItem,
    cached: MediaCurationCache,
    pil_img=None,
) -> None:
    if cached.trip_id and db.query(Trip.id).filter(Trip.id == cached.trip_id).first():
        media.trip_id = cached.trip_id
        media.is_manual_trip = cached.is_manual_trip

    if cached.outing_id and db.query(Outing.id).filter(Outing.id == cached.outing_id).first():
        media.outing_id = cached.outing_id
        media.is_manual_outing = cached.is_manual_outing

    if cached.is_manual_location or cached.city or cached.location_name:
        if cached.latitude is not None and cached.longitude is not None:
            media.latitude = cached.latitude
            media.longitude = cached.longitude
        if cached.location_name:
            media.location_name = cached.location_name
        if cached.city:
            media.city = cached.city
        if cached.country:
            media.country = cached.country
        media.is_manual_location = cached.is_manual_location

    if cached.faces_json is not None:
        # Replace existing face detections with the curated ones
        db.query(FaceDetection).filter(FaceDetection.media_id == media.id).delete()
        for f_data in cached.faces_json:
            person_id = f_data.get("person_id")
            if not person_id:
                continue
            person = db.query(Person).filter(Person.id == person_id).first()
            if not person:
                continue
            crop_key = f_data.get("crop_key") or person.cover_face_key or f"{media.id}_face.webp"
            if pil_img is not None and f_data.get("bbox_w", 0) > 0 and f_data.get("bbox_h", 0) > 0:
                try:
                    import io
                    w, h = pil_img.size
                    x1 = max(0, int(float(f_data["bbox_x"]) * w))
                    y1 = max(0, int(float(f_data["bbox_y"]) * h))
                    x2 = min(w, int((float(f_data["bbox_x"]) + float(f_data["bbox_w"])) * w))
                    y2 = min(h, int((float(f_data["bbox_y"]) + float(f_data["bbox_h"])) * h))
                    if x2 > x1 and y2 > y1:
                        crop_img = pil_img.crop((x1, y1, x2, y2)).resize((160, 160))
                        buf = io.BytesIO()
                        crop_img.save(buf, format="WEBP", quality=85)
                        storage_service.put_bytes("face-crops", crop_key, buf.getvalue(), "image/webp")
                except Exception:
                    pass
            face_row = FaceDetection(
                id=str(uuid4()),
                media_id=media.id,
                person_id=person.id,
                bbox_x=float(f_data.get("bbox_x", 0.0)),
                bbox_y=float(f_data.get("bbox_y", 0.0)),
                bbox_w=float(f_data.get("bbox_w", 0.0)),
                bbox_h=float(f_data.get("bbox_h", 0.0)),
                confidence=float(f_data.get("confidence", 1.0)),
                crop_key=crop_key,
                embedding=f_data.get("embedding") or person.centroid_embedding or [0.0] * 128,
            )
            db.add(face_row)
    db.flush()


@router.get("/media", response_model=list[MediaResponse])
def list_media(
    person_ids: Optional[str] = Query(None, description="Comma-separated person IDs"),
    people_mode: str = Query("AND", description="AND (all together) or OR (any)"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    trip_id: Optional[str] = Query(None),
    outing_id: Optional[str] = Query(None),
    untagged_only: bool = Query(False),
    geotagged_only: bool = Query(False),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lng: Optional[float] = Query(None),
    max_lng: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = db.query(MediaItem).options(
        joinedload(MediaItem.faces).joinedload(FaceDetection.person),
        joinedload(MediaItem.outing),
    )

    accessible_ids = get_accessible_trip_ids(db, current_user)
    if accessible_ids is not None:
        if current_user:
            if accessible_ids:
                query = query.filter(
                    (MediaItem.trip_id.in_(accessible_ids))
                    | (MediaItem.uploaded_by_user_id == current_user.id)
                )
            else:
                query = query.filter(MediaItem.uploaded_by_user_id == current_user.id)
        else:
            if accessible_ids:
                query = query.filter(MediaItem.trip_id.in_(accessible_ids))
            else:
                return []

    if untagged_only:
        query = query.filter((MediaItem.latitude.is_(None)) | (MediaItem.longitude.is_(None)))
    elif geotagged_only:
        query = query.filter(MediaItem.latitude.isnot(None), MediaItem.longitude.isnot(None))

    if start_date:
        query = query.filter(MediaItem.taken_at >= start_date)
    if end_date:
        query = query.filter(MediaItem.taken_at <= end_date)
    if trip_id:
        query = query.filter(MediaItem.trip_id == trip_id)
    if outing_id:
        query = query.filter(MediaItem.outing_id == outing_id)

    if min_lat is not None and max_lat is not None:
        query = query.filter(MediaItem.latitude >= min_lat, MediaItem.latitude <= max_lat)
    if min_lng is not None and max_lng is not None:
        query = query.filter(MediaItem.longitude >= min_lng, MediaItem.longitude <= max_lng)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (MediaItem.filename.ilike(term))
            | (MediaItem.city.ilike(term))
            | (MediaItem.country.ilike(term))
            | (MediaItem.location_name.ilike(term))
            | (MediaItem.camera_model.ilike(term))
        )

    if person_ids:
        selected_ids = [pid.strip() for pid in person_ids.split(",") if pid.strip()]
        if selected_ids:
            if people_mode.upper() == "AND":
                # Strict intersection: media must contain ALL selected people simultaneously
                matching_media_subq = (
                    db.query(FaceDetection.media_id)
                    .filter(FaceDetection.person_id.in_(selected_ids))
                    .group_by(FaceDetection.media_id)
                    .having(func.count(func.distinct(FaceDetection.person_id)) == len(selected_ids))
                    .subquery()
                )
                query = query.filter(MediaItem.id.in_(matching_media_subq))
            else:
                # Union (OR): media contains AT LEAST ONE of the selected people
                matching_media_subq = (
                    db.query(FaceDetection.media_id)
                    .filter(FaceDetection.person_id.in_(selected_ids))
                    .distinct()
                    .subquery()
                )
                query = query.filter(MediaItem.id.in_(matching_media_subq))

    items = query.order_by(MediaItem.taken_at.asc()).all()
    return [serialize_media(item) for item in items]


def _resolve_or_create_manual_trip(
    db: Session,
    trip_id: Optional[str] = None,
    trip_name: Optional[str] = None,
    current_user: Optional[User] = None,
) -> Optional[Trip]:
    if trip_id:
        t = db.query(Trip).filter(Trip.id == trip_id).first()
        if t:
            t.is_manual = True
            return t
    if trip_name and trip_name.strip():
        clean = trip_name.strip()
        t = db.query(Trip).filter(Trip.title.ilike(clean)).first()
        if not t:
            now = datetime.now(timezone.utc)
            t = Trip(
                id=str(uuid4()),
                title=clean,
                subtitle="Viagem",
                start_date=now,
                end_date=now,
                center_lat=-15.7939,
                center_lng=-47.8828,
                media_count=0,
                is_manual=True,
                owner_id=current_user.id if current_user else None,
            )
            db.add(t)
            db.flush()
            if current_user:
                db.add(TripMember(trip_id=t.id, user_id=current_user.id, role="owner"))
        else:
            t.is_manual = True
        return t
    return None


@router.post("/media/upload", response_model=list[MediaResponse])
async def upload_media(
    files: list[UploadFile] = File(...),
    trip_id: Optional[str] = Form(None),
    trip_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    ingested_items: list[MediaItem] = []
    any_new = False
    target_trip = _resolve_or_create_manual_trip(
        db, trip_id=trip_id, trip_name=trip_name, current_user=current_user
    )

    for upload in files:
        raw_bytes = await upload.read()
        if not raw_bytes:
            continue
        item, is_new = ingest_single_file(
            db,
            upload.filename or "upload.jpg",
            raw_bytes,
            uploaded_by_user_id=current_user.id if current_user else None,
        )
        if item is not None:
            if target_trip is not None:
                item.trip_id = target_trip.id
                item.is_manual_trip = True
            ingested_items.append(item)
            if is_new or target_trip is not None:
                any_new = True

    db.commit()
    if any_new:
        rebuild_trips(db)

    refreshed = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces).joinedload(FaceDetection.person))
        .filter(MediaItem.id.in_([m.id for m in ingested_items]))
        .all()
    )
    return [serialize_media(m) for m in refreshed]


def _run_folder_scan_job(
    job_id: str,
    folder_path: str,
    trip_id: Optional[str] = None,
    trip_name: Optional[str] = None,
    group_by_subfolder: bool = False,
) -> None:
    db = SessionLocal()
    try:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if not job:
            return

        root = Path(folder_path)
        if not root.exists():
            job.status = "completed"
            job.message = f"Pasta {folder_path} vazia ou não encontrada."
            db.commit()
            return

        candidate_files = [
            p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        job.total_files = len(candidate_files)
        db.commit()

        explicit_trip = _resolve_or_create_manual_trip(db, trip_id=trip_id, trip_name=trip_name)
        db.commit()

        for file_path in candidate_files:
            try:
                raw_bytes = file_path.read_bytes()
                mtime_dt = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
                media_item, is_new = ingest_single_file(
                    db,
                    file_path.name,
                    raw_bytes,
                    fallback_dt=mtime_dt,
                    respect_deleted_list=True,
                )
                if media_item is not None:
                    if explicit_trip is not None:
                        media_item.trip_id = explicit_trip.id
                        media_item.is_manual_trip = True
                    elif group_by_subfolder and file_path.parent != root:
                        sub_name = file_path.parent.name
                        sub_trip = _resolve_or_create_manual_trip(db, trip_name=sub_name)
                        if sub_trip:
                            media_item.trip_id = sub_trip.id
                            media_item.is_manual_trip = True

                job.processed_files += 1
                if is_new:
                    job.imported_files += 1
                else:
                    job.skipped_files += 1
                db.commit()
            except Exception as exc:
                db.rollback()
                job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                if job:
                    job.processed_files += 1
                    job.skipped_files += 1
                    db.commit()

        rebuild_trips(db)
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job:
            job.status = "completed"
            job.message = (
                f"Importação concluída: {job.imported_files} novas mídias adicionadas "
                f"({job.skipped_files} já existentes/ignoradas)."
            )
            db.commit()
    except Exception as exc:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.message = f"Erro durante o escaneamento: {exc}"
            db.commit()
    finally:
        db.close()


@router.post("/media/scan-folder", response_model=ScanStatusResponse)
def start_folder_scan(
    background_tasks: BackgroundTasks,
    trip_id: Optional[str] = Query(None),
    trip_name: Optional[str] = Query(None),
    group_by_subfolder: bool = Query(False),
    db: Session = Depends(get_db),
):
    job = ScanJob(
        id=str(uuid4()),
        status="running",
        total_files=0,
        processed_files=0,
        imported_files=0,
        skipped_files=0,
        message=f"Escaneando diretório {settings.import_dir}...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        _run_folder_scan_job,
        job.id,
        settings.import_dir,
        trip_id,
        trip_name,
        group_by_subfolder,
    )
    return ScanStatusResponse(
        id=job.id,
        status=job.status,
        total_files=job.total_files,
        processed_files=job.processed_files,
        imported_files=job.imported_files,
        skipped_files=job.skipped_files,
        message=job.message,
    )


@router.get("/media/scan-status/{job_id}", response_model=ScanStatusResponse)
def get_scan_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return ScanStatusResponse(
        id=job.id,
        status=job.status,
        total_files=job.total_files,
        processed_files=job.processed_files,
        imported_files=job.imported_files,
        skipped_files=job.skipped_files,
        message=job.message,
    )


@router.patch("/media/batch-location", response_model=list[MediaResponse])
def batch_assign_location(
    payload: BatchGeotagRequest,
    db: Session = Depends(get_db),
):
    if not payload.media_ids:
        return []

    city, country, resolved_loc = resolve_city_country(payload.latitude, payload.longitude)
    loc_label = payload.location_name or resolved_loc

    items = db.query(MediaItem).filter(MediaItem.id.in_(payload.media_ids)).all()
    for item in items:
        item.latitude = round(payload.latitude, 6)
        item.longitude = round(payload.longitude, 6)
        item.city = city
        item.country = country
        item.location_name = loc_label
        item.is_manual_location = True

    db.commit()
    rebuild_trips(db)

    updated = (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.faces).joinedload(FaceDetection.person),
            joinedload(MediaItem.outing),
        )
        .filter(MediaItem.id.in_(payload.media_ids))
        .all()
    )
    return [serialize_media(m) for m in updated]


@router.patch("/media/batch-outing", response_model=list[MediaResponse])
def batch_assign_outing(
    payload: BatchAssignOutingRequest,
    db: Session = Depends(get_db),
):
    if not payload.media_ids:
        return []

    target_outing: Optional[Outing] = None
    if payload.outing_id:
        target_outing = db.query(Outing).filter(Outing.id == payload.outing_id).first()
        if target_outing:
            target_outing.is_manual = True
            if payload.city and payload.city.strip():
                target_outing.city = payload.city.strip()
    elif payload.new_outing_title and payload.new_outing_title.strip():
        clean_title = payload.new_outing_title.strip()
        clean_city = payload.city.strip() if payload.city and payload.city.strip() else None
        target_outing = db.query(Outing).filter(Outing.title.ilike(clean_title)).first()
        if not target_outing:
            now = datetime.now(timezone.utc)
            target_outing = Outing(
                id=str(uuid4()),
                trip_id=payload.trip_id,
                title=clean_title,
                city=clean_city,
                start_date=now,
                end_date=now,
                center_lat=-12.8929,
                center_lng=-41.2707,
                media_count=0,
                is_manual=True,
            )
            db.add(target_outing)
            db.flush()
        else:
            target_outing.is_manual = True
            if clean_city:
                target_outing.city = clean_city

    items = db.query(MediaItem).filter(MediaItem.id.in_(payload.media_ids)).all()
    affected_outing_ids: set[str] = set()
    for item in items:
        if item.outing_id:
            affected_outing_ids.add(item.outing_id)
        if target_outing is not None:
            item.outing_id = target_outing.id
            item.outing = target_outing
            item.is_manual_outing = True
            if target_outing.city:
                item.city = target_outing.city
                item.location_name = f"{target_outing.title} • {target_outing.city}"
            else:
                item.location_name = target_outing.title
            affected_outing_ids.add(target_outing.id)
        else:
            item.outing_id = None
            item.outing = None
            item.is_manual_outing = False

    db.flush()
    for oid in affected_outing_ids:
        o_obj = db.query(Outing).filter(Outing.id == oid).first()
        if o_obj:
            refresh_outing_summary(db, o_obj)

    db.commit()

    updated = (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.faces).joinedload(FaceDetection.person),
            joinedload(MediaItem.outing),
        )
        .filter(MediaItem.id.in_(payload.media_ids))
        .all()
    )
    return [serialize_media(m) for m in updated]


@router.patch("/media/batch-trip", response_model=list[MediaResponse])
def batch_assign_trip(
    payload: BatchAssignTripRequest,
    db: Session = Depends(get_db),
):
    if not payload.media_ids:
        return []

    target_trip = _resolve_or_create_manual_trip(
        db,
        trip_id=payload.trip_id,
        trip_name=payload.new_trip_title,
    )

    items = db.query(MediaItem).filter(MediaItem.id.in_(payload.media_ids)).all()
    affected_trip_ids: set[str] = set()
    for item in items:
        if item.trip_id:
            affected_trip_ids.add(item.trip_id)
        if target_trip is not None:
            item.trip_id = target_trip.id
            item.is_manual_trip = True
            affected_trip_ids.add(target_trip.id)
        else:
            item.trip_id = None
            item.is_manual_trip = False

    db.flush()
    for tid in affected_trip_ids:
        t_obj = db.query(Trip).filter(Trip.id == tid).first()
        if t_obj:
            refresh_trip_summary(db, t_obj)

    db.commit()

    updated = (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.faces).joinedload(FaceDetection.person),
            joinedload(MediaItem.outing),
        )
        .filter(MediaItem.id.in_(payload.media_ids))
        .all()
    )
    return [serialize_media(m) for m in updated]




def _delete_media_items(db: Session, media_ids: list[str]) -> int:
    if not media_ids:
        return 0

    items = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces))
        .filter(MediaItem.id.in_(media_ids))
        .all()
    )
    if not items:
        return 0

    for item in items:
        # Record hash so folder scanner doesn't re-import deleted photos
        if not db.query(DeletedMediaHash).filter(DeletedMediaHash.sha256 == item.sha256).first():
            db.add(DeletedMediaHash(sha256=item.sha256, filename=item.filename))

        # Remove S3 objects
        storage_service.delete_object("originals", item.original_key)
        storage_service.delete_object("thumbnails-map", item.thumb_map_key)
        storage_service.delete_object("thumbnails-web", item.thumb_web_key)
        for face in item.faces:
            if face.crop_key and not face.crop_key.startswith("avatar_"):
                storage_service.delete_object("face-crops", face.crop_key)

        db.delete(item)

    db.flush()

    # Update people photo counts and remove empty unnamed clusters
    people = db.query(Person).all()
    for p in people:
        remaining_faces = (
            db.query(FaceDetection)
            .filter(FaceDetection.person_id == p.id)
            .all()
        )
        distinct_media_ids = {f.media_id for f in remaining_faces}
        p.photo_count = len(distinct_media_ids)
        if p.photo_count == 0 and not p.is_named:
            db.delete(p)
        elif remaining_faces and (
            not p.cover_face_key
            or p.cover_face_key not in {f.crop_key for f in remaining_faces}
        ):
            p.cover_face_key = remaining_faces[0].crop_key

    db.commit()
    rebuild_trips(db)
    return len(items)


@router.post("/media/batch-delete")
def batch_delete_media(
    payload: BatchDeleteRequest,
    db: Session = Depends(get_db),
):
    deleted_count = _delete_media_items(db, payload.media_ids)
    return {"status": "deleted", "deleted_count": deleted_count}


@router.delete("/media/{media_id}")
def delete_single_media(
    media_id: str,
    db: Session = Depends(get_db),
):
    deleted_count = _delete_media_items(db, [media_id])
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")
    return {"status": "deleted", "deleted_count": deleted_count}


@router.post("/media/{media_id}/people", response_model=MediaResponse)
def add_person_tag_to_media(
    media_id: str,
    payload: AddPersonTagRequest,
    db: Session = Depends(get_db),
):
    media = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces).joinedload(FaceDetection.person))
        .filter(MediaItem.id == media_id)
        .first()
    )
    if not media:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")

    clean_name = payload.person_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nome inválido")

    person = db.query(Person).filter(Person.name.ilike(clean_name)).first()
    crop_key = f"avatar_{clean_name.lower().replace(' ', '_')}.webp"
    if not person:
        avatar_bytes = face_service._generate_avatar_webp(clean_name, abs(hash(clean_name)) % 6)
        storage_service.put_bytes("face-crops", crop_key, avatar_bytes, "image/webp")
        person = Person(
            name=clean_name,
            is_named=True,
            cover_face_key=crop_key,
            centroid_embedding=[0.0] * 128,
            photo_count=1,
        )
        db.add(person)
        db.flush()

    existing_face = (
        db.query(FaceDetection)
        .filter(FaceDetection.media_id == media.id, FaceDetection.person_id == person.id)
        .first()
    )
    if not existing_face:
        face = FaceDetection(
            media_id=media.id,
            person_id=person.id,
            bbox_x=0.5,
            bbox_y=0.5,
            bbox_w=0.15,
            bbox_h=0.15,
            confidence=1.0,
            crop_key=person.cover_face_key or crop_key,
            embedding=person.centroid_embedding or [0.0] * 128,
        )
        db.add(face)
        person.photo_count = (person.photo_count or 0) + 1
        db.commit()

    refreshed = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces).joinedload(FaceDetection.person))
        .filter(MediaItem.id == media_id)
        .first()
    )
    return serialize_media(refreshed)


@router.delete("/media/{media_id}/people/{person_id}", response_model=MediaResponse)
def remove_person_tag_from_media(
    media_id: str,
    person_id: str,
    db: Session = Depends(get_db),
):
    db.query(FaceDetection).filter(
        FaceDetection.media_id == media_id, FaceDetection.person_id == person_id
    ).delete()
    person = db.query(Person).filter(Person.id == person_id).first()
    if person:
        person.photo_count = (
            db.query(FaceDetection.media_id)
            .filter(FaceDetection.person_id == person.id)
            .distinct()
            .count()
        )
    db.commit()

    refreshed = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces).joinedload(FaceDetection.person))
        .filter(MediaItem.id == media_id)
        .first()
    )
    if not refreshed:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")
    return serialize_media(refreshed)


@router.get("/storage/{bucket}/{key:path}")
def serve_storage_object(bucket: str, key: str):
    data = storage_service.get_bytes(bucket, key)
    if data is None:
        raise HTTPException(status_code=404, detail="Objeto não encontrado no S3")
    content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
