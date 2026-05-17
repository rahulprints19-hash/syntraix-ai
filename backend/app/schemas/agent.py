from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AgentRunRequest(BaseModel):
    project_id: str
    objective: str = Field(min_length=1, max_length=4000)
    model: str | None = Field(default=None, max_length=80)
    execute: bool = False

    @field_validator("objective")
    @classmethod
    def strip_objective(cls, value: str) -> str:
        return value.strip()

    @field_validator("model")
    @classmethod
    def strip_model(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class AgentStep(BaseModel):
    agent: str
    task: str
    status: str


class AgentRunResponse(BaseModel):
    id: str
    project_id: str
    objective: str
    model: str
    status: str
    created_at: datetime
    updated_at: datetime
    plan: list[AgentStep]
    summary: str
