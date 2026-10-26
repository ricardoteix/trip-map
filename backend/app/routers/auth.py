import hmac
import json
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Trip, TripMember, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

AUTH_SCOPES = [
    "openid",
    "email",
    "profile",
]

SECRET_KEY = settings.google_client_secret or "tripmap_session_fallback_secret_key"


def get_current_user_optional(
    session_user_id: Optional[str] = Cookie(None, alias="tripmap_user_id"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the currently logged-in user, or None if guest."""
    if not session_user_id:
        return None
    user = db.query(User).filter(User.id == session_user_id).first()
    return user


def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Requires an authenticated user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    return current_user


def get_accessible_trip_ids(db: Session, user: Optional[User]) -> Optional[list[str]]:
    """
    Returns a list of trip IDs that the user can access.
    Returns None if the user has unrestricted access (e.g. is admin).
    """
    if user and user.is_admin:
        return None  # Unrestricted access

    if user:
        member_trips = db.query(TripMember.trip_id).filter(TripMember.user_id == user.id).all()
        member_ids = [m[0] for m in member_trips]
        owned_trips = db.query(Trip.id).filter(Trip.owner_id == user.id).all()
        owned_ids = [t[0] for t in owned_trips]
        unowned_trips = db.query(Trip.id).filter(Trip.owner_id.is_(None)).all()
        unowned_ids = [t[0] for t in unowned_trips]
        shared_trips = db.query(Trip.id).filter(Trip.visibility.in_(["shared", "public"])).all()
        shared_ids = [t[0] for t in shared_trips]
        return list(set(member_ids + owned_ids + unowned_ids + shared_ids))

    # Guest user (not logged in): can strictly only see trips marked as shared or public
    shared_trips = db.query(Trip.id).filter(Trip.visibility.in_(["shared", "public"])).all()
    return [t[0] for t in shared_trips]


@router.get("/google/login-url")
def get_login_url(join_token: Optional[str] = Query(None)):
    """Generates the Google OAuth login URL."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=400,
            detail="GOOGLE_CLIENT_ID não configurado no .env.",
        )

    # Use state to carry join_token across the OAuth redirect if present
    state_payload = {"join_token": join_token} if join_token else {}
    state_encoded = urllib.parse.quote(json.dumps(state_payload))

    # The redirect URI goes to our frontend proxy /api/auth/google/callback
    redirect_uri = settings.google_redirect_uri
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(AUTH_SCOPES),
        "access_type": "offline",
        "prompt": "select_account",
        "state": state_encoded,
    }
    qs = urllib.parse.urlencode(params)
    return {"url": f"{GOOGLE_AUTH_URL}?{qs}"}


@router.get("/google/callback")
async def google_login_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Processes Google OAuth callback, logs the user in, and assigns legacy trips if first user."""
    if state == "gdrive":
        from app.routers.gdrive import exchange_code_and_save_account
        return await exchange_code_and_save_account(code, db)
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
            raise HTTPException(status_code=400, detail=f"Erro ao autenticar com Google: {token_res.text}")

        token_data = token_res.json()
        access_token = token_data.get("access_token")

        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Erro ao obter perfil do Google.")

        userinfo = userinfo_res.json()
        email = userinfo.get("email")
        name = userinfo.get("name") or email.split("@")[0]
        picture = userinfo.get("picture")

        if not email:
            raise HTTPException(status_code=400, detail="E-mail não fornecido pelo Google.")

        total_users_before = db.query(User).count()
        user = db.query(User).filter(User.email == email).first()
        is_first_user = total_users_before == 0

        if not user:
            user = User(
                id=str(uuid4()),
                email=email,
                name=name,
                picture=picture,
                is_admin=is_first_user,
            )
            db.add(user)
            db.flush()
        else:
            user.name = name
            user.picture = picture
            if is_first_user:
                user.is_admin = True

        # If this is the first user (Admin), associate all existing legacy trips to them
        if is_first_user or user.is_admin:
            unowned_trips = db.query(Trip).filter(Trip.owner_id.is_(None)).all()
            for t in unowned_trips:
                t.owner_id = user.id
                # Make sure owner is registered in TripMember
                existing_member = db.query(TripMember).filter(
                    TripMember.trip_id == t.id, TripMember.user_id == user.id
                ).first()
                if not existing_member:
                    db.add(TripMember(trip_id=t.id, user_id=user.id, role="owner"))

        # Process join_token from state if user arrived via an invite link
        redirect_target = "/"
        if state:
            try:
                state_data = json.loads(urllib.parse.unquote(state))
                join_token = state_data.get("join_token")
                if join_token:
                    trip = db.query(Trip).filter(Trip.share_token == join_token).first()
                    if trip:
                        existing_mem = db.query(TripMember).filter(
                            TripMember.trip_id == trip.id, TripMember.user_id == user.id
                        ).first()
                        if not existing_mem:
                            db.add(TripMember(trip_id=trip.id, user_id=user.id, role="contributor"))
                        redirect_target = f"/?joined_trip={trip.id}"
            except Exception:
                pass

        db.commit()

        # Set session cookie
        response = RedirectResponse(url=redirect_target, status_code=302)
        response.set_cookie(
            key="tripmap_user_id",
            value=user.id,
            max_age=30 * 24 * 3600,  # 30 days
            httponly=True,
            samesite="lax",
        )
        return response


@router.get("/me")
def get_current_user_profile(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Returns current user details, or None if guest."""
    if not current_user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "picture": current_user.picture,
            "is_admin": current_user.is_admin,
        },
    }


@router.post("/logout")
def logout():
    """Clears the session cookie."""
    response = Response(content=json.dumps({"status": "logged_out"}), media_type="application/json")
    response.delete_cookie(key="tripmap_user_id")
    return response
