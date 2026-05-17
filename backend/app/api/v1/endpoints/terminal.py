from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.core.config import get_settings
from app.db.session import get_db_session
from app.models import User
from app.schemas.terminal import CommandRequest, CommandResponse
from app.services.terminal import run_command

router = APIRouter(prefix="/projects/{project_id}/terminal", tags=["terminal"])
settings = get_settings()


@router.post("/execute", response_model=CommandResponse)
async def execute_command(
    project_id: str,
    payload: CommandRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CommandResponse:
    project = await get_project_for_user(project_id, session, user)
    try:
        result = await run_command(
            command=payload.command,
            cwd=Path(project.root_path),
            timeout_seconds=payload.timeout_seconds or settings.terminal_default_timeout_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return CommandResponse(**result)
