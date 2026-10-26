import io
import mimetypes
import tempfile
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import (
    DeletedMediaHash,
    GoogleAccount,
    MediaItem,
    ScanJob,
)
from app.routers.media import apply_curation_to_media_item
from app.schemas import (
    GoogleAccountResponse,
    GoogleDriveFolderItem,
    GoogleDriveSyncRequest,
    ScanStatusResponse,
)
from app.services.face_service import face_service
from app.services.media_processor import (
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
from app.services.trip_service import rebuild_trips

router = APIRouter(prefix="/api/gdrive", tags=["gdrive"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"

GDRIVE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
]


async def _get_valid_access_token(account: GoogleAccount, db: Session) -> str:
    """Refreshes the access token if needed and returns a valid one."""
    now = datetime.now(timezone.utc)
    if account.token_expiry and account.token_expiry > now:
        return account.access_token

    if not account.refresh_token:
        return account.access_token

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": account.refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if res.status_code == 200:
            token_data = res.json()
            account.access_token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 3600)
            account.token_expiry = datetime.fromtimestamp(
                now.timestamp() + expires_in, tz=timezone.utc
            )
            db.commit()
            return account.access_token

    return account.access_token


@router.get("/auth-url")
def get_google_auth_url():
    """Generates the OAuth consent URL for connecting a Google Drive account."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=400,
            detail="GOOGLE_CLIENT_ID não configurado no .env do servidor.",
        )

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(GDRIVE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": "gdrive",
    }
    qs = urllib.parse.urlencode(params)
    return {"url": f"{GOOGLE_AUTH_URL}?{qs}"}


async def exchange_code_and_save_account(code: str, db: Session) -> RedirectResponse:
    """Exchanges authorization code for tokens and upserts the GoogleAccount."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao obter token do Google: {token_res.text}",
            )

        token_data = token_res.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Erro ao obter informações do usuário Google.",
            )

        userinfo = userinfo_res.json()
        email = userinfo.get("email")
        name = userinfo.get("name")
        picture = userinfo.get("picture")

        if not email:
            raise HTTPException(status_code=400, detail="E-mail da conta Google não encontrado.")

        account = db.query(GoogleAccount).filter(GoogleAccount.email == email).first()
        expiry_dt = datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + expires_in, tz=timezone.utc
        )

        if not account:
            account = GoogleAccount(
                id=str(uuid4()),
                email=email,
                name=name,
                picture=picture,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=expiry_dt,
            )
            db.add(account)
        else:
            account.name = name or account.name
            account.picture = picture or account.picture
            account.access_token = access_token
            if refresh_token:
                account.refresh_token = refresh_token
            account.token_expiry = expiry_dt

        db.commit()

    return RedirectResponse(url="/?gdrive_connected=true")


@router.get("/callback")
async def handle_google_oauth_callback(
    code: str = Query(..., description="Authorization code from Google"),
    db: Session = Depends(get_db),
):
    return await exchange_code_and_save_account(code, db)


@router.get("/accounts", response_model=list[GoogleAccountResponse])
def list_connected_accounts(db: Session = Depends(get_db)):
    """Lists all connected Google Drive accounts."""
    accounts = db.query(GoogleAccount).order_by(GoogleAccount.created_at.desc()).all()
    return accounts


