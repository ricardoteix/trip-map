import logging
from pathlib import Path
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger(__name__)

BUCKETS = [
    "originals",
    "thumbnails-map",
    "thumbnails-web",
    "face-crops",
]


class StorageService:
    """
    S3-compatible object storage service designed for RustFS / Garage / MinIO.
    Automatically falls back to a local directory if the S3 service is unreachable
    (e.g. during standalone unit tests outside Docker).
    """

    def __init__(self) -> None:
        self._s3_client = None
        self._use_local_fallback = False
        self._local_root = Path(settings.local_storage_fallback_dir)

    def init_storage(self) -> None:
        try:
            client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )
            existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
            for bucket in BUCKETS:
                if bucket not in existing:
                    client.create_bucket(Bucket=bucket)
            self._s3_client = client
            self._use_local_fallback = False
            logger.info("Connected to S3 storage at %s", settings.s3_endpoint_url)
        except Exception as exc:
            logger.warning(
                "S3 storage (%s) unavailable (%s). Using local filesystem fallback at %s",
                settings.s3_endpoint_url,
                exc,
                self._local_root,
            )
            self._use_local_fallback = True
            for bucket in BUCKETS:
                (self._local_root / bucket).mkdir(parents=True, exist_ok=True)

    def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        if self._s3_client is None and not self._use_local_fallback:
            self.init_storage()

        if not self._use_local_fallback and self._s3_client is not None:
            try:
                self._s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
                return f"{bucket}/{key}"
            except (BotoCoreError, ClientError) as exc:
                logger.warning("S3 put_object failed, falling back to local disk: %s", exc)
                self._use_local_fallback = True

        target = self._local_root / bucket / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return f"{bucket}/{key}"

    def get_bytes(self, bucket: str, key: str) -> Optional[bytes]:
        if self._s3_client is None and not self._use_local_fallback:
            self.init_storage()

        if not self._use_local_fallback and self._s3_client is not None:
            try:
                response = self._s3_client.get_object(Bucket=bucket, Key=key)
                return response["Body"].read()
            except (BotoCoreError, ClientError):
                pass

        target = self._local_root / bucket / key
        if target.exists():
            return target.read_bytes()
        return None

    def delete_object(self, bucket: str, key: str) -> None:
        if not key:
            return
        if self._s3_client is None and not self._use_local_fallback:
            self.init_storage()

        if not self._use_local_fallback and self._s3_client is not None:
            try:
                self._s3_client.delete_object(Bucket=bucket, Key=key)
            except (BotoCoreError, ClientError) as exc:
                logger.debug("S3 delete_object warning (%s/%s): %s", bucket, key, exc)

        target = self._local_root / bucket / key
        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass


storage_service = StorageService()
