from __future__ import annotations

from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any

from cryptography.fernet import Fernet
import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    AuditLog,
    CheckoutSession,
    ErrorLog,
    Invoice,
    Plan,
    Subscription,
    UsageEvent,
    User,
    UserApiKey,
    UserProfile,
    WalletTransaction,
    utcnow,
)

settings = get_settings()

PLAN_CATALOG: list[dict[str, Any]] = [
    {
        "code": "free",
        "name": "Free",
        "description": "Explore Syntrix with starter credits and core workspace features.",
        "price_cents": 0,
        "currency": "USD",
        "monthly_credits": 10_000,
        "api_rate_limit_per_minute": 20,
        "features": ["AI chat", "File editor", "Live preview", "Starter memory"],
    },
    {
        "code": "pro",
        "name": "Pro",
        "description": "For builders shipping real projects with higher AI usage and API access.",
        "price_cents": 1900,
        "currency": "USD",
        "monthly_credits": 250_000,
        "api_rate_limit_per_minute": 120,
        "features": ["Everything in Free", "API keys", "AI changes", "Usage analytics", "Priority models"],
    },
    {
        "code": "scale",
        "name": "Scale",
        "description": "Team-ready capacity with admin visibility and higher rate limits.",
        "price_cents": 9900,
        "currency": "USD",
        "monthly_credits": 2_000_000,
        "api_rate_limit_per_minute": 600,
        "features": ["Everything in Pro", "Admin dashboard", "Revenue analytics", "Higher API limits"],
    },
]


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


async def seed_plans(session: AsyncSession) -> None:
    for item in PLAN_CATALOG:
        result = await session.execute(select(Plan).where(Plan.code == item["code"]))
        plan = result.scalar_one_or_none()
        if plan is None:
            session.add(Plan(**item, is_active=True))
        else:
            for key, value in item.items():
                setattr(plan, key, value)
            plan.is_active = True
    await session.commit()


async def get_plans(session: AsyncSession) -> list[Plan]:
    result = await session.execute(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.price_cents.asc()))
    return list(result.scalars().all())


async def ensure_user_profile(session: AsyncSession, user: User) -> UserProfile:
    result = await session.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is not None:
        return profile

    role = "admin" if user.email.lower() in settings.admin_email_list else "user"
    profile = UserProfile(user_id=user.id, role=role, status="active")
    session.add(profile)
    await session.flush()
    return profile


async def get_wallet_balance(session: AsyncSession, user_id: str) -> int:
    result = await session.execute(
        select(func.coalesce(func.sum(WalletTransaction.credits), 0)).where(WalletTransaction.user_id == user_id)
    )
    return int(result.scalar_one() or 0)


async def add_wallet_transaction(
    session: AsyncSession,
    *,
    user_id: str,
    kind: str,
    credits: int,
    reason: str,
    metadata: dict[str, object] | None = None,
) -> WalletTransaction:
    balance = await get_wallet_balance(session, user_id)
    transaction = WalletTransaction(
        user_id=user_id,
        kind=kind,
        credits=credits,
        balance_after=balance + credits,
        reason=reason,
        transaction_metadata=metadata or {},
    )
    session.add(transaction)
    await session.flush()
    return transaction


async def ensure_billing_account(session: AsyncSession, user: User) -> tuple[Plan, Subscription]:
    await seed_plans(session)
    result = await session.execute(
        select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc()).limit(1)
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        plan_result = await session.execute(select(Plan).where(Plan.code == "free"))
        plan = plan_result.scalar_one()
        subscription = Subscription(
            user_id=user.id,
            plan_code=plan.code,
            status="active",
            provider="internal",
            current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
        )
        session.add(subscription)
        await session.flush()
    else:
        plan_result = await session.execute(select(Plan).where(Plan.code == subscription.plan_code))
        plan = plan_result.scalar_one()

    transaction_count = await session.execute(
        select(func.count(WalletTransaction.id)).where(WalletTransaction.user_id == user.id)
    )
    if int(transaction_count.scalar_one() or 0) == 0:
        await add_wallet_transaction(
            session,
            user_id=user.id,
            kind="grant",
            credits=plan.monthly_credits,
            reason=f"{plan.name} starter credits",
            metadata={"plan": plan.code},
        )

    return plan, subscription


