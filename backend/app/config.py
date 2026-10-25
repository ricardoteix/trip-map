from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./tripmap_local.db"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "rustfsadmin"
    s3_secret_key: str = "rustfsadmin_secret"
    s3_region: str = "us-east-1"
    local_storage_fallback_dir: str = "./storage_data"
    import_dir: str = "/import"
    model_cache_dir: str = "./model_cache"
    trip_max_hours_gap: float = 36.0
    trip_max_distance_km: float = 85.0
    face_similarity_threshold: float = 0.48
    seed_demo_on_startup: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
