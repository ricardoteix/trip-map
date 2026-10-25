from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import MediaItem
from app.routers import backup, media, people, trips
from app.services.storage import storage_service
from app.services.trip_service import seed_demo_data


def _run_schema_migrations() -> None:
    """Safely adds newly introduced columns on existing databases."""
    statements = [
        "ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE",
        "ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_manual_trip BOOLEAN DEFAULT FALSE",
        "ALTER TABLE media_items ADD COLUMN IF NOT EXISTS outing_id VARCHAR(36)",
        "ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_manual_outing BOOLEAN DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_schema_migrations()
    storage_service.init_storage()
    if settings.seed_demo_on_startup:
        db = SessionLocal()
        try:
            if db.query(MediaItem).count() == 0:
                seed_demo_data(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="TripMap API",
    description="API de organização geográfica, linha do tempo e reconhecimento de pessoas em viagens",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(media.router)
app.include_router(people.router)
app.include_router(trips.router)
app.include_router(backup.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "tripmap-backend"}
