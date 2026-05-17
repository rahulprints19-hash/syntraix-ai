from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.db.session import get_db_session
from app.models import AgentRun, User
from app.schemas.agent import AgentRunRequest, AgentRunResponse
from app.services.agents import build_agent_plan
from app.services.saas import record_usage_event

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/run", response_model=AgentRunResponse)
async def run_agent_loop(
    payload: AgentRunRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentRunResponse:
    project = await get_project_for_user(payload.project_id, session, user)
    plan, summary, model_id = build_agent_plan(payload.objective, project, payload.model)

    run = AgentRun(
        user_id=user.id,
        project_id=project.id,
        objective=payload.objective,
        status="completed",
        plan=[step.model_dump() for step in plan],
        result={"summary": summary, "execute": payload.execute, "model": model_id},
    )
    session.add(run)
    await record_usage_event(
        session,
        user=user,
        project_id=project.id,
        feature="agents",
        model=model_id,
        prompt_text=payload.objective,
        completion_text=summary,
        status="success",
    )
    await session.commit()
    await session.refresh(run)

    return AgentRunResponse(
        id=run.id,
        project_id=run.project_id,
        objective=run.objective,
        model=model_id,
        status=run.status,
        created_at=run.created_at,
        updated_at=run.updated_at,
        plan=plan,
        summary=summary,
    )
