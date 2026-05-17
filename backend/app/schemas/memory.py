from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class MemoryStoreRequest(BaseModel):
    project_id: str | None = None
    kind: str = Field(default="note", min_length=1, max_length=64)
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("kind", "content")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class MemoryResponse(BaseModel):
    id: str
    kind: str
    content: str
    created_at: datetime
    score: float | None = None
