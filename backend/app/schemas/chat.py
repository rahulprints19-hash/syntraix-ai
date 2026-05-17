from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ChatThreadResponse(BaseModel):
    id: str
    title: str
    project_id: str | None
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class ChatMessageRequest(BaseModel):
    project_id: str | None = None
    thread_id: str | None = None
    message: str = Field(min_length=1, max_length=8000)
    model: str | None = Field(default=None, max_length=80)
    use_tools: bool = False

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()

    @field_validator("model")
    @classmethod
    def strip_model(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class ChatBootstrapResponse(BaseModel):
    threads: list[ChatThreadResponse]
    messages: list[ChatMessageResponse]


class ChatThreadUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        return value.strip()
