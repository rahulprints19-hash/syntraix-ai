from pydantic import BaseModel, Field, field_validator


class ProposeChangesRequest(BaseModel):
    objective: str = Field(min_length=1, max_length=4000)
    paths: list[str] = Field(default_factory=list, max_length=8)
    model: str | None = Field(default=None, max_length=80)

    @field_validator("objective")
    @classmethod
    def strip_objective(cls, value: str) -> str:
        return value.strip()

    @field_validator("paths")
    @classmethod
    def normalize_paths(cls, value: list[str]) -> list[str]:
        return [item.strip().replace("\\", "/").strip("/") for item in value if item.strip()]

    @field_validator("model")
    @classmethod
    def strip_model(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class FileChange(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    action: str = Field(pattern="^(create|update)$")
    summary: str = Field(default="", max_length=500)
    original_content: str | None = None
    proposed_content: str

    @field_validator("path")
    @classmethod
    def normalize_path(cls, value: str) -> str:
        normalized = value.strip().replace("\\", "/").strip("/")
        if not normalized:
            raise ValueError("Path is required.")
        return normalized


class ProposeChangesResponse(BaseModel):
    objective: str
    model: str
    changes: list[FileChange]


class ApplyChangesRequest(BaseModel):
    changes: list[FileChange] = Field(min_length=1, max_length=20)


class ApplyChangesResponse(BaseModel):
    applied_paths: list[str]
