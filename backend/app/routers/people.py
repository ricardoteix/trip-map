from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FaceDetection, MediaItem, Person, User
from app.routers.auth import get_accessible_trip_ids, get_current_user_optional
from app.schemas import PersonMergeRequest, PersonResponse, PersonUpdateRequest
from app.services.face_service import face_service
from app.services.storage import storage_service

router = APIRouter(prefix="/api/people", tags=["people"])


def serialize_person(person: Person) -> PersonResponse:
    avatar_url = (
        f"/api/storage/face-crops/{person.cover_face_key}" if person.cover_face_key else None
    )
    return PersonResponse(
        id=person.id,
        name=person.name,
        is_named=person.is_named,
        photo_count=person.photo_count or 0,
        avatar_url=avatar_url,
    )


@router.get("", response_model=list[PersonResponse])
def list_people(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    accessible_ids = get_accessible_trip_ids(db, current_user)
    if accessible_ids is not None:
        user_id = current_user.id if current_user else None
        conditions = []
        if accessible_ids:
            conditions.append(MediaItem.trip_id.in_(accessible_ids))
        if user_id:
            conditions.append(MediaItem.uploaded_by_user_id == user_id)

        if not conditions:
            return []

        matching_person_ids = (
            db.query(FaceDetection.person_id)
            .join(MediaItem, MediaItem.id == FaceDetection.media_id)
            .filter(or_(*conditions))
            .distinct()
            .all()
        )
        person_ids = [p[0] for p in matching_person_ids if p[0] is not None]
        if not person_ids:
            return []
        people = (
            db.query(Person)
            .filter(Person.id.in_(person_ids))
            .order_by(Person.is_named.desc(), Person.photo_count.desc(), Person.name.asc())
            .all()
        )
    else:
        people = (
            db.query(Person)
            .order_by(Person.is_named.desc(), Person.photo_count.desc(), Person.name.asc())
            .all()
        )
    return [serialize_person(p) for p in people if (p.photo_count or 0) > 0 or p.is_named]


@router.patch("/{person_id}", response_model=PersonResponse)
def rename_person(
    person_id: str,
    payload: PersonUpdateRequest,
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")

    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="O nome não pode ser vazio")

    # If another person cluster already has this exact name, merge automatically
    existing_same_name = (
        db.query(Person)
        .filter(Person.name.ilike(new_name), Person.id != person_id)
        .first()
    )
    if existing_same_name:
        return _merge_people_clusters(db, source=person, target=existing_same_name)

    person.name = new_name
    person.is_named = True
    db.commit()
    db.refresh(person)
    return serialize_person(person)


@router.post("/merge", response_model=PersonResponse)
def merge_people(
    payload: PersonMergeRequest,
    db: Session = Depends(get_db),
):
    if payload.source_person_id == payload.target_person_id:
        raise HTTPException(status_code=400, detail="Selecione duas pessoas diferentes para mesclar")

    source = db.query(Person).filter(Person.id == payload.source_person_id).first()
    target = db.query(Person).filter(Person.id == payload.target_person_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Pessoa de origem ou destino não encontrada")

    return _merge_people_clusters(db, source=source, target=target)


@router.post("/reprocess")
def reprocess_faces_endpoint(db: Session = Depends(get_db)):
    stats = face_service.reprocess_all_media_faces(db)
    return stats


@router.delete("/{person_id}")
def delete_person_cluster(
    person_id: str,
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Grupo/Pessoa não encontrada")

    faces = db.query(FaceDetection).filter(FaceDetection.person_id == person.id).all()
    for face in faces:
        if face.crop_key and not face.crop_key.startswith("avatar_"):
            storage_service.delete_object("face-crops", face.crop_key)
        db.delete(face)

    if person.cover_face_key and not person.cover_face_key.startswith("avatar_"):
        storage_service.delete_object("face-crops", person.cover_face_key)

    db.delete(person)
    db.commit()
    return {"status": "deleted", "person_id": person_id}


def _merge_people_clusters(db: Session, source: Person, target: Person) -> PersonResponse:
    source_faces = db.query(FaceDetection).filter(FaceDetection.person_id == source.id).all()
    for face in source_faces:
        duplicate_in_same_media = (
            db.query(FaceDetection)
            .filter(
                FaceDetection.media_id == face.media_id,
                FaceDetection.person_id == target.id,
            )
            .first()
        )
        if duplicate_in_same_media:
            db.delete(face)
        else:
            face.person_id = target.id
            face.person = target

    source.faces = []
    db.flush()
    db.delete(source)
    db.flush()

    target.photo_count = (
        db.query(FaceDetection.media_id)
        .filter(FaceDetection.person_id == target.id)
        .distinct()
        .count()
    )
    db.commit()
    db.refresh(target)
    return serialize_person(target)
