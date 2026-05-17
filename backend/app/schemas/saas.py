from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PlanResponse(BaseModel):
    code: str
    name: str
    description: str
    price_cents: int
    currency: str
    monthly_credits: int
    api_rate_limit_per_minute: int
    features: list[str]
    is_active: bool


class SubscriptionResponse(BaseModel):
    id: str
    plan_code: str
    status: str
    provider: str
    current_period_end: datetime | None
    cancel_at_period_end: bool


class WalletTransactionResponse(BaseModel):
    id: str
    kind: str
    credits: int
    balance_after: int
    reason: str
    created_at: datetime


class UsageEventResponse(BaseModel):
    id: str
    feature: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    credits: int
    status: str
    created_at: datetime


class InvoiceResponse(BaseModel):
    id: str
    provider: str
    status: str
    amount_cents: int
    currency: str
    invoice_url: str
    created_at: datetime


class BillingOverviewResponse(BaseModel):
    plan: PlanResponse
    subscription: SubscriptionResponse
    wallet_balance: int
    month_usage_credits: int
    month_usage_events: int
    recent_transactions: list[WalletTransactionResponse]
    recent_usage: list[UsageEventResponse]
    recent_invoices: list[InvoiceResponse]


class CheckoutRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=64)
    provider: str = Field(default="stripe", pattern="^(stripe|razorpay|internal)$")

    @field_validator("plan_code")
    @classmethod
    def normalize_plan_code(cls, value: str) -> str:
        return value.strip().lower()


class CheckoutResponse(BaseModel):
    provider: str
    status: str
    checkout_url: str
    message: str


class WalletTopUpRequest(BaseModel):
    credits: int = Field(ge=100, le=1_000_000)
    reason: str = Field(default="Manual wallet top-up", max_length=255)


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    status: str
    rate_limit_per_minute: int
    last_used_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None


class ApiKeyCreateResponse(BaseModel):
    api_key: str
    record: ApiKeyResponse


class ApiKeyAnalyticsResponse(BaseModel):
    api_key_id: str
    usage_events: int
    usage_credits: int
    last_used_at: datetime | None


class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    status: str
    plan_code: str
    wallet_balance: int
    created_at: datetime


class AdminOverviewResponse(BaseModel):
    users: int
    active_users: int
    suspended_users: int
    monthly_revenue_cents: int
    monthly_usage_credits: int
    active_subscriptions: int
    api_keys: int
    errors_24h: int


class AdminUserStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|suspended|banned)$")
    reason: str = Field(default="", max_length=500)


class ErrorLogResponse(BaseModel):
    id: str
    source: str
    severity: str
    message: str
    created_at: datetime
