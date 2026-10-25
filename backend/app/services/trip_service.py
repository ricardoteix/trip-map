import io
import math
from datetime import datetime, timezone
from uuid import uuid4

from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from app.config import settings
from app.models import FaceDetection, MediaItem, Outing, Person, Trip
from app.services.face_service import face_service
from app.services.media_processor import compute_sha256, generate_image_thumbnails, resolve_city_country
from app.services.storage import storage_service

MONTHS_PT = {
    1: "Jan",
    2: "Fev",
    3: "Mar",
    4: "Abr",
    5: "Mai",
    6: "Jun",
    7: "Jul",
    8: "Ago",
    9: "Set",
    10: "Out",
    11: "Nov",
    12: "Dez",
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def refresh_trip_summary(db: Session, trip: Trip) -> bool:
    """
    Recalculates start_date, end_date, center_lat, center_lng, cover_media_id, and media_count
    for a Trip based on its currently assigned MediaItems.
    Returns False if the trip has 0 items and was deleted (when not manual).
    """
    items = (
        db.query(MediaItem)
        .filter(MediaItem.trip_id == trip.id)
        .order_by(MediaItem.taken_at.asc())
        .all()
    )
    if not items:
        if not trip.is_manual:
            db.delete(trip)
            return False
        trip.media_count = 0
        trip.cover_media_id = None
        return True

    trip.start_date = items[0].taken_at
    trip.end_date = items[-1].taken_at
    trip.media_count = len(items)
    trip.cover_media_id = items[0].id

    geo_items = [m for m in items if m.latitude is not None and m.longitude is not None]
    if geo_items:
        avg_lat = sum(m.latitude for m in geo_items if m.latitude is not None) / len(geo_items)
        avg_lng = sum(m.longitude for m in geo_items if m.longitude is not None) / len(geo_items)
        trip.center_lat = round(avg_lat, 6)
        trip.center_lng = round(avg_lng, 6)
        if not trip.city:
            city = next((m.city for m in geo_items if m.city), None)
            country = next((m.country for m in geo_items if m.country), None)
            if not city:
                city, country, _ = resolve_city_country(avg_lat, avg_lng)
            trip.city = city
            trip.country = country

    return True


def rebuild_trips(db: Session, force_reset_manual: bool = False) -> list[Trip]:
    """
    Groups geotagged media items chronologically and spatially into Trips / Moments,
    while preserving any Trip or MediaItem that was manually named, merged, or assigned.
    Also attaches untagged photos whose timestamps fall within a Trip's date window.
    """
    if force_reset_manual:
        for m in db.query(MediaItem).all():
            m.trip_id = None
            m.is_manual_trip = False
        db.query(Trip).delete()
        db.flush()
    else:
        # Clear only non-manual media items and non-manual trips
        auto_trips = db.query(Trip).filter(Trip.is_manual.is_(False)).all()
        auto_trip_ids = {t.id for t in auto_trips}

        for m in db.query(MediaItem).all():
            if not m.is_manual_trip or (m.trip_id and m.trip_id in auto_trip_ids):
                if m.trip_id in auto_trip_ids:
                    m.trip_id = None
                    m.is_manual_trip = False

        for t in auto_trips:
            db.delete(t)
        db.flush()

    # Geotagged items that don't belong to a manual trip yet
    items = (
        db.query(MediaItem)
        .filter(
            MediaItem.latitude.isnot(None),
            MediaItem.longitude.isnot(None),
            MediaItem.trip_id.is_(None),
        )
        .order_by(MediaItem.taken_at.asc())
        .all()
    )

    groups: list[list[MediaItem]] = []
    if items:
        current_group: list[MediaItem] = [items[0]]
        for item in items[1:]:
            prev = current_group[-1]
            hours_diff = abs((item.taken_at - prev.taken_at).total_seconds()) / 3600.0
            dist_km = haversine_km(
                prev.latitude or 0.0,
                prev.longitude or 0.0,
                item.latitude or 0.0,
                item.longitude or 0.0,
            )
            if hours_diff <= settings.trip_max_hours_gap and dist_km <= settings.trip_max_distance_km:
                current_group.append(item)
            else:
                groups.append(current_group)
                current_group = [item]

        if current_group:
            groups.append(current_group)

    for grp in groups:
        avg_lat = sum(m.latitude for m in grp if m.latitude is not None) / len(grp)
        avg_lng = sum(m.longitude for m in grp if m.longitude is not None) / len(grp)

        city = next((m.city for m in grp if m.city), None)
        country = next((m.country for m in grp if m.country), None)
        if not city:
            city, country, _ = resolve_city_country(avg_lat, avg_lng)

        start_dt = grp[0].taken_at
        end_dt = grp[-1].taken_at
        month_label = f"{MONTHS_PT.get(start_dt.month, '')} {start_dt.year}"
        place_label = city or country or "Viagem"
        title = f"{place_label} • {month_label}"
        subtitle = f"{city}, {country}" if city and country else (country or city or "Momento")

        trip = Trip(
            id=str(uuid4()),
            title=title,
            subtitle=subtitle,
            city=city,
            country=country,
            start_date=start_dt,
            end_date=end_dt,
            center_lat=round(avg_lat, 6),
            center_lng=round(avg_lng, 6),
            cover_media_id=grp[0].id,
            media_count=len(grp),
            is_manual=False,
        )
        db.add(trip)
        db.flush()

        for m in grp:
            m.trip_id = trip.id

    # Attach unassigned untagged photos if their taken_at falls inside a Trip's date range (+-12h)
    all_trips = db.query(Trip).order_by(Trip.start_date.asc()).all()
    unassigned_items = db.query(MediaItem).filter(MediaItem.trip_id.is_(None)).all()
    for u_item in unassigned_items:
        for t in all_trips:
            start_pad = t.start_date.timestamp() - 12 * 3600
            end_pad = t.end_date.timestamp() + 12 * 3600
            if start_pad <= u_item.taken_at.timestamp() <= end_pad:
                u_item.trip_id = t.id
                break

    # Refresh summaries for all existing trips
    surviving_trips: list[Trip] = []
    for t in list(all_trips):
        if refresh_trip_summary(db, t):
            surviving_trips.append(t)

    # Refresh person photo counts
    people = db.query(Person).all()
    for p in people:
        p.photo_count = (
            db.query(FaceDetection.media_id)
            .filter(FaceDetection.person_id == p.id)
            .distinct()
            .count()
        )

    db.commit()
    rebuild_outings(db)
    return surviving_trips


def refresh_outing_summary(db: Session, outing: Outing) -> bool:
    items = (
        db.query(MediaItem)
        .filter(MediaItem.outing_id == outing.id)
        .order_by(MediaItem.taken_at.asc())
        .all()
    )
    if not items:
        if not outing.is_manual:
            db.delete(outing)
            return False
        outing.media_count = 0
        outing.cover_media_id = None
        return True

    outing.start_date = items[0].taken_at
    outing.end_date = items[-1].taken_at
    outing.media_count = len(items)
    outing.cover_media_id = items[0].id
    if not outing.trip_id:
        outing.trip_id = next((m.trip_id for m in items if m.trip_id), None)

    geo_items = [m for m in items if m.latitude is not None and m.longitude is not None]
    if geo_items:
        avg_lat = sum(m.latitude for m in geo_items if m.latitude is not None) / len(geo_items)
        avg_lng = sum(m.longitude for m in geo_items if m.longitude is not None) / len(geo_items)
        outing.center_lat = round(avg_lat, 6)
        outing.center_lng = round(avg_lng, 6)
        if not outing.city:
            outing.city = next((m.city for m in geo_items if m.city), None)

    return True


def rebuild_outings(
    db: Session,
    max_radius_km: float = 4.5,
    max_hours_gap: float = 18.0,
    force_reset_manual: bool = False,
) -> list[Outing]:
    """
    Creates second-level Outings / Specific Places (Passeios/Locais) within Trips by clustering
    photos taken within a tight radius (~4.5 km) and time window (~18 hours), matching against
    existing group centroids so interleaved photos from multiple phones do not fragment a stop,
    while preserving any Outing that was manually named or assigned by the user.
    """
    if force_reset_manual:
        for m in db.query(MediaItem).all():
            m.outing_id = None
            m.is_manual_outing = False
        db.query(Outing).delete()
        db.flush()
    else:
        auto_outings = db.query(Outing).filter(Outing.is_manual.is_(False)).all()
        auto_ids = {o.id for o in auto_outings}
        for m in db.query(MediaItem).all():
            if not m.is_manual_outing or (m.outing_id and m.outing_id in auto_ids):
                if m.outing_id in auto_ids:
                    m.outing_id = None
                    m.is_manual_outing = False
        for o in auto_outings:
            db.delete(o)
        db.flush()

    items = (
        db.query(MediaItem)
        .filter(
            MediaItem.latitude.isnot(None),
            MediaItem.longitude.isnot(None),
            MediaItem.outing_id.is_(None),
        )
        .order_by(MediaItem.taken_at.asc())
        .all()
    )

    groups: list[list[MediaItem]] = []
    for item in items:
        placed = False
        for grp in groups:
            avg_lat = sum(x.latitude for x in grp if x.latitude is not None) / len(grp)
            avg_lng = sum(x.longitude for x in grp if x.longitude is not None) / len(grp)
            hours_diff = abs((item.taken_at - grp[-1].taken_at).total_seconds()) / 3600.0
            dist_km = haversine_km(
                avg_lat,
                avg_lng,
                item.latitude or 0.0,
                item.longitude or 0.0,
            )
            if hours_diff <= max_hours_gap and dist_km <= max_radius_km:
                grp.append(item)
                placed = True
                break
        if not placed:
            groups.append([item])

    # Fold tiny 1-2 photo GPS-cache outliers into the closest main group within 4 hours
    main_groups = [g for g in groups if len(g) >= 3]
    tiny_groups = [g for g in groups if len(g) < 3]
    if main_groups and tiny_groups:
        remaining_tiny: list[list[MediaItem]] = []
        for t_grp in tiny_groups:
            t_time = t_grp[0].taken_at
            best_main = None
            best_sec = float("inf")
            for m_grp in main_groups:
                sec = min(
                    abs((t_time - m_grp[0].taken_at).total_seconds()),
                    abs((t_time - m_grp[-1].taken_at).total_seconds()),
                )
                if sec <= 4 * 3600 and sec < best_sec:
                    best_sec = sec
                    best_main = m_grp
            if best_main is not None:
                best_main.extend(t_grp)
                best_main.sort(key=lambda x: x.taken_at)
            else:
                remaining_tiny.append(t_grp)
        groups = sorted(main_groups + remaining_tiny, key=lambda g: g[0].taken_at)

    city_stop_counter: dict[str, int] = {}
    for grp in groups:
        avg_lat = sum(m.latitude for m in grp if m.latitude is not None) / len(grp)
        avg_lng = sum(m.longitude for m in grp if m.longitude is not None) / len(grp)
        city = next((m.city for m in grp if m.city), None)
        if not city:
            city, _, _ = resolve_city_country(avg_lat, avg_lng)

        start_dt = grp[0].taken_at
        day_str = f"{start_dt.day:02d}/{MONTHS_PT.get(start_dt.month, '')}"
        base_city = city or "Local"
        city_stop_counter[base_city] = city_stop_counter.get(base_city, 0) + 1
        stop_num = city_stop_counter[base_city]

        title = f"{base_city} ({day_str})" if stop_num == 1 else f"{base_city} #{stop_num} ({day_str})"
        trip_id = next((m.trip_id for m in grp if m.trip_id), None)

        outing = Outing(
            id=str(uuid4()),
            trip_id=trip_id,
            title=title,
            city=city,
            start_date=start_dt,
            end_date=grp[-1].taken_at,
            center_lat=round(avg_lat, 6),
            center_lng=round(avg_lng, 6),
            cover_media_id=grp[0].id,
            media_count=len(grp),
            is_manual=False,
        )
        db.add(outing)
        db.flush()

        for m in grp:
            m.outing_id = outing.id
        db.flush()

    all_outings = db.query(Outing).order_by(Outing.start_date.asc()).all()
    # Attach unassigned untagged photos if taken within +-3 hours of an outing on the same trip
    unassigned_items = db.query(MediaItem).filter(MediaItem.outing_id.is_(None)).all()
    for u_item in unassigned_items:
        for o in all_outings:
            if u_item.trip_id and o.trip_id and u_item.trip_id != o.trip_id:
                continue
            start_pad = o.start_date.timestamp() - 3 * 3600
            end_pad = o.end_date.timestamp() + 3 * 3600
            if start_pad <= u_item.taken_at.timestamp() <= end_pad:
                u_item.outing_id = o.id
                break
    db.flush()

    surviving: list[Outing] = []
    for o in list(all_outings):
        if refresh_outing_summary(db, o):
            surviving.append(o)

    db.commit()
    return surviving


def seed_demo_data(db: Session) -> int:
    """
    Creates realistic sample travel photos (from iPhone 16 Plus and Samsung Galaxy S25)
    featuring Ricardo, Saulo, Michele, and Lorena across iconic trips so the user can
    immediately explore the Map, Timeline, Trips, and Boolean AND/OR People filter.
    """
    samples = [
        # Trip 1: Lisboa & Sintra, Portugal (Maio 2025)
        {
            "filename": "IMG_1041_Lisboa_TorreBelem.HEIC",
            "camera_make": "Apple",
            "camera_model": "iPhone 16 Plus",
            "taken_at": datetime(2025, 5, 12, 10, 30, tzinfo=timezone.utc),
            "lat": 38.6916,
            "lng": -9.2160,
            "city": "Lisboa",
            "country": "Portugal",
            "location_name": "Torre de Belém, Lisboa",
            "people": ["Ricardo", "Saulo", "Michele", "Lorena"],
            "colors": ((56, 189, 248), (254, 240, 138)),
        },
        {
            "filename": "IMG_1045_Lisboa_Alfama.HEIC",
            "camera_make": "Apple",
            "camera_model": "iPhone 16 Plus",
            "taken_at": datetime(2025, 5, 12, 16, 15, tzinfo=timezone.utc),
            "lat": 38.7117,
            "lng": -9.1303,
            "city": "Lisboa",
            "country": "Portugal",
            "location_name": "Miradouro de Santa Luzia, Lisboa",
            "people": ["Ricardo", "Michele"],
            "colors": ((251, 146, 60), (254, 215, 170)),
        },
        {
            "filename": "SAM_20250513_Sintra_Pena.jpg",
            "camera_make": "Samsung",
            "camera_model": "Galaxy S25",
            "taken_at": datetime(2025, 5, 13, 11, 20, tzinfo=timezone.utc),
            "lat": 38.7876,
            "lng": -9.3906,
            "city": "Sintra",
            "country": "Portugal",
            "location_name": "Palácio Nacional da Pena, Sintra",
            "people": ["Ricardo", "Saulo", "Michele", "Lorena"],
            "colors": ((244, 63, 94), (253, 230, 138)),
        },
        # Trip 2: Madri & Toledo, Espanha (Maio 2025)
        {
            "filename": "IMG_1102_Madrid_Retiro.HEIC",
            "camera_make": "Apple",
            "camera_model": "iPhone 16 Plus",
            "taken_at": datetime(2025, 5, 16, 14, 10, tzinfo=timezone.utc),
            "lat": 40.4153,
            "lng": -3.6845,
            "city": "Madri",
            "country": "Espanha",
            "location_name": "Parque del Retiro, Madri",
            "people": ["Ricardo", "Saulo", "Michele", "Lorena"],
            "colors": ((34, 197, 94), (187, 247, 208)),
        },
        {
            "filename": "SAM_20250517_Madrid_PlazaMayor.jpg",
            "camera_make": "Samsung",
            "camera_model": "Galaxy S25",
            "taken_at": datetime(2025, 5, 17, 19, 45, tzinfo=timezone.utc),
            "lat": 40.4155,
            "lng": -3.7074,
            "city": "Madri",
            "country": "Espanha",
            "location_name": "Plaza Mayor, Madri",
            "people": ["Saulo", "Lorena"],
            "colors": ((234, 88, 12), (254, 202, 202)),
        },
        # Trip 3: Rio de Janeiro, Brasil (Janeiro 2026)
        {
            "filename": "IMG_2088_Rio_CristoRedentor.HEIC",
            "camera_make": "Apple",
            "camera_model": "iPhone 16 Plus",
            "taken_at": datetime(2026, 1, 18, 9, 40, tzinfo=timezone.utc),
            "lat": -22.9519,
            "lng": -43.2105,
            "city": "Rio de Janeiro",
            "country": "Brasil",
            "location_name": "Cristo Redentor, Rio de Janeiro",
            "people": ["Ricardo", "Saulo", "Michele", "Lorena"],
            "colors": ((14, 165, 233), (186, 230, 253)),
        },
        {
            "filename": "SAM_20260119_Rio_Ipanema.jpg",
            "camera_make": "Samsung",
            "camera_model": "Galaxy S25",
            "taken_at": datetime(2026, 1, 19, 17, 50, tzinfo=timezone.utc),
            "lat": -22.9868,
            "lng": -43.2045,
            "city": "Rio de Janeiro",
            "country": "Brasil",
            "location_name": "Praia de Ipanema, Rio de Janeiro",
            "people": ["Ricardo", "Michele", "Lorena"],
            "colors": ((249, 115, 22), (253, 186, 116)),
        },
        # Trip 4: Bariloche, Argentina (Julho 2026)
        {
            "filename": "IMG_3310_Bariloche_CerroCatedral.HEIC",
            "camera_make": "Apple",
            "camera_model": "iPhone 16 Plus",
            "taken_at": datetime(2026, 7, 8, 13, 15, tzinfo=timezone.utc),
            "lat": -41.1688,
            "lng": -71.4417,
            "city": "San Carlos de Bariloche",
            "country": "Argentina",
            "location_name": "Cerro Catedral, Bariloche",
            "people": ["Ricardo", "Saulo", "Michele", "Lorena"],
            "colors": ((99, 102, 241), (224, 231, 255)),
        },
        {
            "filename": "SAM_20260709_Bariloche_LlaoLlao.jpg",
            "camera_make": "Samsung",
            "camera_model": "Galaxy S25",
            "taken_at": datetime(2026, 7, 9, 15, 30, tzinfo=timezone.utc),
            "lat": -41.0573,
            "lng": -71.5342,
            "city": "San Carlos de Bariloche",
            "country": "Argentina",
            "location_name": "Circuito Chico & Llao Llao, Bariloche",
            "people": ["Ricardo", "Saulo"],
            "colors": ((6, 182, 212), (207, 250, 254)),
        },
        # Photo without GPS to demonstrate Batch Manual Geotagging
        {
            "filename": "WhatsApp_Foto_Sem_GPS_01.jpg",
            "camera_make": "Samsung",
            "camera_model": "Galaxy S25",
            "taken_at": datetime(2026, 7, 10, 20, 0, tzinfo=timezone.utc),
            "lat": None,
            "lng": None,
            "city": None,
            "country": None,
            "location_name": None,
            "people": ["Ricardo", "Michele"],
            "colors": ((168, 85, 247), (243, 232, 255)),
        },
    ]

    created_count = 0
    for item in samples:
        img = _render_scenic_card(item["location_name"] or item["filename"], item["colors"][0], item["colors"][1])
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        raw_bytes = buf.getvalue()
        sha = compute_sha256(raw_bytes + item["filename"].encode("utf-8"))

        if db.query(MediaItem).filter(MediaItem.sha256 == sha).first():
            continue

        map_bytes, web_bytes, pil_img = generate_image_thumbnails(raw_bytes)
        media_id = str(uuid4())
        orig_key = f"{media_id}_{item['filename']}"
        map_key = f"{media_id}_map.webp"
        web_key = f"{media_id}_web.webp"

        storage_service.put_bytes("originals", orig_key, raw_bytes, "image/jpeg")
        storage_service.put_bytes("thumbnails-map", map_key, map_bytes, "image/webp")
        storage_service.put_bytes("thumbnails-web", web_key, web_bytes, "image/webp")

        media = MediaItem(
            id=media_id,
            sha256=sha,
            filename=item["filename"],
            media_type="image",
            mime_type="image/jpeg",
            file_size=len(raw_bytes),
            width=1200,
            height=900,
            camera_make=item["camera_make"],
            camera_model=item["camera_model"],
            taken_at=item["taken_at"],
            latitude=item["lat"],
            longitude=item["lng"],
            location_name=item["location_name"],
            city=item["city"],
            country=item["country"],
            original_key=orig_key,
            thumb_map_key=map_key,
            thumb_web_key=web_key,
        )
        db.add(media)
        db.flush()

        face_service.detect_and_cluster_faces(db, media, pil_img, forced_people_names=item["people"])
        created_count += 1

    db.commit()
    rebuild_trips(db)
    return created_count


def _render_scenic_card(label: str, top_rgb: tuple[int, int, int], bottom_rgb: tuple[int, int, int]) -> Image.Image:
    w, h = 1200, 900
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / float(h)
        r = int(top_rgb[0] * (1 - t) + bottom_rgb[0] * t)
        g = int(top_rgb[1] * (1 - t) + bottom_rgb[1] * t)
        b = int(top_rgb[2] * (1 - t) + bottom_rgb[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Sun & mountain silhouettes for visual aesthetics on map pins
    draw.ellipse([860, 140, 1040, 320], fill=(255, 255, 255))
    draw.polygon([(0, 900), (0, 620), (380, 410), (760, 680), (1200, 460), (1200, 900)], fill=(30, 41, 59))
    draw.polygon([(260, 900), (650, 490), (1050, 740), (1200, 610), (1200, 900)], fill=(15, 23, 42))
    return img
