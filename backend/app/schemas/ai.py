from pydantic import BaseModel


class ModelOption(BaseModel):
    id: str
    label: str
    description: str
    category: str
    recommended: bool = False


class ModelCatalogResponse(BaseModel):
    configured: bool
    default_model: str
    models: list[ModelOption]
    live_model_ids: list[str] = []
