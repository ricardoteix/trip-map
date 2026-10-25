import base64
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    DeletedMediaHash,
    FaceDetection,
    MediaCurationCache,
    MediaItem,
    Outing,
    Person,
    Trip,
)
from app.routers.media import _delete_media_items, apply_curation_to_media_item
from app.services.storage import storage_service
from app.services.trip_service import refresh_outing_summary, refresh_trip_summary

router = APIRouter(prefix="/api/backup", tags=["backup"])


def _parse_iso_dt(val: str | None) -> datetime:
    if not val:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


@router.get("/export")
def export_curation_backup(db: Session = Depends(get_db)):
    """
    Exports all curation data (Trips, Outings/Passeios, People with face embeddings + base64 avatars,
    Deleted SHA-256 Hashes, and per-photo SHA-256 curation mappings) as a portable JSON file.
    """
    trips = db.query(Trip).order_by(Trip.start_date.asc()).all()
    outings = db.query(Outing).order_by(Outing.start_date.asc()).all()
    people = db.query(Person).order_by(Person.photo_count.desc()).all()
    deleted_hashes = db.query(DeletedMediaHash).all()
    media_items = (
        db.query(MediaItem)
        .options(joinedload(MediaItem.faces))
        .order_by(MediaItem.taken_at.asc())
        .all()
    )

    trips_payload = [
        {
            "id": t.id,
            "title": t.title,
            "subtitle": t.subtitle,
            "city": t.city,
            "country": t.country,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "center_lat": t.center_lat,
            "center_lng": t.center_lng,
            "is_manual": t.is_manual,
        }
        for t in trips
    ]

    outings_payload = [
        {
            "id": o.id,
            "trip_id": o.trip_id,
            "title": o.title,
            "city": o.city,
            "start_date": o.start_date.isoformat() if o.start_date else None,
            "end_date": o.end_date.isoformat() if o.end_date else None,
            "center_lat": o.center_lat,
            "center_lng": o.center_lng,
            "is_manual": o.is_manual,
        }
        for o in outings
    ]

    people_payload = []
    for p in people:
        avatar_b64 = None
        if p.cover_face_key:
            try:
                raw_bytes = storage_service.get_bytes("face-crops", p.cover_face_key)
                if raw_bytes:
                    avatar_b64 = base64.b64encode(raw_bytes).decode("ascii")
            except Exception:
                avatar_b64 = None

        people_payload.append(
            {
                "id": p.id,
                "name": p.name,
                "is_named": p.is_named,
                "cover_face_key": p.cover_face_key,
                "centroid_embedding": p.centroid_embedding,
                "photo_count": p.photo_count,
                "avatar_base64": avatar_b64,
            }
        )

    deleted_payload = [
        {
            "sha256": d.sha256,
            "filename": d.filename,
            "deleted_at": d.deleted_at.isoformat() if d.deleted_at else None,
        }
        for d in deleted_hashes
    ]

    media_payload = []
    for m in media_items:
        faces_data = [
            {
                "person_id": f.person_id,
                "bbox_x": f.bbox_x,
                "bbox_y": f.bbox_y,
                "bbox_w": f.bbox_w,
                "bbox_h": f.bbox_h,
                "confidence": f.confidence,
                "crop_key": f.crop_key,
                "embedding": f.embedding,
            }
            for f in m.faces
        ]
        media_payload.append(
            {
                "sha256": m.sha256,
                "filename": m.filename,
                "trip_id": m.trip_id,
                "is_manual_trip": m.is_manual_trip,
                "outing_id": m.outing_id,
                "is_manual_outing": m.is_manual_outing,
                "latitude": m.latitude,
                "longitude": m.longitude,
                "location_name": m.location_name,
                "city": m.city,
                "country": m.country,
                "is_manual_location": m.is_manual_location,
                "faces": faces_data,
            }
        )

    backup_doc = {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "trips_count": len(trips_payload),
            "outings_count": len(outings_payload),
            "people_count": len(people_payload),
            "deleted_hashes_count": len(deleted_payload),
            "media_curation_count": len(media_payload),
        },
        "trips": trips_payload,
        "outings": outings_payload,
        "people": people_payload,
        "deleted_hashes": deleted_payload,
        "media_curation": media_payload,
    }

    content = json.dumps(backup_doc, ensure_ascii=False, indent=2)
    filename = f"tripmap-curation-backup-{datetime.now().strftime('%Y%m%d-%H%M')}.json"
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_curation_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Imports a portable curation backup JSON file.
    Works both BEFORE scanning /import (caching rules by SHA-256) and AFTER scanning /import
    (immediately updating existing MediaItems and removing deleted SHA-256 items).
    """
    raw = await file.read()
    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Arquivo de backup JSON inválido: {exc}")

    trips_list = data.get("trips") or []
    outings_list = data.get("outings") or []
    people_list = data.get("people") or []
    deleted_list = data.get("deleted_hashes") or []
    media_list = data.get("media_curation") or []

    # 1. Restore DeletedMediaHash and remove any already-imported MediaItem matching those hashes
    deleted_restored = 0
    deleted_media_removed = 0
    for d in deleted_list:
        sha = d.get("sha256")
        if not sha:
            continue
        existing_del = db.query(DeletedMediaHash).filter(DeletedMediaHash.sha256 == sha).first()
        if not existing_del:
            db.add(
                DeletedMediaHash(
                    sha256=sha,
                    filename=d.get("filename"),
                    deleted_at=_parse_iso_dt(d.get("deleted_at")),
                )
            )
            deleted_restored += 1
        existing_media = db.query(MediaItem).filter(MediaItem.sha256 == sha).first()
        if existing_media:
            _delete_media_items(db, [existing_media.id])
            deleted_media_removed += 1
    db.flush()

    # 2. Restore Trips
    trips_restored = 0
    for t_data in trips_list:
        t_id = t_data.get("id")
        if not t_id:
            continue
        trip = db.query(Trip).filter(Trip.id == t_id).first()
        if not trip:
            trip = Trip(
                id=t_id,
                title=t_data.get("title") or "Viagem",
                subtitle=t_data.get("subtitle"),
                city=t_data.get("city"),
                country=t_data.get("country"),
                start_date=_parse_iso_dt(t_data.get("start_date")),
                end_date=_parse_iso_dt(t_data.get("end_date")),
                center_lat=float(t_data.get("center_lat") or 0.0),
                center_lng=float(t_data.get("center_lng") or 0.0),
                is_manual=bool(t_data.get("is_manual", True)),
            )
            db.add(trip)
        else:
            trip.title = t_data.get("title") or trip.title
            trip.subtitle = t_data.get("subtitle")
            trip.city = t_data.get("city")
            trip.country = t_data.get("country")
            trip.is_manual = bool(t_data.get("is_manual", True))
        trips_restored += 1
    db.flush()

    # 3. Restore Outings (Passeios & Locais)
    outings_restored = 0
    for o_data in outings_list:
        o_id = o_data.get("id")
        if not o_id:
            continue
        outing = db.query(Outing).filter(Outing.id == o_id).first()
        if not outing:
            outing = Outing(
                id=o_id,
                trip_id=o_data.get("trip_id"),
                title=o_data.get("title") or "Passeio",
                city=o_data.get("city"),
                start_date=_parse_iso_dt(o_data.get("start_date")),
                end_date=_parse_iso_dt(o_data.get("end_date")),
                center_lat=float(o_data.get("center_lat") or 0.0),
                center_lng=float(o_data.get("center_lng") or 0.0),
                is_manual=True,
            )
            db.add(outing)
        else:
            outing.trip_id = o_data.get("trip_id")
            outing.title = o_data.get("title") or outing.title
            outing.city = o_data.get("city")
            outing.is_manual = True
        outings_restored += 1
    db.flush()

    # 4. Restore People (including centroid_embedding & avatar_base64 -> S3 faces bucket)
    people_restored = 0
    for p_data in people_list:
        p_id = p_data.get("id")
        if not p_id:
            continue
        cover_key = p_data.get("cover_face_key")
        avatar_b64 = p_data.get("avatar_base64")
        if cover_key and avatar_b64:
            try:
                avatar_bytes = base64.b64decode(avatar_b64)
                storage_service.put_bytes("face-crops", cover_key, avatar_bytes, "image/webp")
            except Exception:
                pass

        person = db.query(Person).filter(Person.id == p_id).first()
        if not person:
            person = Person(
                id=p_id,
                name=p_data.get("name") or "Pessoa",
                is_named=bool(p_data.get("is_named", False)),
                cover_face_key=cover_key,
                centroid_embedding=p_data.get("centroid_embedding"),
                photo_count=int(p_data.get("photo_count") or 0),
            )
            db.add(person)
        else:
            person.name = p_data.get("name") or person.name
            person.is_named = bool(p_data.get("is_named", person.is_named))
            if cover_key:
                person.cover_face_key = cover_key
            if p_data.get("centroid_embedding"):
                person.centroid_embedding = p_data.get("centroid_embedding")
        people_restored += 1
    db.flush()

    # 5. Upsert MediaCurationCache & apply immediately to any already-scanned MediaItem
    media_updated_now = 0
    media_cached = 0
    for m_data in media_list:
        sha = m_data.get("sha256")
        if not sha:
            continue
        cache_row = db.query(MediaCurationCache).filter(MediaCurationCache.sha256 == sha).first()
        if not cache_row:
            cache_row = MediaCurationCache(sha256=sha)
            db.add(cache_row)

        cache_row.trip_id = m_data.get("trip_id")
        cache_row.is_manual_trip = bool(m_data.get("trip_id"))
        cache_row.outing_id = m_data.get("outing_id")
        cache_row.is_manual_outing = bool(m_data.get("outing_id"))
        cache_row.latitude = m_data.get("latitude")
        cache_row.longitude = m_data.get("longitude")
        cache_row.location_name = m_data.get("location_name")
        cache_row.city = m_data.get("city")
        cache_row.country = m_data.get("country")
        cache_row.is_manual_location = bool(m_data.get("is_manual_location", False))
        cache_row.faces_json = m_data.get("faces")
        cache_row.updated_at = datetime.now(timezone.utc)
        media_cached += 1

        existing_media = db.query(MediaItem).filter(MediaItem.sha256 == sha).first()
        if existing_media:
            apply_curation_to_media_item(db, existing_media, cache_row, pil_img=None)
            media_updated_now += 1

    db.flush()

    # 6. Refresh counts for trips, outings, and people (and remove orphan unreferenced people)
    backup_person_ids = {p_data.get("id") for p_data in people_list if p_data.get("id")}
    for t in db.query(Trip).all():
        refresh_trip_summary(db, t)
    for o in db.query(Outing).all():
        refresh_outing_summary(db, o)
    for p in list(db.query(Person).all()):
        cnt = (
            db.query(FaceDetection.media_id)
            .filter(FaceDetection.person_id == p.id)
            .distinct()
            .count()
        )
        if cnt == 0 and p.id not in backup_person_ids:
            db.delete(p)
        elif cnt > 0:
            p.photo_count = cnt

    db.commit()

    return {
        "status": "ok",
        "trips_restored": trips_restored,
        "outings_restored": outings_restored,
        "people_restored": people_restored,
        "deleted_hashes_restored": deleted_restored,
        "deleted_media_removed": deleted_media_removed,
        "media_updated_now": media_updated_now,
        "media_cached_for_scan": media_cached,
    }
