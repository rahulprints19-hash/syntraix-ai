from pydantic import BaseModel


class PreviewResponse(BaseModel):
    entry_path: str
    html: str
    status: str
