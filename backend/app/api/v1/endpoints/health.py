from fastapi import APIRouter, Response, status

from app.db.session import ping_database
from app.schemas.health import HealthResponse, ServiceCheck
from app.services.redis import ping_redis

router = APIRouter(prefix="/health", tags=["health"])


def build_health_payload(database_ok: bool, redis_ok: bool) -> HealthResponse:
    overall_status = "ok" if database_ok and redis_ok else "degraded"

    return HealthResponse(
        status=overall_status,
        services={
            "api": ServiceCheck(status="ok", detail="FastAPI application is serving requests."),
            "database": ServiceCheck(
                status="ok" if database_ok else "degraded",
                detail="Database connection succeeded." if database_ok else "Database is not reachable.",
            ),
            "redis": ServiceCheck(
                status="ok" if redis_ok else "degraded",
                detail="Redis ping succeeded." if redis_ok else "Redis is not reachable.",
            ),
        },
    )


@router.get("/live", response_model=HealthResponse)
async def liveness_probe() -> HealthResponse:
    return HealthResponse(
        status="ok",
        services={
            "api": ServiceCheck(status="ok", detail="Process is alive."),
        },
    )


@router.get("/ready", response_model=HealthResponse)
async def readiness_probe(response: Response) -> HealthResponse:
    database_ok = await ping_database()
    redis_ok = await ping_redis()
    payload = build_health_payload(database_ok=database_ok, redis_ok=redis_ok)
    response.status_code = status.HTTP_200_OK if payload.status == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE

    return payload


@router.get("", response_model=HealthResponse)
async def healthcheck(response: Response) -> HealthResponse:
    return await readiness_probe(response)