async def record_usage_event(
    session: AsyncSession,
    *,
    user: User,
    project_id: str | None,
    feature: str,
    model: str,
    prompt_text: str,
    completion_text: str,
    status: str = "success",
    metadata: dict[str, object] | None = None,
) -> UsageEvent:
    prompt_tokens = estimate_tokens(prompt_text)
    completion_tokens = estimate_tokens(completion_text)
    credits = max(1, (prompt_tokens + completion_tokens + 99) // 100)
    event = UsageEvent(
        user_id=user.id,
        project_id=project_id,
        feature=feature,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        credits=credits,
        status=status,
        usage_metadata=metadata or {},
    )
    session.add(event)
    await add_wallet_transaction(
        session,
        user_id=user.id,
        kind="debit",
        credits=-credits,
        reason=f"{feature} usage",
        metadata={"usage_event": event.id, "model": model},
    )
    return event


async def create_user_api_key(session: AsyncSession, *, user: User, name: str) -> tuple[str, UserApiKey]:
    _, subscription = await ensure_billing_account(session, user)
    plan_result = await session.execute(select(Plan).where(Plan.code == subscription.plan_code))
    plan = plan_result.scalar_one()

    raw_key = f"syntrix_{secrets.token_urlsafe(32)}"
    record = UserApiKey(
        user_id=user.id,
        name=name,
        key_prefix=raw_key[:18],
        key_hash=hash_secret(raw_key),
        encrypted_key=encrypt_secret(raw_key),
        rate_limit_per_minute=plan.api_rate_limit_per_minute,
    )
    session.add(record)
    await session.flush()
    return raw_key, record


async def validate_user_api_key(session: AsyncSession, raw_key: str) -> tuple[User, UserApiKey] | None:
    result = await session.execute(select(UserApiKey).where(UserApiKey.key_hash == hash_secret(raw_key)))
    api_key = result.scalar_one_or_none()
    if api_key is None or api_key.status != "active":
        return None

    one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
    usage_count = await session.execute(
        select(func.count(UsageEvent.id)).where(
            UsageEvent.api_key_id == api_key.id,
            UsageEvent.created_at >= one_minute_ago,
        )
    )
    if int(usage_count.scalar_one() or 0) >= api_key.rate_limit_per_minute:
        return None

    user_result = await session.execute(select(User).where(User.id == api_key.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return None

    api_key.last_used_at = utcnow()
    await session.flush()
    return user, api_key


async def create_checkout(
    session: AsyncSession,
    *,
    user: User,
    plan_code: str,
    provider: str,
) -> CheckoutSession:
    plan_result = await session.execute(select(Plan).where(Plan.code == plan_code, Plan.is_active.is_(True)))
    plan = plan_result.scalar_one_or_none()
    if plan is None:
        raise ValueError("Plan not found.")

    checkout = CheckoutSession(user_id=user.id, plan_code=plan.code, provider=provider, status="pending")

    if provider == "internal" or plan.price_cents == 0:
        checkout.status = "completed"
        checkout.checkout_url = settings.stripe_success_url
        await activate_plan(session, user=user, plan=plan, provider="internal")
        session.add(checkout)
        await session.flush()
        return checkout

    if provider == "stripe" and settings.stripe_secret_key:
        price_id = settings.stripe_price_map.get(plan.code)
        if not price_id:
            checkout.status = "configuration_required"
            checkout.checkout_url = ""
            checkout.session_metadata = {"missing": f"SYNTRIX_STRIPE_PRICE_{plan.code.upper()}"}
        else:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    auth=(settings.stripe_secret_key, ""),
                    data={
                        "mode": "subscription",
                        "client_reference_id": user.id,
                        "success_url": settings.stripe_success_url,
                        "cancel_url": settings.stripe_cancel_url,
                        "line_items[0][price]": price_id,
                        "line_items[0][quantity]": "1",
                        "metadata[user_id]": user.id,
                        "metadata[plan_code]": plan.code,
                    },
                )
                response.raise_for_status()
                payload = response.json()
                checkout.provider_session_id = payload.get("id", "")
                checkout.checkout_url = payload.get("url", "")
                checkout.session_metadata = payload
    elif provider == "razorpay" and settings.razorpay_key_id and settings.razorpay_key_secret:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.razorpay.com/v1/payment_links/",
                auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                json={
                    "amount": plan.price_cents,
                    "currency": plan.currency,
                    "description": f"{plan.name} subscription",
                    "callback_url": settings.razorpay_callback_url,
                    "callback_method": "get",
                    "notes": {"user_id": user.id, "plan_code": plan.code},
                },
            )
            response.raise_for_status()
            payload = response.json()
            checkout.provider_session_id = payload.get("id", "")
            checkout.checkout_url = payload.get("short_url", "")
            checkout.session_metadata = payload
    else:
        checkout.status = "configuration_required"
        checkout.checkout_url = ""
        checkout.session_metadata = {"provider": provider, "reason": "Provider credentials are not configured."}

    session.add(checkout)
    await session.flush()
    return checkout


async def activate_plan(session: AsyncSession, *, user: User, plan: Plan, provider: str) -> Subscription:
    result = await session.execute(
        select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc()).limit(1)
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        subscription = Subscription(user_id=user.id, plan_code=plan.code)
        session.add(subscription)

    subscription.plan_code = plan.code
    subscription.status = "active"
    subscription.provider = provider
    subscription.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
    if plan.price_cents > 0:
        invoice = Invoice(
            user_id=user.id,
            provider=provider,
            provider_invoice_id=f"internal_{secrets.token_urlsafe(12)}" if provider == "internal" else "",
            status="paid" if provider == "internal" else "open",
            amount_cents=plan.price_cents,
            currency=plan.currency,
            hosted_url=settings.stripe_success_url if provider == "internal" else "",
            invoice_metadata={"plan": plan.code, "provider": provider},
        )
        session.add(invoice)
    await add_wallet_transaction(
        session,
        user_id=user.id,
        kind="grant",
        credits=plan.monthly_credits,
        reason=f"{plan.name} monthly credits",
        metadata={"plan": plan.code, "provider": provider},
    )
    return subscription


async def audit(
    session: AsyncSession,
    *,
    actor_user_id: str | None,
    action: str,
    target_user_id: str | None = None,
    details: dict[str, object] | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            action=action,
            details=details or {},
        )
    )


async def log_error(
    session: AsyncSession,
    *,
    source: str,
    message: str,
    severity: str = "error",
    context: dict[str, object] | None = None,
) -> None:
    session.add(ErrorLog(source=source, severity=severity, message=message, context=context or {}))
