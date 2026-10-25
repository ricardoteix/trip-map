import io
import logging
import os
import urllib.request
from pathlib import Path
from typing import Optional
from uuid import uuid4

import cv2
import numpy as np
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.config import settings
from app.models import FaceDetection, MediaItem, Person
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/"
    "face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/"
    "face_recognition_sface_2021dec.onnx"
)


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


class FaceRecognitionService:
    """
    Deep learning Face Detection & Face Recognition using OpenCV 5 Zoo ONNX models:
    - Detector: YuNet (`FaceDetectorYN`) — filters out landscapes and false positives
      with high confidence + facial landmarks (eyes, nose, mouth corners).
    - Recognizer: SFace (`FaceRecognizerSF`) — aligns the face using the 5 landmarks
      and extracts a 128D identity embedding for accurate person clustering.
    """

    def __init__(self) -> None:
        self._detector = None
        self._recognizer = None
        self._models_ready = False

    def _ensure_models(self) -> bool:
        if self._models_ready and self._detector is not None and self._recognizer is not None:
            return True

        try:
            cache_dir = Path(settings.model_cache_dir)
            cache_dir.mkdir(parents=True, exist_ok=True)
            yunet_path = cache_dir / "yunet.onnx"
            sface_path = cache_dir / "sface.onnx"

            if not yunet_path.exists() or yunet_path.stat().st_size < 100_000:
                logger.info("Downloading YuNet ONNX face detector to %s", yunet_path)
                urllib.request.urlretrieve(YUNET_URL, str(yunet_path))

            if not sface_path.exists() or sface_path.stat().st_size < 1_000_000:
                logger.info("Downloading SFace ONNX face recognizer to %s", sface_path)
                urllib.request.urlretrieve(SFACE_URL, str(sface_path))

            self._detector = cv2.FaceDetectorYN.create(
                str(yunet_path),
                "",
                (320, 320),
                0.82,  # High score threshold so landscapes/objects are never mistaken for faces
                0.3,   # NMS threshold
                5000,
            )
            self._recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
            self._models_ready = True
            return True
        except Exception as exc:
            logger.error("Failed to initialize YuNet/SFace models: %s", exc)
            return False

    def detect_and_cluster_faces(
        self,
        db: Session,
        media: MediaItem,
        pil_image: Image.Image,
        forced_people_names: Optional[list[str]] = None,
    ) -> list[FaceDetection]:
        if forced_people_names:
            return self._assign_named_people(db, media, pil_image, forced_people_names)

        if not self._ensure_models():
            return []

        rgb_img = ImageOps.exif_transpose(pil_image).convert("RGB")
        orig_w, orig_h = rgb_img.size

        # Resize image to max 1280px for fast, accurate YuNet inference
        max_dim = 1280
        scale = 1.0
        if max(orig_w, orig_h) > max_dim:
            scale = max_dim / float(max(orig_w, orig_h))
            work_w = max(64, int(round(orig_w * scale)))
            work_h = max(64, int(round(orig_h * scale)))
            work_img = rgb_img.resize((work_w, work_h), Image.Resampling.BILINEAR)
        else:
            work_w, work_h = orig_w, orig_h
            work_img = rgb_img

        bgr_np = cv2.cvtColor(np.asarray(work_img), cv2.COLOR_RGB2BGR)
        self._detector.setInputSize((work_w, work_h))
        _, faces = self._detector.detect(bgr_np)

        detections: list[FaceDetection] = []
        if faces is None or len(faces) == 0:
            return detections

        existing_people = db.query(Person).all()
        used_person_ids: set[str] = set()

        # Sort faces by size (largest/closest faces first)
        faces_list = sorted(
            faces,
            key=lambda f: float(f[2] * f[3]),
            reverse=True,
        )

        for face_row in faces_list[:12]:
            x, y, w, h = float(face_row[0]), float(face_row[1]), float(face_row[2]), float(face_row[3])
            score = float(face_row[-1])

            # Ignore tiny background faces (< 28px in working resolution) or low confidence
            if score < 0.82 or w < 28 or h < 28:
                continue

            # Align face using the 5 facial landmarks and extract 128D SFace identity embedding
            aligned_face = self._recognizer.alignCrop(bgr_np, face_row)
            feat = self._recognizer.feature(aligned_face).flatten().astype(np.float32)
            norm = float(np.linalg.norm(feat))
            if norm > 0:
                feat = feat / norm
            embedding = [round(float(v), 6) for v in feat.tolist()]

            # Map coordinates back to original resolution for clean high-res portrait avatar crop
            real_x = x / scale
            real_y = y / scale
            real_w = w / scale
            real_h = h / scale

            pad_w = real_w * 0.35
            pad_h = real_h * 0.35
            x1 = max(0, int(round(real_x - pad_w)))
            y1 = max(0, int(round(real_y - pad_h)))
            x2 = min(orig_w, int(round(real_x + real_w + pad_w)))
            y2 = min(orig_h, int(round(real_y + real_h + pad_h)))

            if x2 <= x1 or y2 <= y1:
                continue

            face_crop_pil = rgb_img.crop((x1, y1, x2, y2))
            crop_img = ImageOps.fit(face_crop_pil, (180, 180), method=Image.Resampling.LANCZOS)
            crop_buf = io.BytesIO()
            crop_img.save(crop_buf, format="WEBP", quality=88)
            crop_key = f"{media.id}_{uuid4().hex[:8]}.webp"
            storage_service.put_bytes("face-crops", crop_key, crop_buf.getvalue(), "image/webp")

            # Match against existing person clusters using SFace cosine similarity
            # Standard SFace cosine similarity threshold for same person is ~0.363+
            sface_match_threshold = 0.38
            best_person: Optional[Person] = None
            best_score = -1.0

            for person in existing_people:
                if person.id in used_person_ids or not person.centroid_embedding:
                    continue
                if len(person.centroid_embedding) != len(embedding):
                    continue
                sim = _cosine_similarity(embedding, person.centroid_embedding)
                if sim > best_score:
                    best_score = sim
                    best_person = person

            if best_person is not None and best_score >= sface_match_threshold:
                matched_person = best_person
                old_emb = np.array(matched_person.centroid_embedding, dtype=np.float32)
                new_emb = old_emb * 0.8 + feat * 0.2
                new_norm = float(np.linalg.norm(new_emb))
                if new_norm > 0:
                    new_emb = new_emb / new_norm
                matched_person.centroid_embedding = [round(float(v), 6) for v in new_emb.tolist()]
                matched_person.photo_count = (matched_person.photo_count or 0) + 1
            else:
                cluster_num = len(existing_people) + 1
                matched_person = Person(
                    name=f"Pessoa #{cluster_num}",
                    is_named=False,
                    cover_face_key=crop_key,
                    centroid_embedding=embedding,
                    photo_count=1,
                )
                db.add(matched_person)
                db.flush()
                existing_people.append(matched_person)

            used_person_ids.add(matched_person.id)
            if not matched_person.cover_face_key:
                matched_person.cover_face_key = crop_key

            face_rec = FaceDetection(
                media_id=media.id,
                person_id=matched_person.id,
                bbox_x=round(real_x / orig_w, 4),
                bbox_y=round(real_y / orig_h, 4),
                bbox_w=round(real_w / orig_w, 4),
                bbox_h=round(real_h / orig_h, 4),
                confidence=round(score, 4),
                crop_key=crop_key,
                embedding=embedding,
            )
            db.add(face_rec)
            detections.append(face_rec)

        db.flush()
        return detections

    def reprocess_all_media_faces(self, db: Session) -> dict[str, int]:
        """
        Clears existing auto-detected face clusters and re-runs YuNet + SFace
        across all stored photos so already imported photos don't need to be re-uploaded.
        """
        db.query(FaceDetection).delete()
        db.query(Person).delete()
        db.commit()

        media_items = db.query(MediaItem).filter(MediaItem.media_type == "image").all()
        total_faces = 0
        for item in media_items:
            raw_bytes = storage_service.get_bytes("thumbnails-web", item.thumb_web_key)
            if not raw_bytes:
                raw_bytes = storage_service.get_bytes("originals", item.original_key)
            if not raw_bytes:
                continue
            try:
                with Image.open(io.BytesIO(raw_bytes)) as img:
                    dets = self.detect_and_cluster_faces(db, item, img.copy())
                    total_faces += len(dets)
                db.commit()
            except Exception as exc:
                db.rollback()
                logger.warning("Failed to reprocess faces for %s: %s", item.filename, exc)

        # Refresh photo counts
        people = db.query(Person).all()
        for p in people:
            p.photo_count = (
                db.query(FaceDetection.media_id)
                .filter(FaceDetection.person_id == p.id)
                .distinct()
                .count()
            )
        db.commit()
        return {
            "processed_images": len(media_items),
            "detected_faces": total_faces,
            "people_clusters": len(people),
        }

    def _assign_named_people(
        self,
        db: Session,
        media: MediaItem,
        pil_image: Image.Image,
        names: list[str],
    ) -> list[FaceDetection]:
        detections: list[FaceDetection] = []
        for idx, person_name in enumerate(names):
            person = db.query(Person).filter(Person.name.ilike(person_name.strip())).first()
            crop_key = f"avatar_{person_name.lower().replace(' ', '_')}.webp"

            if person is None:
                avatar_bytes = self._generate_avatar_webp(person_name, idx)
                storage_service.put_bytes("face-crops", crop_key, avatar_bytes, "image/webp")
                rng = np.random.default_rng(abs(hash(person_name.lower())) % (2**32))
                emb = rng.normal(0, 1, 128).astype(np.float32)
                emb = emb / np.linalg.norm(emb)
                person = Person(
                    name=person_name.strip(),
                    is_named=True,
                    cover_face_key=crop_key,
                    centroid_embedding=[round(float(x), 6) for x in emb.tolist()],
                    photo_count=1,
                )
                db.add(person)
                db.flush()
            else:
                person.photo_count = (person.photo_count or 0) + 1

            face_rec = FaceDetection(
                media_id=media.id,
                person_id=person.id,
                bbox_x=round(0.15 + idx * 0.18, 3),
                bbox_y=0.22,
                bbox_w=0.14,
                bbox_h=0.18,
                confidence=0.99,
                crop_key=person.cover_face_key or crop_key,
                embedding=person.centroid_embedding or [0.0] * 128,
            )
            db.add(face_rec)
            detections.append(face_rec)

        db.flush()
        return detections

    @staticmethod
    def _generate_avatar_webp(name: str, color_idx: int = 0) -> bytes:
        from PIL import ImageDraw

        palette = [
            ((37, 99, 235), (219, 234, 254)),
            ((16, 185, 129), (209, 250, 229)),
            ((245, 158, 11), (254, 243, 199)),
            ((236, 72, 153), (252, 231, 243)),
            ((139, 92, 246), (237, 233, 254)),
            ((14, 165, 233), (224, 242, 254)),
        ]
        fg, bg = palette[color_idx % len(palette)]
        img = Image.new("RGB", (160, 160), color=bg)
        draw = ImageDraw.Draw(img)
        draw.ellipse([16, 16, 144, 144], fill=fg)
        draw.ellipse([58, 42, 102, 86], fill=bg)
        draw.pieslice([36, 90, 124, 162], start=180, end=360, fill=bg)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=90)
        return buf.getvalue()


face_service = FaceRecognitionService()
