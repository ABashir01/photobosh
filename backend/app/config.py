from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_base_url: str
    turn_public_host: str
    turn_port: int = 3478
    turn_tls_port: int = 5349
    turn_username: str
    turn_password: str
    turn_min_port: int = 49160
    turn_max_port: int = 49200
    room_ttl_hours: int = 24
    asset_retention_hours: int = 24
    max_room_participants: int = 2
    upload_max_mb: int = 12
    background_asset_dir: Path
    template_asset_dir: Path
    generated_asset_dir: Path
    room_countdown_seconds: int = 3
    shot_interval_seconds: int = 4
    cleanup_interval_seconds: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("background_asset_dir", "template_asset_dir", "generated_asset_dir", mode="before")
    @classmethod
    def _coerce_path(cls, value: str | Path) -> Path:
        return Path(value)

    @field_validator("max_room_participants")
    @classmethod
    def _validate_participants(cls, value: int) -> int:
        if value != 2:
            raise ValueError("This MVP only supports exactly 2 participants.")
        return value

