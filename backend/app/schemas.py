from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PersonBrief(BaseModel):
    id: str
    name: str
    is_named: bool
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FaceBrief(BaseModel):
    id: str
    person_id: str
    person_name: str
    is_named: bool
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float
    crop_url: str


class MediaResponse(BaseModel):
    id: str
    filename: str
    media_type: str
    mime_type: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration_sec: Optional[float] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    taken_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    location_name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    is_manual_location: bool = False
    trip_id: Optional[str] = None
    outing_id: Optional[str] = None
    outing_title: Optional[str] = None
    storage_provider: str = "s3"
    gdrive_file_id: Optional[str] = None
    thumb_map_url: str
    thumb_web_url: str
    original_url: str
    people: list[PersonBrief] = []
    faces: list[FaceBrief] = []


class PersonResponse(BaseModel):
    id: str
    name: str
    is_named: bool
    photo_count: int
    avatar_url: Optional[str] = None


class PersonUpdateRequest(BaseModel):
    name: str


class PersonMergeRequest(BaseModel):
    source_person_id: str
    target_person_id: str


class AddPersonTagRequest(BaseModel):
    person_name: str


class BatchGeotagRequest(BaseModel):
    media_ids: list[str]
    latitude: float
    longitude: float
    location_name: Optional[str] = None


class BatchDeleteRequest(BaseModel):
    media_ids: list[str]


class BatchAssignTripRequest(BaseModel):
    media_ids: list[str]
    trip_id: Optional[str] = None
    new_trip_title: Optional[str] = None


class BatchAssignOutingRequest(BaseModel):
    media_ids: list[str]
    outing_id: Optional[str] = None
    new_outing_title: Optional[str] = None
    city: Optional[str] = None
    trip_id: Optional[str] = None


class OutingUpdateRequest(BaseModel):
    title: str
    city: Optional[str] = None


class OutingMergeRequest(BaseModel):
    source_outing_id: str
    target_outing_id: str


class OutingResponse(BaseModel):
    id: str
    trip_id: Optional[str] = None
    title: str
    city: Optional[str] = None
    start_date: datetime
    end_date: datetime
    center_lat: float
    center_lng: float
    cover_thumb_url: Optional[str] = None
    media_count: int
    is_manual: bool = False


class TripUpdateRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None


class TripMergeRequest(BaseModel):
    source_trip_id: str
    target_trip_id: str


class TripCreateByRangeRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class TripResponse(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    start_date: datetime
    end_date: datetime
    center_lat: float
    center_lng: float
    cover_thumb_url: Optional[str] = None
    media_count: int
    is_manual: bool = False
    visibility: str = "private"
    share_token: Optional[str] = None
    owner_id: Optional[str] = None
    user_role: Optional[str] = None


class TripShareRequest(BaseModel):
    visibility: str  # "private" | "shared"


class TripShareResponse(BaseModel):
    trip_id: str
    visibility: str
    share_token: Optional[str] = None
    invite_url: Optional[str] = None


class TripMemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    joined_at: datetime


class UserBriefResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False


class AuthMeResponse(BaseModel):
    authenticated: bool
    user: Optional[UserBriefResponse] = None


class TimelineBucket(BaseModel):
    key: str  # YYYY-MM or YYYY-MM-DD
    month: str  # YYYY-MM
    label: str
    sublabel: Optional[str] = None  # e.g., primary city or year
    count: int
    start_date: str
    end_date: str


class TimelineStatsResponse(BaseModel):
    min_date: Optional[datetime] = None
    max_date: Optional[datetime] = None
    total_count: int = 0
    geotagged_count: int = 0
    untagged_count: int = 0
    years: list[int] = []
    buckets: list[TimelineBucket] = []
    day_buckets: list[TimelineBucket] = []


class ScanStatusResponse(BaseModel):
    id: str
    status: str
    total_files: int
    processed_files: int
    imported_files: int
    skipped_files: int
    message: Optional[str] = None


class GoogleAccountResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime


class GoogleDriveFolderItem(BaseModel):
    id: str
    name: str
    mime_type: str = "application/vnd.google-apps.folder"


class GoogleDriveSyncRequest(BaseModel):
    account_id: str
    folder_id: str
    folder_name: Optional[str] = None
    trip_id: Optional[str] = None
    trip_name: Optional[str] = None
