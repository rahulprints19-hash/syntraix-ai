from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db_session
from app.models import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.saas import ensure_billing_account, ensure_user_profile
from app.services.workspace import ensure_default_project_for_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    email = payload.email.strip().lower()
    existing_result = await session.execute(select(User).where(User.email == email))
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    await ensure_user_profile(session, user)
    await ensure_billing_account(session, user)
    await ensure_default_project_for_user(session, user)

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserResponse.from_model(user))


@router.post("/login", response_model=AuthResponse)
async def login_user(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    email = payload.email.strip().lower()
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(user.id)
    await ensure_user_profile(session, user)
    await ensure_billing_account(session, user)
    await ensure_default_project_for_user(session, user)
    return AuthResponse(access_token=token, user=UserResponse.from_model(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.from_model(user)
