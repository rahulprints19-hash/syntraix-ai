from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.db.session import get_db_session
from app.models import User
from app.schemas.deploy import DeployExportRequest, DeployExportResponse
from app.services.deploy import export_deployment_files

router = APIRouter(prefix="/deploy", tags=["deploy"])


@router.get("/targets")
async def list_deploy_targets() -> dict[str, list[str]]:
    return {"targets": ["docker", "render", "vercel"]}


@router.post("/export", response_model=DeployExportResponse)
async def export_deploy_assets(
    payload: DeployExportRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DeployExportResponse:
    project = await get_project_for_user(payload.project_id, session, user)
    files = export_deployment_files(project, payload.targets)
    return DeployExportResponse(targets=payload.targets, files=files)
