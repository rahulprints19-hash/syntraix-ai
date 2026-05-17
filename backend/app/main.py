from collections import defaultdict, deque
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.init import initialize_database
from app.services.redis import close_redis
from app.services.workspace import ensure_workspace_root, ensure_workspace_samples

settings = get_settings()
configure_logging(settings.log_level)
rate_limit_hits: dict[str, deque[float]] = defaultdict(deque)
rate_limit_window_seconds = 60
rate_limit_max_requests = 300


@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_database()
    ensure_workspace_root()
    await ensure_workspace_samples()
    yield
    await close_redis()


app = FastAPI(
    title=settings.project_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def production_guardrails(request: Request, call_next):
    if settings.environment.lower() == "production":
        client_host = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = rate_limit_hits[client_host]
        while hits and now - hits[0] > rate_limit_window_seconds:
            hits.popleft()
        if len(hits) >= rate_limit_max_requests:
            return JSONResponse({"detail": "Too many requests."}, status_code=429)
        hits.append(now)

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.environment.lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {
        "name": settings.project_name,
        "docs": "/docs",
        "health": f"{settings.api_v1_prefix}/health",
    }
