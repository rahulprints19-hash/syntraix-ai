from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401
from app.db.session import AsyncSessionLocal
from app.services.saas import seed_plans


async def initialize_database() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await seed_plans(session)
