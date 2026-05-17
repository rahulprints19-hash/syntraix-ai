from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.db.session import get_db_session
from app.models import MemoryEntry, User
from app.schemas.memory import MemoryResponse, MemoryStoreRequest
from app.services.memory import cosine_similarity, embed_text

router = APIRouter(prefix="/memory", tags=["memory"])


@router.post("", response_model=MemoryResponse)
async def store_memory(
    payload: MemoryStoreRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MemoryResponse:
    if payload.project_id:
        await get_project_for_user(payload.project_id, session, user)

    entry = MemoryEntry(
        user_id=user.id,
        project_id=payload.project_id,
        kind=payload.kind,
        content=payload.content,
        vector=embed_text(payload.content),
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return MemoryResponse(id=entry.id, kind=entry.kind, content=entry.content, created_at=entry.created_at)


@router.get("/search", response_model=list[MemoryResponse])
async def search_memories(
    query: str = Query(...),
    project_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[MemoryResponse]:
    if project_id:
        await get_project_for_user(project_id, session, user)

    statement = select(MemoryEntry).where(MemoryEntry.user_id == user.id)
    if project_id:
        statement = statement.where(MemoryEntry.project_id == project_id)

    result = await session.execute(statement.order_by(MemoryEntry.created_at.desc()))
    entries = result.scalars().all()
    query_vector = embed_text(query)

    ranked_entries = sorted(
        entries,
        key=lambda item: cosine_similarity(query_vector, item.vector or []),
        reverse=True,
    )[:5]

    return [
        MemoryResponse(
            id=entry.id,
            kind=entry.kind,
            content=entry.content,
            created_at=entry.created_at,
            score=cosine_similarity(query_vector, entry.vector or []),
        )
        for entry in ranked_entries
    ]
