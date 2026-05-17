from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db_session
from app.models import ErrorLog, Invoice, Subscription, UsageEvent, User, UserApiKey, UserProfile, WalletTransaction
from app.schemas.saas import AdminOverviewResponse, AdminUserResponse, AdminUserStatusRequest, ErrorLogResponse
from app.services.saas import audit, ensure_billing_account, ensure_user_profile, get_wallet_balance

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    _: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db_session),
) -> AdminOverviewResponse:
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)

    total_users = await session.execute(select(func.count(User.id)))
    active_users = await session.execute(select(func.count(UserProfile.user_id)).where(UserProfile.status == "active"))
    suspended_users = await session.execute(
        select(func.count(UserProfile.user_id)).where(UserProfile.status.in_(["suspended", "banned"]))
    )
    revenue = await session.execute(
        select(func.coalesce(func.sum(Invoice.amount_cents), 0)).where(
            Invoice.status == "paid",
            Invoice.created_at >= start_of_month,
        )
    )
    usage = await session.execute(
        select(func.coalesce(func.sum(UsageEvent.credits), 0)).where(UsageEvent.created_at >= start_of_month)
    )
    active_subscriptions = await session.execute(
        select(func.count(Subscription.id)).where(Subscription.status == "active")
    )
    api_keys = await session.execute(select(func.count(UserApiKey.id)).where(UserApiKey.status == "active"))
    errors = await session.execute(select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= day_ago))

    return AdminOverviewResponse(
        users=int(total_users.scalar_one() or 0),
        active_users=int(active_users.scalar_one() or 0),
        suspended_users=int(suspended_users.scalar_one() or 0),
        monthly_revenue_cents=int(revenue.scalar_one() or 0),
        monthly_usage_credits=int(usage.scalar_one() or 0),
        active_subscriptions=int(active_subscriptions.scalar_one() or 0),
        api_keys=int(api_keys.scalar_one() or 0),
        errors_24h=int(errors.scalar_one() or 0),
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def admin_users(
    _: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[AdminUserResponse]:
    result = await session.execute(select(User).order_by(User.created_at.desc()).limit(100))
    users = result.scalars().all()
    response: list[AdminUserResponse] = []
    for user in users:
        profile = await ensure_user_profile(session, user)
        plan, _ = await ensure_billing_account(session, user)
        response.append(
            AdminUserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=profile.role,
                status=profile.status,
                plan_code=plan.code,
                wallet_balance=await get_wallet_balance(session, user.id),
                created_at=user.created_at,
            )
        )
    await session.commit()
    return response


@router.patch("/users/{user_id}/status", response_model=AdminUserResponse)
async def update_user_status(
    user_id: str,
    payload: AdminUserStatusRequest,
    admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUserResponse:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    profile = await ensure_user_profile(session, user)
    profile.status = payload.status
    profile.suspension_reason = payload.reason
    await audit(
        session,
        actor_user_id=admin.id,
        target_user_id=user.id,
        action="user.status_updated",
        details={"status": payload.status, "reason": payload.reason},
    )
    plan, _ = await ensure_billing_account(session, user)
    await session.commit()
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=profile.role,
        status=profile.status,
        plan_code=plan.code,
        wallet_balance=await get_wallet_balance(session, user.id),
        created_at=user.created_at,
    )


@router.get("/errors", response_model=list[ErrorLogResponse])
async def admin_errors(
    _: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ErrorLogResponse]:
    result = await session.execute(select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(100))
    return [
        ErrorLogResponse(
            id=item.id,
            source=item.source,
            severity=item.severity,
            message=item.message,
            created_at=item.created_at,
        )
        for item in result.scalars().all()
    ]


@router.get("/usage", response_model=list[dict])
async def admin_usage(
    _: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    result = await session.execute(
        select(UsageEvent.feature, UsageEvent.model, func.count(UsageEvent.id), func.coalesce(func.sum(UsageEvent.credits), 0))
        .group_by(UsageEvent.feature, UsageEvent.model)
        .order_by(func.coalesce(func.sum(UsageEvent.credits), 0).desc())
        .limit(50)
    )
    return [
        {"feature": feature, "model": model, "events": int(events), "credits": int(credits)}
        for feature, model, events, credits in result.all()
    ]
