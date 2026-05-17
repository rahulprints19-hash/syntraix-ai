from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.ai import ModelCatalogResponse
from app.services.ai import CURATED_MODELS, get_live_openai_model_ids, resolve_model_id

router = APIRouter(prefix="/ai", tags=["ai"])
settings = get_settings()


@router.get("/models", response_model=ModelCatalogResponse)
async def list_ai_models(_: User = Depends(get_current_user)) -> ModelCatalogResponse:
    return ModelCatalogResponse(
        configured=bool(settings.openai_api_key),
        default_model=resolve_model_id(settings.openai_model),
        models=CURATED_MODELS,
        live_model_ids=get_live_openai_model_ids(),
    )
