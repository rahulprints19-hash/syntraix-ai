from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()
redis_client: Redis | None = None


def get_redis_client() -> Redis:
    global redis_client

    if redis_client is None:
        redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

    return redis_client


async def ping_redis() -> bool:
    try:
        client = get_redis_client()
        return bool(await client.ping())
    except Exception:
        return False


async def close_redis() -> None:
    global redis_client

    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None
