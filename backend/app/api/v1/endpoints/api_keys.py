from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import UsageEvent, User, UserApiKey
from app.schemas.saas import ApiKeyAnalyticsResponse, ApiKeyCreateRequest, ApiKeyCreateResponse, ApiKeyResponse
from app.services.saas import audit, create_user_api_key

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def api_key_response(record: UserApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        status=record.status,
        rate_limit_per_minute=record.rate_limit_per_minute,
        last_used_at=record.last_used_at,
        created_at=record.created_at,
        revoked_at=record.revoked_at,
    )


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ApiKeyResponse]:
    result = await session.execute(
        select(UserApiKey).where(UserApiKey.user_id == user.id).order_by(UserApiKey.created_at.desc())
    )
    return [api_key_response(record) for record in result.scalars().all()]


@router.post("", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApiKeyCreateResponse:
    raw_key, record = await create_user_api_key(session, user=user, name=payload.name)
    await audit(session, actor_user_id=user.id, action="api_key.created", details={"api_key_id": record.id})
    await session.commit()
    await session.refresh(record)
    return ApiKeyCreateResponse(api_key=raw_key, record=api_key_response(record))


@router.post("/{api_key_id}/rotate", response_model=ApiKeyCreateResponse)
async def rotate_api_key(
    api_key_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApiKeyCreateResponse:
    result = await session.execute(select(UserApiKey).where(UserApiKey.id == api_key_id, UserApiKey.user_id == user.id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")

    record.status = "rotated"
    record.revoked_at = datetime.now(timezone.utc)
    raw_key, next_record = await create_user_api_key(session, user=user, name=f"{record.name} rotated")
    await audit(
        session,
        actor_user_id=user.id,
        action="api_key.rotated",
        details={"old_api_key_id": record.id, "new_api_key_id": next_record.id},
    )
    await session.commit()
    await session.refresh(next_record)
    return ApiKeyCreateResponse(api_key=raw_key, record=api_key_response(next_record))


@router.post("/{api_key_id}/revoke", response_model=ApiKeyResponse)
async def revoke_api_key(
    api_key_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApiKeyResponse:
    result = await session.execute(select(UserApiKey).where(UserApiKey.id == api_key_id, UserApiKey.user_id == user.id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")

    record.status = "revoked"
    record.revoked_at = datetime.now(timezone.utc)
    await audit(session, actor_user_id=user.id, action="api_key.revoked", details={"api_key_id": record.id})
    await session.commit()
    await session.refresh(record)
    return api_key_response(record)


@router.get("/{api_key_id}/analytics", response_model=ApiKeyAnalyticsResponse)
async def api_key_analytics(
    api_key_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApiKeyAnalyticsResponse:
    result = await session.execute(select(UserApiKey).where(UserApiKey.id == api_key_id, UserApiKey.user_id == user.id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")

    usage_events = await session.execute(select(func.count(UsageEvent.id)).where(UsageEvent.api_key_id == record.id))
    usage_credits = await session.execute(
        select(func.coalesce(func.sum(UsageEvent.credits), 0)).where(UsageEvent.api_key_id == record.id)
    )
    return ApiKeyAnalyticsResponse(
        api_key_id=record.id,
        usage_events=int(usage_events.scalar_one() or 0),
        usage_credits=int(usage_credits.scalar_one() or 0),
        last_used_at=record.last_used_at,
    )
