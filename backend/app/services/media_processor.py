import hashlib
import io
import json
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import exifread
from PIL import Image, ImageDraw, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

try:
    import reverse_geocoder as rg
except Exception:
    rg = None

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".heic", ".heif", ".png", ".webp", ".dng"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".3gp"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

COUNTRY_NAMES = {
    "BR": "Brasil",
    "PT": "Portugal",
    "ES": "Espanha",
    "FR": "França",
    "IT": "Itália",
    "US": "Estados Unidos",
    "AR": "Argentina",
    "CL": "Chile",
    "UY": "Uruguai",
    "PE": "Peru",
    "GB": "Reino Unido",
    "DE": "Alemanha",
    "CH": "Suíça",
    "NL": "Países Baixos",
    "JP": "Japão",
    "MX": "México",
    "CA": "Canadá",
}


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _ratio_to_float(val: Any) -> float:
    if hasattr(val, "num") and hasattr(val, "den"):
        return float(val.num) / float(val.den) if val.den != 0 else 0.0
    if isinstance(val, tuple) and len(val) == 2:
        return float(val[0]) / float(val[1]) if val[1] != 0 else 0.0
    return float(val)


def _convert_dms_to_degrees(values: Any, ref: str) -> Optional[float]:
    try:
        d = _ratio_to_float(values[0])
        m = _ratio_to_float(values[1])
        s = _ratio_to_float(values[2])
        deg = d + (m / 60.0) + (s / 3600.0)
        if ref.upper() in ("S", "W"):
            deg = -deg
        return round(deg, 6)
    except Exception:
        return None


