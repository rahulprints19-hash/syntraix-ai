from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import Invoice, Plan, UsageEvent, User, WalletTransaction
from app.schemas.saas import (
    BillingOverviewResponse,
    CheckoutRequest,
    CheckoutResponse,
    InvoiceResponse,
    PlanResponse,
    SubscriptionResponse,
    UsageEventResponse,
    WalletTopUpRequest,
    WalletTransactionResponse,
)
from app.services.saas import (
    add_wallet_transaction,
    create_checkout,
    ensure_billing_account,
    get_plans,
    get_wallet_balance,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def plan_response(plan: Plan) -> PlanResponse:
    return PlanResponse(
        code=plan.code,
        name=plan.name,
        description=plan.description,
        price_cents=plan.price_cents,
        currency=plan.currency,
        monthly_credits=plan.monthly_credits,
        api_rate_limit_per_minute=plan.api_rate_limit_per_minute,
        features=plan.features,
        is_active=plan.is_active,
    )


@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(session: AsyncSession = Depends(get_db_session)) -> list[PlanResponse]:
    return [plan_response(plan) for plan in await get_plans(session)]


@router.get("/overview", response_model=BillingOverviewResponse)
async def billing_overview(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BillingOverviewResponse:
    plan, subscription = await ensure_billing_account(session, user)
    await session.commit()

    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    usage_credits_result = await session.execute(
        select(func.coalesce(func.sum(UsageEvent.credits), 0)).where(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= start_of_month,
        )
    )
    usage_events_result = await session.execute(
        select(func.count(UsageEvent.id)).where(
            UsageEvent.user_id == user.id,
            UsageEvent.created_at >= start_of_month,
        )
    )
    transactions_result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(8)
    )
    usage_result = await session.execute(
        select(UsageEvent).where(UsageEvent.user_id == user.id).order_by(UsageEvent.created_at.desc()).limit(8)
    )
    invoice_result = await session.execute(
        select(Invoice).where(Invoice.user_id == user.id).order_by(Invoice.created_at.desc()).limit(8)
    )

    return BillingOverviewResponse(
        plan=plan_response(plan),
        subscription=SubscriptionResponse(
            id=subscription.id,
            plan_code=subscription.plan_code,
            status=subscription.status,
            provider=subscription.provider,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
        ),
        wallet_balance=await get_wallet_balance(session, user.id),
        month_usage_credits=int(usage_credits_result.scalar_one() or 0),
        month_usage_events=int(usage_events_result.scalar_one() or 0),
        recent_transactions=[
            WalletTransactionResponse(
                id=item.id,
                kind=item.kind,
                credits=item.credits,
                balance_after=item.balance_after,
                reason=item.reason,
                created_at=item.created_at,
            )
            for item in transactions_result.scalars().all()
        ],
        recent_usage=[
            UsageEventResponse(
                id=item.id,
                feature=item.feature,
                model=item.model,
                prompt_tokens=item.prompt_tokens,
                completion_tokens=item.completion_tokens,
                credits=item.credits,
                status=item.status,
                created_at=item.created_at,
            )
            for item in usage_result.scalars().all()
        ],
        recent_invoices=[
            InvoiceResponse(
                id=item.id,
                provider=item.provider,
                status=item.status,
                amount_cents=item.amount_cents,
                currency=item.currency,
                invoice_url=item.hosted_url,
                created_at=item.created_at,
            )
            for item in invoice_result.scalars().all()
        ],
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CheckoutResponse:
    try:
        checkout_session = await create_checkout(
            session,
            user=user,
            plan_code=payload.plan_code,
            provider=payload.provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    await session.commit()
    message = (
        "Checkout created."
        if checkout_session.checkout_url
        else "Payment provider credentials or price IDs are not configured yet."
    )
    return CheckoutResponse(
        provider=checkout_session.provider,
        status=checkout_session.status,
        checkout_url=checkout_session.checkout_url,
        message=message,
    )


@router.post("/wallet/top-up", response_model=BillingOverviewResponse)
async def wallet_top_up(
    payload: WalletTopUpRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BillingOverviewResponse:
    await ensure_billing_account(session, user)
    await add_wallet_transaction(
        session,
        user_id=user.id,
        kind="top_up",
        credits=payload.credits,
        reason=payload.reason,
        metadata={"source": "manual"},
    )
    await session.commit()
    return await billing_overview(user=user, session=session)
