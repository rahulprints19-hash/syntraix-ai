from pydantic import BaseModel, Field


class CommandRequest(BaseModel):
    command: str
    timeout_seconds: int = Field(default=20, ge=1, le=120)


class CommandResponse(BaseModel):
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
