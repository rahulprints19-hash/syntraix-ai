from fastapi import APIRouter

from app.api.v1.endpoints.agents import router as agent_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.ai import router as ai_router
from app.api.v1.endpoints.api_keys import router as api_key_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.billing import router as billing_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.changes import router as changes_router
from app.api.v1.endpoints.deploy import router as deploy_router
from app.api.v1.endpoints.files import router as file_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.memory import router as memory_router
from app.api.v1.endpoints.preview import router as preview_router
from app.api.v1.endpoints.projects import router as project_router
from app.api.v1.endpoints.terminal import router as terminal_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(ai_router)
router.include_router(project_router)
router.include_router(file_router)
router.include_router(chat_router)
router.include_router(changes_router)
router.include_router(terminal_router)
router.include_router(preview_router)
router.include_router(agent_router)
router.include_router(memory_router)
router.include_router(deploy_router)
router.include_router(billing_router)
router.include_router(api_key_router)
router.include_router(admin_router)
router.include_router(health_router)
