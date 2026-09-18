from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AIResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module: str
    output_json: dict | None
    confidence: float | None
    heatmap_path: str | None
    model_version: str
    processed_at: datetime
    duration_ms: int | None
    error: str | None


class StudyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    type: str
    source: str
    uploaded_at: datetime
    ai_results: list[AIResultOut] = []
