import calendar
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FaceDetection, MediaItem, Outing, Person, ScanJob, Trip, TripMember, User
from app.routers.auth import get_accessible_trip_ids, get_current_user, get_current_user_optional
from app.schemas import (
    OutingMergeRequest,
    OutingResponse,
    OutingUpdateRequest,
    TimelineBucket,
    TimelineStatsResponse,
    TripCreateByRangeRequest,
    TripMemberResponse,
    TripMergeRequest,
    TripResponse,
    TripShareRequest,
    TripShareResponse,
    TripUpdateRequest,
)
from app.services.trip_service import (
    MONTHS_PT,
    rebuild_outings,
    rebuild_trips,
    refresh_outing_summary,
    refresh_trip_summary,
    seed_demo_data,
)

router = APIRouter(prefix="/api", tags=["trips-and-timeline"])


def serialize_trip(db: Session, trip: Trip, current_user: Optional[User] = None) -> TripResponse:
    cover_url = None
    if trip.cover_media_id:
        cover_media = db.query(MediaItem).filter(MediaItem.id == trip.cover_media_id).first()
        if cover_media:
            cover_url = f"/api/storage/thumbnails-web/{cover_media.thumb_web_key}"

    user_role: Optional[str] = None
    if current_user:
        if current_user.is_admin or (trip.owner_id and trip.owner_id == current_user.id):
            user_role = "owner"
        else:
            membership = (
                db.query(TripMember)
                .filter(TripMember.trip_id == trip.id, TripMember.user_id == current_user.id)
                .first()
            )
            if membership:
                user_role = membership.role
            elif trip.visibility in ["shared", "public"]:
                user_role = "viewer"
    elif trip.visibility in ["shared", "public"]:
        user_role = "viewer"

    return TripResponse(
        id=trip.id,
        title=trip.title,
        subtitle=trip.subtitle,
        city=trip.city,
        country=trip.country,
        start_date=trip.start_date,
        end_date=trip.end_date,
        center_lat=trip.center_lat,
        center_lng=trip.center_lng,
        cover_thumb_url=cover_url,
        media_count=trip.media_count,
        is_manual=bool(trip.is_manual),
        visibility=trip.visibility or "private",
        share_token=trip.share_token,
        owner_id=trip.owner_id,
        user_role=user_role,
    )