def _parse_exif_datetime(raw: str) -> Optional[datetime]:
    cleaned = str(raw).strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(cleaned[:19], fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def resolve_city_country(lat: Optional[float], lng: Optional[float]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    if lat is None or lng is None:
        return None, None, None
    try:
        if rg is not None:
            results = rg.search([(lat, lng)], verbose=False)
            if results:
                item = results[0]
                city = item.get("name") or None
                cc = item.get("cc") or ""
                country = COUNTRY_NAMES.get(cc, cc)
                loc_name = f"{city}, {country}" if city and country else (city or country)
                return city, country, loc_name
    except Exception as exc:
        logger.debug("Reverse geocoder fallback triggered: %s", exc)

    return None, None, f"{lat:.4f}, {lng:.4f}"


def extract_image_metadata(data: bytes, fallback_dt: Optional[datetime] = None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "width": None,
        "height": None,
        "camera_make": None,
        "camera_model": None,
        "taken_at": fallback_dt or datetime.now(timezone.utc),
        "latitude": None,
        "longitude": None,
        "altitude": None,
    }

    # Try exifread first
    try:
        tags = exifread.process_file(io.BytesIO(data), details=False)
        if "Image Make" in tags:
            meta["camera_make"] = str(tags["Image Make"]).strip()
        if "Image Model" in tags:
            meta["camera_model"] = str(tags["Image Model"]).strip()

        for dt_key in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
            if dt_key in tags:
                parsed = _parse_exif_datetime(str(tags[dt_key]))
                if parsed:
                    meta["taken_at"] = parsed
                    break

        if "GPS GPSLatitude" in tags and "GPS GPSLatitudeRef" in tags:
            meta["latitude"] = _convert_dms_to_degrees(
                tags["GPS GPSLatitude"].values, str(tags["GPS GPSLatitudeRef"])
            )
        if "GPS GPSLongitude" in tags and "GPS GPSLongitudeRef" in tags:
            meta["longitude"] = _convert_dms_to_degrees(
                tags["GPS GPSLongitude"].values, str(tags["GPS GPSLongitudeRef"])
            )
        if "GPS GPSAltitude" in tags:
            try:
                meta["altitude"] = round(_ratio_to_float(tags["GPS GPSAltitude"].values[0]), 1)
            except Exception:
                pass
    except Exception as exc:
        logger.debug("exifread parse warning: %s", exc)

    # Also inspect Pillow EXIF (essential for HEIC / iPhone 16 Plus / Galaxy S25)
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            meta["width"], meta["height"] = img.size
            exif = img.getexif()
            if exif:
                if not meta["camera_make"] and 271 in exif:
                    meta["camera_make"] = str(exif.get(271)).strip()
                if not meta["camera_model"] and 272 in exif:
                    meta["camera_model"] = str(exif.get(272)).strip()
                for tag_id in (36867, 36868, 306):
                    if tag_id in exif:
                        parsed = _parse_exif_datetime(str(exif.get(tag_id)))
                        if parsed:
                            meta["taken_at"] = parsed
                            break
                gps_ifd = exif.get_ifd(0x8825) if hasattr(exif, "get_ifd") else None
                if gps_ifd:
                    if meta["latitude"] is None and 2 in gps_ifd and 1 in gps_ifd:
                        meta["latitude"] = _convert_dms_to_degrees(gps_ifd[2], str(gps_ifd[1]))
                    if meta["longitude"] is None and 4 in gps_ifd and 3 in gps_ifd:
                        meta["longitude"] = _convert_dms_to_degrees(gps_ifd[4], str(gps_ifd[3]))
    except Exception as exc:
        logger.debug("Pillow EXIF inspect warning: %s", exc)

    return meta


def extract_video_metadata(file_path: Path, fallback_dt: Optional[datetime] = None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "width": 1920,
        "height": 1080,
        "duration_sec": None,
        "camera_make": None,
        "camera_model": None,
        "taken_at": fallback_dt or datetime.now(timezone.utc),
        "latitude": None,
        "longitude": None,
        "altitude": None,
    }
    try:
        cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(file_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if proc.returncode == 0 and proc.stdout:
            info = json.loads(proc.stdout)
            fmt = info.get("format", {})
            if "duration" in fmt:
                meta["duration_sec"] = round(float(fmt["duration"]), 2)
            tags = fmt.get("tags", {})
            for k, v in tags.items():
                kl = k.lower()
                if "creation_time" in kl:
                    parsed = _parse_exif_datetime(str(v).replace("Z", ""))
                    if parsed:
                        meta["taken_at"] = parsed
                elif "make" in kl:
                    meta["camera_make"] = str(v)
                elif "model" in kl:
                    meta["camera_model"] = str(v)
                elif "location" in kl:
                    # ISO 6709 string e.g. "+38.7223-009.1393+015.000/"
                    loc_str = str(v).strip("/")
                    import re

                    m = re.match(r"([+-]\d+\.\d+)([+-]\d+\.\d+)", loc_str)
                    if m:
                        meta["latitude"] = round(float(m.group(1)), 6)
                        meta["longitude"] = round(float(m.group(2)), 6)
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "video":
                    meta["width"] = stream.get("width", meta["width"])
                    meta["height"] = stream.get("height", meta["height"])
                    break
    except Exception as exc:
        logger.debug("ffprobe video metadata fallback: %s", exc)
    return meta


def generate_image_thumbnails(data: bytes) -> tuple[bytes, bytes, Image.Image]:
    with Image.open(io.BytesIO(data)) as raw_img:
        img = ImageOps.exif_transpose(raw_img).convert("RGB")

        # 256x256 square crop for map pin
        map_thumb = ImageOps.fit(img, (256, 256), method=Image.Resampling.LANCZOS)
        map_buf = io.BytesIO()
        map_thumb.save(map_buf, format="WEBP", quality=82)

        # 1200px max web preview
        web_thumb = img.copy()
        web_thumb.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        web_buf = io.BytesIO()
        web_thumb.save(web_buf, format="WEBP", quality=85)

        return map_buf.getvalue(), web_buf.getvalue(), img


def generate_video_thumbnails(file_path: Path) -> tuple[bytes, bytes]:
    frame_img: Optional[Image.Image] = None
    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            "00:00:00.500",
            "-i",
            str(file_path),
            "-frames:v",
            "1",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=15)
        if proc.returncode == 0 and proc.stdout:
            frame_img = Image.open(io.BytesIO(proc.stdout)).convert("RGB")
    except Exception:
        pass

    if frame_img is None:
        frame_img = Image.new("RGB", (800, 600), color=(226, 232, 240))
        draw = ImageDraw.Draw(frame_img)
        draw.polygon([(350, 240), (350, 360), (470, 300)], fill=(59, 130, 246))

    buf = io.BytesIO()
    frame_img.save(buf, format="JPEG", quality=90)
    map_bytes, web_bytes, _ = generate_image_thumbnails(buf.getvalue())
    return map_bytes, web_bytes
