from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db_session
from app.models import Project, User
from app.services.saas import ensure_user_profile, validate_user_api_key

security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-Syntrix-Api-Key", auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    api_key: str | None = Depends(api_key_header),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if credentials is None:
        if api_key:
            api_user = await validate_user_api_key(session, api_key)
            if api_user is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key.")
            user, _ = api_user
            profile = await ensure_user_profile(session, user)
            if profile.status != "active":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active.")
            await session.commit()
            return user

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    profile = await ensure_user_profile(session, user)
    if profile.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active.")
    await session.flush()
    return user


async def get_current_admin_user(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    profile = await ensure_user_profile(session, user)
    from app.core.config import get_settings

    settings = get_settings()
    is_configured_admin = user.email.lower() in settings.admin_email_list
    if profile.role == "admin" or is_configured_admin:
        return user

    if settings.environment.lower() != "production" and not settings.admin_email_list:
        profile.role = "admin"
        await session.commit()
        return user

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")


async def get_project_for_user(
    project_id: str,
    session: AsyncSession,
    user: User,
) -> Project:
    result = await session.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    return project
