from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.db.session import get_db_session
from app.models import User
from app.schemas.preview import PreviewResponse
from app.services.workspace import inline_preview_html

router = APIRouter(prefix="/projects/{project_id}/preview", tags=["preview"])


@router.get("", response_model=PreviewResponse)
async def get_preview(
    project_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PreviewResponse:
    project = await get_project_for_user(project_id, session, user)
    html, entry_path = inline_preview_html(project)
    return PreviewResponse(entry_path=entry_path, html=html, status="ready")
