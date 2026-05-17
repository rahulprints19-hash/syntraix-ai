from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)
    template: str = "starter-web"

    @field_validator("name", "description")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    root_path: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, project) -> "ProjectResponse":
        return cls(
            id=project.id,
            name=project.name,
            slug=project.slug,
            description=project.description,
            root_path=project.root_path,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
