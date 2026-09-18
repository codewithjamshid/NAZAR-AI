"""Application settings, loaded from environment / repo-root .env."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> repo root is two levels above the package dir
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://nazar:nazar@localhost:5432/nazar"
    redis_url: str = "redis://localhost:6379/0"
    storage_path: Path = Path("storage")
    rules_path: Path = Path("rules/triage.yaml")
    demo_data_path: Path = Path("demo-data")
    jwt_secret: str = "change-me"
    jwt_expire_hours: int = 12
    cors_origins: str = "*"   # comma-separated, or * for local development

    llm_provider: str = "anthropic"
    llm_api_key: str = ""
    llm_model: str = ""   # empty -> provider default (see services/report.py DEFAULT_MODELS)

    medgemma_url: str = "http://localhost:8001"
    medgemma_api_key: str = ""        # sent as X-API-Key to the GPU box, if set
    medgemma_model: str = "google/medgemma-1.5-4b-it"
    medgemma_stub: bool = True
    medgemma_ct_slices: int = 16      # slices sent to MedGemma (TZ §15 R4: 16-24)
    ct_viewer_max_slices: int = 200   # PNG slices kept for the panel viewer
    hf_token: str = ""

    ich_weights_path: Path | None = None

    # Speech to text (TZ §7 M2). "gemini": cloud, strong on Uzbek, needs a key and
    # sends the audio to Google. "whisper": local faster-whisper, nothing leaves.
    stt_provider: str = "gemini"
    stt_model: str = "gemini-3.1-flash-lite,gemini-3.5-flash"   # tried in order
    stt_api_key: str = ""           # empty -> LLM_API_KEY
    whisper_model: str = "small"    # faster-whisper size for the local provider
    stt_language: str = "uz"

    @field_validator("storage_path", "rules_path", "demo_data_path", mode="after")
    @classmethod
    def _absolute(cls, value: Path) -> Path:
        # Relative paths are relative to the repo root, not the process cwd.
        return value if value.is_absolute() else REPO_ROOT / value

    @field_validator("ich_weights_path", mode="before")
    @classmethod
    def _empty_is_none(cls, value):
        return None if value in ("", None) else value


settings = Settings()