@router.get("/trips", response_model=list[TripResponse])
def list_trips(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    accessible_ids = get_accessible_trip_ids(db, current_user)
    if accessible_ids is not None:
        if not accessible_ids:
            return []
        query = db.query(Trip).filter(Trip.id.in_(accessible_ids))
    else:
        query = db.query(Trip)
    trips = query.order_by(Trip.start_date.desc()).all()
    return [serialize_trip(db, t, current_user) for t in trips if t.media_count > 0 or t.is_manual]


@router.post("/trips/recompute", response_model=list[TripResponse])
def recompute_trips_endpoint(
    force_reset: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    trips = rebuild_trips(db, force_reset_manual=force_reset)
    return [
        serialize_trip(db, t, current_user)
        for t in sorted(trips, key=lambda x: x.start_date, reverse=True)
    ]


@router.patch("/trips/{trip_id}", response_model=TripResponse)
def rename_trip_endpoint(
    trip_id: str,
    payload: TripUpdateRequest,
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")

    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="O nome da viagem não pode ser vazio")

    # If another trip already has this exact title, merge them automatically!
    existing_same = (
        db.query(Trip)
        .filter(Trip.title.ilike(new_title), Trip.id != trip_id)
        .first()
    )
    if existing_same:
        return _merge_two_trips(db, source=trip, target=existing_same)

    trip.title = new_title
    if payload.subtitle is not None:
        trip.subtitle = payload.subtitle.strip() or None
    trip.is_manual = True
    for m in db.query(MediaItem).filter(MediaItem.trip_id == trip.id).all():
        m.is_manual_trip = True

    db.commit()
    db.refresh(trip)
    return serialize_trip(db, trip)


@router.post("/trips/merge", response_model=TripResponse)
def merge_trips_endpoint(
    payload: TripMergeRequest,
    db: Session = Depends(get_db),
):
    if payload.source_trip_id == payload.target_trip_id:
        raise HTTPException(status_code=400, detail="Selecione duas viagens diferentes para mesclar")

    source = db.query(Trip).filter(Trip.id == payload.source_trip_id).first()
    target = db.query(Trip).filter(Trip.id == payload.target_trip_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Viagem de origem ou destino não encontrada")

    return _merge_two_trips(db, source=source, target=target)


def _merge_two_trips(db: Session, source: Trip, target: Trip) -> TripResponse:
    source_items = db.query(MediaItem).filter(MediaItem.trip_id == source.id).all()
    for m in source_items:
        m.trip_id = target.id
        m.trip = target
        m.is_manual_trip = True

    source_outings = db.query(Outing).filter(Outing.trip_id == source.id).all()
    for o in source_outings:
        o.trip_id = target.id
        o.trip = target

    target.is_manual = True
    for m in db.query(MediaItem).filter(MediaItem.trip_id == target.id).all():
        m.is_manual_trip = True

    source.media_items = []
    source.outings = []
    db.flush()

    db.delete(source)
    db.flush()
    refresh_trip_summary(db, target)
    db.commit()
    db.refresh(target)
    return serialize_trip(db, target)


@router.post("/trips/create-by-range", response_model=TripResponse)
def create_trip_by_range_endpoint(
    payload: TripCreateByRangeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    clean_title = payload.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Informe um nome para a viagem")

    now = datetime.now(timezone.utc)
    start_dt = payload.start_date or now
    end_dt = payload.end_date or now

    trip = db.query(Trip).filter(Trip.title.ilike(clean_title)).first()
    if not trip:
        trip = Trip(
            id=str(uuid4()),
            title=clean_title,
            subtitle=payload.subtitle.strip() if payload.subtitle else "Viagem personalizada",
            start_date=start_dt,
            end_date=end_dt,
            center_lat=-15.7939,
            center_lng=-47.8828,
            media_count=0,
            is_manual=True,
            owner_id=current_user.id if current_user else None,
        )
        db.add(trip)
        db.flush()
        if current_user:
            db.add(TripMember(trip_id=trip.id, user_id=current_user.id, role="owner"))
    else:
        trip.is_manual = True

    if payload.start_date and payload.end_date:
        matching_items = (
            db.query(MediaItem)
            .filter(MediaItem.taken_at >= payload.start_date, MediaItem.taken_at <= payload.end_date)
            .all()
        )
        for m in matching_items:
            m.trip_id = trip.id
            m.is_manual_trip = True
        db.flush()

    # Clean up any trips that lost all their items
    for other_trip in db.query(Trip).filter(Trip.id != trip.id).all():
        refresh_trip_summary(db, other_trip)

    refresh_trip_summary(db, trip)
    db.commit()
    db.refresh(trip)
    return serialize_trip(db, trip, current_user)


@router.delete("/trips/{trip_id}")
def delete_trip_grouping_endpoint(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")

    if current_user and not current_user.is_admin:
        if trip.owner_id and trip.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Apenas o proprietário pode excluir esta viagem.")

    for m in db.query(MediaItem).filter(MediaItem.trip_id == trip.id).all():
        m.trip_id = None
        m.is_manual_trip = False

    db.delete(trip)
    db.commit()
    return {"status": "deleted", "trip_id": trip_id}


@router.get("/trips/{trip_id}/share", response_model=TripShareResponse)
def get_trip_share_info(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada.")
    invite_url = f"/?join={trip.share_token}" if trip.share_token else None
    return TripShareResponse(
        trip_id=trip.id,
        visibility=trip.visibility or "private",
        share_token=trip.share_token,
        invite_url=invite_url,
    )


@router.post("/trips/{trip_id}/share", response_model=TripShareResponse)
def update_trip_share_info(
    trip_id: str,
    payload: TripShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada.")

    is_owner = (trip.owner_id == current_user.id) or current_user.is_admin
    if not is_owner:
        raise HTTPException(status_code=403, detail="Apenas o proprietário pode alterar o compartilhamento.")

    trip.visibility = payload.visibility
    if payload.visibility == "shared" and not trip.share_token:
        trip.share_token = uuid4().hex[:16]

    db.commit()
    db.refresh(trip)
    invite_url = f"/?join={trip.share_token}" if trip.share_token else None
    return TripShareResponse(
        trip_id=trip.id,
        visibility=trip.visibility,
        share_token=trip.share_token,
        invite_url=invite_url,
    )


@router.get("/trips/{trip_id}/members", response_model=list[TripMemberResponse])
def get_trip_members(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Viagem não encontrada.")

    members = (
        db.query(TripMember, User)
        .join(User, User.id == TripMember.user_id)
        .filter(TripMember.trip_id == trip.id)
        .all()
    )
    result: list[TripMemberResponse] = []
    for m, u in members:
        result.append(
            TripMemberResponse(
                id=m.id,
                user_id=u.id,
                email=u.email,
                name=u.name,
                picture=u.picture,
                role=m.role,
                joined_at=m.joined_at,
            )
        )
    return result


@router.post("/trips/join/{token}", response_model=TripResponse)
def join_trip_by_token(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.share_token == token).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Link de convite inválido ou expirado.")

    if trip.owner_id != current_user.id:
        existing = (
            db.query(TripMember)
            .filter(TripMember.trip_id == trip.id, TripMember.user_id == current_user.id)
            .first()
        )
        if not existing:
            new_member = TripMember(
                id=str(uuid4()),
                trip_id=trip.id,
                user_id=current_user.id,
                role="contributor",
            )
            db.add(new_member)
            db.commit()

    return serialize_trip(db, trip, current_user)


def serialize_outing(db: Session, outing: Outing) -> OutingResponse:
    cover_url = None
    if outing.cover_media_id:
        cover_media = db.query(MediaItem).filter(MediaItem.id == outing.cover_media_id).first()
        if cover_media:
            cover_url = f"/api/storage/thumbnails-web/{cover_media.thumb_web_key}"

    return OutingResponse(
        id=outing.id,
        trip_id=outing.trip_id,
        title=outing.title,
        city=outing.city,
        start_date=outing.start_date,
        end_date=outing.end_date,
        center_lat=outing.center_lat,
        center_lng=outing.center_lng,
        cover_thumb_url=cover_url,
        media_count=outing.media_count,
        is_manual=bool(outing.is_manual),
    )


@router.get("/outings", response_model=list[OutingResponse])
def list_outings(
    trip_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = db.query(Outing)
    accessible_ids = get_accessible_trip_ids(db, current_user)
    if accessible_ids is not None:
        if not accessible_ids:
            return []
        query = query.filter(Outing.trip_id.in_(accessible_ids))
    if trip_id:
        query = query.filter(Outing.trip_id == trip_id)
    outings = query.order_by(Outing.start_date.asc()).all()
    return [serialize_outing(db, o) for o in outings if o.media_count > 0 or o.is_manual]


@router.post("/outings/recompute", response_model=list[OutingResponse])
def recompute_outings_endpoint(
    force_reset: bool = Query(False),
    db: Session = Depends(get_db),
):
    outings = rebuild_outings(db, force_reset_manual=force_reset)
    return [serialize_outing(db, o) for o in outings]


@router.patch("/outings/{outing_id}", response_model=OutingResponse)
def rename_outing_endpoint(
    outing_id: str,
    payload: OutingUpdateRequest,
    db: Session = Depends(get_db),
):
    outing = db.query(Outing).filter(Outing.id == outing_id).first()
    if not outing:
        raise HTTPException(status_code=404, detail="Passeio/Local não encontrado")

    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="O nome do passeio não pode ser vazio")

    existing_same = (
        db.query(Outing)
        .filter(Outing.title.ilike(new_title), Outing.id != outing_id)
        .first()
    )
    if existing_same:
        return _merge_two_outings(db, source=outing, target=existing_same)

    outing.title = new_title
    if payload.city is not None:
        outing.city = payload.city.strip() or outing.city
    outing.is_manual = True

    items = db.query(MediaItem).filter(MediaItem.outing_id == outing.id).all()
    for m in items:
        m.is_manual_outing = True
        if outing.city:
            m.city = outing.city
            m.location_name = f"{outing.title} • {outing.city}"
        else:
            m.location_name = outing.title

    db.commit()
    db.refresh(outing)
    return serialize_outing(db, outing)


@router.post("/outings/merge", response_model=OutingResponse)
def merge_outings_endpoint(
    payload: OutingMergeRequest,
    db: Session = Depends(get_db),
):
    if payload.source_outing_id == payload.target_outing_id:
        raise HTTPException(status_code=400, detail="Selecione dois passeios diferentes para unir")

    source = db.query(Outing).filter(Outing.id == payload.source_outing_id).first()
    target = db.query(Outing).filter(Outing.id == payload.target_outing_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Passeio de origem ou destino não encontrado")

    return _merge_two_outings(db, source=source, target=target)


def _merge_two_outings(db: Session, source: Outing, target: Outing) -> OutingResponse:
    source_items = db.query(MediaItem).filter(MediaItem.outing_id == source.id).all()
    for m in source_items:
        m.outing_id = target.id
        m.outing = target
        m.is_manual_outing = True
        m.location_name = f"{target.title} • {target.city}" if target.city else target.title

    target.is_manual = True
    for m in db.query(MediaItem).filter(MediaItem.outing_id == target.id).all():
        m.is_manual_outing = True

    source.media_items = []
    db.flush()

    db.delete(source)
    db.flush()
    refresh_outing_summary(db, target)
    db.commit()
    db.refresh(target)
    return serialize_outing(db, target)


@router.delete("/outings/{outing_id}")
def delete_outing_endpoint(
    outing_id: str,
    db: Session = Depends(get_db),
):
    outing = db.query(Outing).filter(Outing.id == outing_id).first()
    if not outing:
        raise HTTPException(status_code=404, detail="Passeio não encontrado")

    for m in db.query(MediaItem).filter(MediaItem.outing_id == outing.id).all():
        m.outing_id = None
        m.is_manual_outing = False

    db.delete(outing)
    db.commit()
    return {"status": "deleted", "outing_id": outing_id}


@router.get("/timeline", response_model=TimelineStatsResponse)
def get_timeline_stats(
    trip_id: Optional[str] = Query(None),
    outing_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = db.query(MediaItem)
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
                return TimelineStatsResponse()

    if trip_id:
        query = query.filter(MediaItem.trip_id == trip_id)
    if outing_id:
        query = query.filter(MediaItem.outing_id == outing_id)

    items = query.order_by(MediaItem.taken_at.asc()).all()
    if not items:
        return TimelineStatsResponse()

    min_date = items[0].taken_at
    max_date = items[-1].taken_at
    geotagged = sum(1 for m in items if m.latitude is not None and m.longitude is not None)
    untagged = len(items) - geotagged

    years_set: set[int] = set()
    month_counts: dict[tuple[int, int], int] = {}
    month_cities: dict[tuple[int, int], str] = {}
    day_counts: dict[tuple[int, int, int], int] = {}
    day_cities: dict[tuple[int, int, int], str] = {}

    for m in items:
        dt = m.taken_at
        years_set.add(dt.year)
        m_key = (dt.year, dt.month)
        d_key = (dt.year, dt.month, dt.day)
        month_counts[m_key] = month_counts.get(m_key, 0) + 1
        day_counts[d_key] = day_counts.get(d_key, 0) + 1
        if m.city:
            if m_key not in month_cities:
                month_cities[m_key] = m.city
            if d_key not in day_cities:
                day_cities[d_key] = m.city

    buckets: list[TimelineBucket] = []
    for (year, month) in sorted(month_counts.keys()):
        last_day = calendar.monthrange(year, month)[1]
        start_iso = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc).isoformat()
        end_iso = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc).isoformat()
        ym_str = f"{year:04d}-{month:02d}"
        buckets.append(
            TimelineBucket(
                key=ym_str,
                month=ym_str,
                label=f"{MONTHS_PT.get(month, str(month))}/{str(year)[2:]}",
                sublabel=month_cities.get((year, month)),
                count=month_counts[(year, month)],
                start_date=start_iso,
                end_date=end_iso,
            )
        )

    day_buckets: list[TimelineBucket] = []
    for (year, month, day) in sorted(day_counts.keys()):
        start_iso = datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc).isoformat()
        end_iso = datetime(year, month, day, 23, 59, 59, tzinfo=timezone.utc).isoformat()
        ym_str = f"{year:04d}-{month:02d}"
        ymd_str = f"{year:04d}-{month:02d}-{day:02d}"
        day_buckets.append(
            TimelineBucket(
                key=ymd_str,
                month=ym_str,
                label=f"{day:02d}/{MONTHS_PT.get(month, str(month))}",
                sublabel=day_cities.get((year, month, day)),
                count=day_counts[(year, month, day)],
                start_date=start_iso,
                end_date=end_iso,
            )
        )

    return TimelineStatsResponse(
        min_date=min_date,
        max_date=max_date,
        total_count=len(items),
        geotagged_count=geotagged,
        untagged_count=untagged,
        years=sorted(years_set),
        buckets=buckets,
        day_buckets=day_buckets,
    )


@router.post("/demo/seed")
def seed_demo_endpoint(db: Session = Depends(get_db)):
    added = seed_demo_data(db)
    return {"status": "ok", "added": added}


@router.delete("/media/clear-all")
def clear_all_media_endpoint(db: Session = Depends(get_db)):
    deleted_faces = db.query(FaceDetection).delete()
    deleted_media = db.query(MediaItem).delete()
    deleted_people = db.query(Person).delete()
    deleted_trips = db.query(Trip).delete()
    db.query(ScanJob).delete()
    db.commit()
    return {
        "status": "cleared",
        "deleted_media": deleted_media,
        "deleted_people": deleted_people,
        "deleted_trips": deleted_trips,
        "deleted_faces": deleted_faces,
    }

