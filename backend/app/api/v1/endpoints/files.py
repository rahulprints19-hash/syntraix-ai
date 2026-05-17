from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.core.config import get_settings
from app.db.session import get_db_session
from app.models import User
from app.schemas.file_system import (
    CreateDirectoryRequest,
    DeletePathResponse,
    FileContentResponse,
    FileNode,
    RenamePathRequest,
    WriteFileRequest,
)
from app.services.workspace import build_file_tree, detect_language, resolve_project_path

router = APIRouter(prefix="/projects/{project_id}/files", tags=["files"])
settings = get_settings()


def safe_project_path(project, path: str) -> Path:
    normalized = path.strip().replace("\\", "/")
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File path is required.")
    try:
        return resolve_project_path(project, normalized)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/tree", response_model=list[FileNode])
async def get_file_tree(
    project_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[FileNode]:
    project = await get_project_for_user(project_id, session, user)
    return build_file_tree(Path(project.root_path))


@router.get("/content", response_model=FileContentResponse)
async def get_file_content(
    project_id: str,
    path: str = Query(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileContentResponse:
    project = await get_project_for_user(project_id, session, user)
    target = safe_project_path(project, path)
    if not target.exists() or target.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File is not UTF-8 text.",
        ) from exc

    return FileContentResponse(path=path, content=content, language=detect_language(path))


@router.post("/write", response_model=FileContentResponse)
async def write_file_content(
    project_id: str,
    payload: WriteFileRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileContentResponse:
    project = await get_project_for_user(project_id, session, user)
    encoded_size = len(payload.content.encode("utf-8"))
    if encoded_size > settings.max_file_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large.")

    target = safe_project_path(project, payload.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(payload.content, encoding="utf-8")
    return FileContentResponse(path=payload.path, content=payload.content, language=detect_language(payload.path))


@router.post("/directories", response_model=list[FileNode], status_code=status.HTTP_201_CREATED)
async def create_directory(
    project_id: str,
    payload: CreateDirectoryRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[FileNode]:
    project = await get_project_for_user(project_id, session, user)
    target = safe_project_path(project, payload.path)
    if target.exists() and not target.is_dir():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A file already exists at this path.")
    target.mkdir(parents=True, exist_ok=True)
    return build_file_tree(Path(project.root_path))


@router.post("/rename", response_model=list[FileNode])
async def rename_path(
    project_id: str,
    payload: RenamePathRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[FileNode]:
    project = await get_project_for_user(project_id, session, user)
    source = safe_project_path(project, payload.source_path)
    target = safe_project_path(project, payload.target_path)
    if not source.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source path not found.")
    if target.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Target path already exists.")
    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)
    return build_file_tree(Path(project.root_path))


@router.delete("", response_model=DeletePathResponse)
async def delete_file(
    project_id: str,
    path: str = Query(...),
    recursive: bool = Query(default=False),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DeletePathResponse:
    project = await get_project_for_user(project_id, session, user)
    target = safe_project_path(project, path)
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path not found.")
    if target.is_dir():
        if not recursive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Set recursive=true to delete a directory.",
            )
        shutil.rmtree(target)
        return DeletePathResponse(status="deleted", path=path, type="directory")

    target.unlink()
    return DeletePathResponse(status="deleted", path=path, type="file")
