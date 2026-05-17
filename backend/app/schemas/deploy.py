from pydantic import BaseModel, Field


class DeployExportRequest(BaseModel):
    project_id: str
    targets: list[str] = Field(default_factory=lambda: ["docker", "render", "vercel"])


class DeployFile(BaseModel):
    path: str
    content: str


class DeployExportResponse(BaseModel):
    targets: list[str]
    files: list[DeployFile]
