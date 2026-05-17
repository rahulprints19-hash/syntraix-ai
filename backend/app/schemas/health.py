from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ServiceCheck(BaseModel):
    status: str
    detail: str


class HealthResponse(BaseModel):
    status: str = Field(pattern="^(ok|degraded)$")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    services: dict[str, ServiceCheck]
