from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.core.config import get_settings
from app.db.session import get_db_session
from app.models import User
from app.schemas.changes import ApplyChangesRequest, ApplyChangesResponse, ProposeChangesRequest, ProposeChangesResponse
from app.services.ai import resolve_model_id
from app.services.changes import apply_file_changes, propose_file_changes
from app.services.saas import record_usage_event

router = APIRouter(prefix="/projects/{project_id}/changes", tags=["changes"])
settings = get_settings()


@router.post("/propose", response_model=ProposeChangesResponse)
async def propose_changes(
    project_id: str,
    payload: ProposeChangesRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProposeChangesResponse:
    project = await get_project_for_user(project_id, session, user)
    try:
        model_id = resolve_model_id(payload.model)
        changes = propose_file_changes(project, payload.objective, payload.paths, model_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await record_usage_event(
        session,
        user=user,
        project_id=project.id,
        feature="changes",
        model=model_id,
        prompt_text=payload.objective,
        completion_text="\n".join(change.proposed_content for change in changes),
        status="success",
    )
    await session.commit()

    return ProposeChangesResponse(
        objective=payload.objective,
        model=model_id if settings.openai_api_key else "local-fallback",
        changes=changes,
    )


@router.post("/apply", response_model=ApplyChangesResponse)
async def apply_changes(
    project_id: str,
    payload: ApplyChangesRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApplyChangesResponse:
    project = await get_project_for_user(project_id, session, user)
    try:
        applied_paths = apply_file_changes(project, payload.changes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return ApplyChangesResponse(applied_paths=applied_paths)
