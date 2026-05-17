from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import Project, User
from app.schemas.project import CreateProjectRequest, ProjectResponse
from app.services.workspace import create_project, ensure_default_project_for_user

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ProjectResponse]:
    await ensure_default_project_for_user(session, user)
    result = await session.execute(select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc()))
    projects = result.scalars().all()
    return [ProjectResponse.from_model(project) for project in projects]


@router.post("", response_model=ProjectResponse)
async def create_new_project(
    payload: CreateProjectRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProjectResponse:
    project = await create_project(
        session=session,
        user=user,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    await session.commit()
    await session.refresh(project)
    return ProjectResponse.from_model(project)
