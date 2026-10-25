from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    center_lat: Mapped[float] = mapped_column(Float, nullable=False)
    center_lng: Mapped[float] = mapped_column(Float, nullable=False)
    cover_media_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    media_count: Mapped[int] = mapped_column(Integer, default=0)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    media_items: Mapped[list["MediaItem"]] = relationship("MediaItem", back_populates="trip")
    outings: Mapped[list["Outing"]] = relationship("Outing", back_populates="trip")


class Outing(Base):
    __tablename__ = "outings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    trip_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("trips.id", ondelete="SET NULL"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    center_lat: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    center_lng: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cover_media_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    media_count: Mapped[int] = mapped_column(Integer, default=0)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    trip: Mapped[Optional["Trip"]] = relationship("Trip", back_populates="outings")
    media_items: Mapped[list["MediaItem"]] = relationship("MediaItem", back_populates="outing")


class MediaItem(Base):
    __tablename__ = "media_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sha256: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), nullable=False, default="image")  # image | video
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, default="image/jpeg")
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Device / Camera metadata (iPhone 16 Plus, Samsung Galaxy S25, etc.)
    camera_make: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    camera_model: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)

    # Temporal metadata
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Spatial metadata
    latitude: Mapped[Optional[float]] = mapped_column(Float, index=True, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, index=True, nullable=True)
    altitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), index=True, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), index=True, nullable=True)
    is_manual_location: Mapped[bool] = mapped_column(Boolean, default=False)

    # S3 Keys
    original_key: Mapped[str] = mapped_column(String(512), nullable=False)
    thumb_map_key: Mapped[str] = mapped_column(String(512), nullable=False)
    thumb_web_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Trip & Outing (Passeio/Local) association
    trip_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("trips.id", ondelete="SET NULL"), index=True, nullable=True
    )
    is_manual_trip: Mapped[bool] = mapped_column(Boolean, default=False)
    trip: Mapped[Optional["Trip"]] = relationship("Trip", back_populates="media_items")

    outing_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("outings.id", ondelete="SET NULL"), index=True, nullable=True
    )
    is_manual_outing: Mapped[bool] = mapped_column(Boolean, default=False)
    outing: Mapped[Optional["Outing"]] = relationship("Outing", back_populates="media_items")

    # Detected faces
    faces: Mapped[list["FaceDetection"]] = relationship(
        "FaceDetection", back_populates="media", cascade="all, delete-orphan"
    )


class Person(Base):
    __tablename__ = "people"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    is_named: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    cover_face_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    centroid_embedding: Mapped[Optional[list[float]]] = mapped_column(JSON, nullable=True)
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    faces: Mapped[list["FaceDetection"]] = relationship("FaceDetection", back_populates="person")


class FaceDetection(Base):
    __tablename__ = "face_detections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    media_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("media_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    person_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("people.id", ondelete="CASCADE"), index=True, nullable=False
    )
    bbox_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bbox_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bbox_w: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bbox_h: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    crop_key: Mapped[str] = mapped_column(String(512), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    media: Mapped["MediaItem"] = relationship("MediaItem", back_populates="faces")
    person: Mapped["Person"] = relationship("Person", back_populates="faces")


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")  # running | completed | failed
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    imported_files: Mapped[int] = mapped_column(Integer, default=0)
    skipped_files: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DeletedMediaHash(Base):
    __tablename__ = "deleted_media_hashes"

    sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MediaCurationCache(Base):
    __tablename__ = "media_curation_cache"

    sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    trip_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_manual_trip: Mapped[bool] = mapped_column(Boolean, default=False)
    outing_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_manual_outing: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    is_manual_location: Mapped[bool] = mapped_column(Boolean, default=False)
    faces_json: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
