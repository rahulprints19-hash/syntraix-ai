from pydantic import BaseModel, Field, field_validator


class FileNode(BaseModel):
    name: str
    path: str
    type: str
    children: list["FileNode"] = Field(default_factory=list)


class FileContentResponse(BaseModel):
    path: str
    content: str
    language: str


class WriteFileRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    content: str

    @field_validator("path")
    @classmethod
    def normalize_path(cls, value: str) -> str:
        normalized = value.strip().replace("\\", "/")
        if not normalized or normalized.endswith("/"):
            raise ValueError("File path must point to a file.")
        return normalized


class CreateDirectoryRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)

    @field_validator("path")
    @classmethod
    def normalize_path(cls, value: str) -> str:
        normalized = value.strip().replace("\\", "/").strip("/")
        if not normalized:
            raise ValueError("Directory path is required.")
        return normalized


class RenamePathRequest(BaseModel):
    source_path: str = Field(min_length=1, max_length=500)
    target_path: str = Field(min_length=1, max_length=500)

    @field_validator("source_path", "target_path")
    @classmethod
    def normalize_path(cls, value: str) -> str:
        normalized = value.strip().replace("\\", "/").strip("/")
        if not normalized:
            raise ValueError("Path is required.")
        return normalized


class DeletePathResponse(BaseModel):
    status: str
    path: str
    type: str


class DeleteFileRequest(BaseModel):
    path: str


FileNode.model_rebuild()