@router.delete("/accounts/{account_id}")
def disconnect_google_account(account_id: str, db: Session = Depends(get_db)):
    """Disconnects a Google account."""
    acc = db.query(GoogleAccount).filter(GoogleAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    db.delete(acc)
    db.commit()
    return {"status": "ok", "message": f"Conta {acc.email} desconectada."}


@router.get("/folders", response_model=list[GoogleDriveFolderItem])
async def list_drive_folders(
    account_id: str = Query(...),
    parent_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists folders from the user's Google Drive."""
    acc = db.query(GoogleAccount).filter(GoogleAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    token = await _get_valid_access_token(acc, db)

    query_parts = [
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
    ]
    if parent_id and parent_id != "root":
        query_parts.append(f"'{parent_id}' in parents")
    else:
        query_parts.append(
            "('root' in parents or sharedWithMe = true)"
        )

    q = " and ".join(query_parts)
    params = {
        "q": q,
        "fields": "files(id, name, mimeType)",
        "pageSize": 100,
        "orderBy": "name",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{GOOGLE_DRIVE_API_BASE}/files",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        if res.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao listar pastas do Google Drive: {res.text}",
            )
        files = res.json().get("files", [])
        return [
            GoogleDriveFolderItem(id=f["id"], name=f["name"], mime_type=f["mimeType"])
            for f in files
        ]


def _run_gdrive_folder_sync(
    job_id: str,
    account_id: str,
    folder_id: str,
    trip_id: Optional[str] = None,
    trip_name: Optional[str] = None,
):
    """Background task that downloads images into memory, creates WebP thumbnails, and keeps originals on Drive."""
    import time
    db = SessionLocal()
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        db.close()
        return

    def get_fresh_token(force: bool = False) -> str:
        acc_local = db.query(GoogleAccount).filter(GoogleAccount.id == account_id).first()
        if not acc_local:
            return ""
        now = datetime.now(timezone.utc)
        needs_refresh = (
            force
            or not acc_local.token_expiry
            or (acc_local.token_expiry - now).total_seconds() < 300
        )
        if needs_refresh and acc_local.refresh_token:
            try:
                with httpx.Client(timeout=20.0) as ref_client:
                    ref_res = ref_client.post(
                        GOOGLE_TOKEN_URL,
                        data={
                            "client_id": settings.google_client_id,
                            "client_secret": settings.google_client_secret,
                            "refresh_token": acc_local.refresh_token,
                            "grant_type": "refresh_token",
                        },
                    )
                    if ref_res.status_code == 200:
                        t_data = ref_res.json()
                        acc_local.access_token = t_data["access_token"]
                        exp_in = t_data.get("expires_in", 3600)
                        acc_local.token_expiry = datetime.fromtimestamp(
                            now.timestamp() + exp_in, tz=timezone.utc
                        )
                        db.commit()
            except Exception as ref_err:
                print(f"[GDrive Sync] Erro ao renovar token: {ref_err}")
        return acc_local.access_token

    try:
        acc = db.query(GoogleAccount).filter(GoogleAccount.id == account_id).first()
        if not acc:
            job.status = "failed"
            job.message = "Conta Google não encontrada."
            db.commit()
            return

        token = get_fresh_token()

        # Recursively discover all subfolders inside the selected folder
        job.message = "Mapeando pastas e subpastas no Google Drive..."
        db.commit()

        folders_to_check = [folder_id]
        all_folder_ids = [folder_id]

        with httpx.Client(timeout=30.0) as client:
            while folders_to_check:
                current_parent_id = folders_to_check.pop(0)
                sub_token = None
                while True:
                    sub_params = {
                        "q": f"'{current_parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                        "fields": "nextPageToken, files(id, name)",
                        "pageSize": 100,
                    }
                    if sub_token:
                        sub_params["pageToken"] = sub_token
                    res_sub = client.get(
                        f"{GOOGLE_DRIVE_API_BASE}/files",
                        headers={"Authorization": f"Bearer {token}"},
                        params=sub_params,
                    )
                    if res_sub.status_code == 401:
                        token = get_fresh_token(force=True)
                        continue
                    if res_sub.status_code != 200:
                        break
                    sub_data = res_sub.json()
                    for sf in sub_data.get("files", []):
                        sf_id = sf["id"]
                        if sf_id not in all_folder_ids:
                            all_folder_ids.append(sf_id)
                            folders_to_check.append(sf_id)
                    sub_token = sub_data.get("nextPageToken")
                    if not sub_token:
                        break

            job.message = f"Pastas mapeadas ({len(all_folder_ids)} pastas). Buscando fotos e vídeos..."
            db.commit()

            # Query files across all discovered folders
            all_drive_files = []
            for fid in all_folder_ids:
                page_token = None
                while True:
                    file_params = {
                        "q": f"'{fid}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'",
                        "fields": "nextPageToken, files(id, name, mimeType, size, createdTime, md5Checksum)",
                        "pageSize": 500,
                    }
                    if page_token:
                        file_params["pageToken"] = page_token
                    res = client.get(
                        f"{GOOGLE_DRIVE_API_BASE}/files",
                        headers={"Authorization": f"Bearer {token}"},
                        params=file_params,
                    )
                    if res.status_code == 401:
                        token = get_fresh_token(force=True)
                        continue
                    if res.status_code != 200:
                        break
                    data = res.json()
                    all_drive_files.extend(data.get("files", []))
                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break

        job.total_files = len(all_drive_files)
        job.message = f"Processando {len(all_drive_files)} arquivos do Google Drive..."
        db.commit()

        imported = 0
        skipped = 0

        # Resolve or create Trip if trip_name given
        from app.routers.media import _resolve_or_create_manual_trip
        target_trip = _resolve_or_create_manual_trip(db, trip_id=trip_id, trip_name=trip_name)

        from app.models import User
        uploader_user = db.query(User).filter(User.email == acc.email).first()
        uploader_id = uploader_user.id if uploader_user else None

        with httpx.Client(timeout=90.0) as client:
            for idx, df in enumerate(all_drive_files):
                try:
                    fname = df["name"]
                    ext = Path(fname).suffix.lower()
                    if ext not in SUPPORTED_EXTENSIONS:
                        skipped += 1
                        job.processed_files = idx + 1
                        job.skipped_files = skipped
                        continue

                    file_id = df["id"]

                    # Download with retries, exponential backoff, and automatic token refresh
                    raw_bytes = None
                    for attempt in range(4):
                        cur_token = get_fresh_token()
                        download_url = (
                            f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}"
                            f"?alt=media&acknowledgeAbuse=true&supportsAllDrives=true"
                        )
                        down_res = client.get(
                            download_url,
                            headers={"Authorization": f"Bearer {cur_token}"},
                        )
                        if down_res.status_code == 200:
                            raw_bytes = down_res.content
                            break
                        elif down_res.status_code == 401:
                            # Token expired - force immediate refresh
                            get_fresh_token(force=True)
                            time.sleep(1)
                        elif down_res.status_code in [403, 429, 500, 503]:
                            # Rate limit or temporary service issue - backoff
                            sleep_sec = 2 * (attempt + 1)
                            print(
                                f"[GDrive Sync] Rate limit/HTTP {down_res.status_code} em {fname}. "
                                f"Aguardando {sleep_sec}s (tentativa {attempt + 1}/4)..."
                            )
                            time.sleep(sleep_sec)
                        else:
                            print(
                                f"[GDrive Sync] Erro HTTP {down_res.status_code} ao baixar {fname} ({file_id}): {down_res.text[:120]}"
                            )
                            break

                    if not raw_bytes:
                        skipped += 1
                        job.processed_files = idx + 1
                        job.skipped_files = skipped
                        continue

                    sha = compute_sha256(raw_bytes)

                    # Check if deleted
                    was_deleted = db.query(DeletedMediaHash).filter(DeletedMediaHash.sha256 == sha).first()
                    if was_deleted:
                        skipped += 1
                        job.processed_files = idx + 1
                        job.skipped_files = skipped
                        continue

                    # Check existing
                    existing = db.query(MediaItem).filter(MediaItem.sha256 == sha).first()
                    if existing:
                        skipped += 1
                        job.processed_files = idx + 1
                        job.skipped_files = skipped
                        continue

                    media_id = str(uuid4())
                    is_video = ext in VIDEO_EXTENSIONS
                    media_type = "video" if is_video else "image"
                    mime_type = df.get("mimeType") or mimetypes.guess_type(fname)[0] or "image/jpeg"

                    map_key = f"{media_id}_map.webp"
                    web_key = f"{media_id}_web.webp"
                    orig_key = f"gdrive_{file_id}"  # Virtual S3 key referencing Google Drive

                    pil_img = None
                    if is_video:
                        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                            tmp.write(raw_bytes)
                            tmp_path = Path(tmp.name)
                        try:
                            meta = extract_video_metadata(tmp_path)
                            map_bytes, web_bytes = generate_video_thumbnails(tmp_path)
                        finally:
                            tmp_path.unlink(missing_ok=True)
                    else:
                        meta = extract_image_metadata(raw_bytes)
                        map_bytes, web_bytes, pil_img = generate_image_thumbnails(raw_bytes)

                    # Save ONLY thumbnails locally/S3 - ORIGINALS REMAIN ON GOOGLE DRIVE!
                    storage_service.put_bytes("thumbnails-map", map_key, map_bytes, "image/webp")
                    storage_service.put_bytes("thumbnails-web", web_key, web_bytes, "image/webp")

                    city, country, loc_name = resolve_city_country(meta.get("latitude"), meta.get("longitude"))

                    media = MediaItem(
                        id=media_id,
                        sha256=sha,
                        filename=fname,
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
                        storage_provider="gdrive",
                        gdrive_file_id=file_id,
                        gdrive_account_id=account_id,
                        trip_id=target_trip.id if target_trip else None,
                        is_manual_trip=bool(target_trip),
                        uploaded_by_user_id=uploader_id,
                    )
                    db.add(media)
                    db.flush()

                    from app.models import MediaCurationCache
                    cached = db.query(MediaCurationCache).filter(MediaCurationCache.sha256 == sha).first()
                    if cached is not None:
                        apply_curation_to_media_item(db, media, cached, pil_img=pil_img)
                    elif pil_img is not None:
                        face_service.detect_and_cluster_faces(db, media, pil_img)

                    imported += 1
                    job.processed_files = idx + 1
                    job.imported_files = imported
                    if (idx + 1) % 10 == 0:
                        db.commit()
                except Exception as file_exc:
                    print(f"[GDrive Sync] Erro no processamento de {df.get('name')}: {file_exc}")
                    skipped += 1
                    job.processed_files = idx + 1
                    job.skipped_files = skipped
                    db.commit()

        rebuild_trips(db)
        job.status = "completed"
        job.message = f"Concluído: {imported} importados do Google Drive, {skipped} pulados."
        db.commit()

    except Exception as exc:
        job.status = "failed"
        job.message = f"Erro ao sincronizar do Google Drive: {exc}"
        db.commit()
    finally:
        db.close()


@router.post("/sync-folder", response_model=ScanStatusResponse)
def sync_google_drive_folder(
    payload: GoogleDriveSyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Starts background ingestion of photos from a Google Drive folder without storing heavy originals."""
    acc = db.query(GoogleAccount).filter(GoogleAccount.id == payload.account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta Google não encontrada.")

    job = ScanJob(
        id=str(uuid4()),
        status="running",
        total_files=0,
        processed_files=0,
        imported_files=0,
        skipped_files=0,
        message=f"Acessando pasta do Google Drive...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        _run_gdrive_folder_sync,
        job.id,
        payload.account_id,
        payload.folder_id,
        payload.trip_id,
        payload.trip_name,
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


@router.get("/stream/{media_id}")
async def stream_gdrive_original(media_id: str, db: Session = Depends(get_db)):
    """Proxies the original file stream from Google Drive on-demand so originals don't need local storage."""
    media = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not media or not media.gdrive_file_id:
        raise HTTPException(status_code=404, detail="Mídia do Google Drive não encontrada.")

    acc = None
    if media.gdrive_account_id:
        acc = db.query(GoogleAccount).filter(GoogleAccount.id == media.gdrive_account_id).first()
    if not acc:
        acc = db.query(GoogleAccount).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta Google não conectada.")

    token = await _get_valid_access_token(acc, db)

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.get(
            f"{GOOGLE_DRIVE_API_BASE}/files/{media.gdrive_file_id}?alt=media",
            headers={"Authorization": f"Bearer {token}"},
        )
        if res.status_code != 200:
            raise HTTPException(
                status_code=res.status_code,
                detail="Erro ao carregar arquivo original do Google Drive.",
            )

        return Response(
            content=res.content,
            media_type=media.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{media.filename}"',
                "Cache-Control": "public, max-age=86400",
            },
        )
