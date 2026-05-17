from __future__ import annotations

import json
import logging
import re
from typing import Iterable

from app.core.config import get_settings
from app.schemas.ai import ModelOption
from app.services.workspace import list_relative_files

logger = logging.getLogger(__name__)
settings = get_settings()

CURATED_MODELS = [
    ModelOption(
        id="gpt-5.5",
        label="GPT-5.5",
        description="Frontier model for complex coding, architecture, and professional work.",
        category="frontier",
        recommended=True,
    ),
    ModelOption(
        id="gpt-5.4",
        label="GPT-5.4",
        description="Strong general coding and product work with lower cost than the flagship model.",
        category="frontier",
    ),
    ModelOption(
        id="gpt-5.4-mini",
        label="GPT-5.4 Mini",
        description="Fast, capable default for chat, edits, and day-to-day development.",
        category="balanced",
        recommended=True,
    ),
    ModelOption(
        id="gpt-5.4-nano",
        label="GPT-5.4 Nano",
        description="Lowest-latency option for simple high-volume requests.",
        category="fast",
    ),
    ModelOption(
        id="gpt-5.2-codex",
        label="GPT-5.2 Codex",
        description="Codex-optimized model for long-horizon agentic coding tasks.",
        category="codex",
        recommended=True,
    ),
    ModelOption(
        id="gpt-5.1-codex",
        label="GPT-5.1 Codex",
        description="Codex-optimized coding model for API accounts with this model enabled.",
        category="codex",
    ),
    ModelOption(
        id="gpt-5-mini",
        label="GPT-5 Mini",
        description="Cost-sensitive GPT-5-class option for low-latency workflows.",
        category="legacy-compatible",
    ),
    ModelOption(
        id="gpt-4.1",
        label="GPT-4.1",
        description="Reliable non-reasoning model for broad compatibility.",
        category="compatibility",
    ),
    ModelOption(
        id="gpt-4.1-mini",
        label="GPT-4.1 Mini",
        description="Fast compatibility fallback for lighter chat and editing work.",
        category="compatibility",
    ),
]

CURATED_MODEL_IDS = {model.id for model in CURATED_MODELS}
NON_CHAT_MODEL_MARKERS = (
    "audio",
    "embedding",
    "image",
    "moderation",
    "realtime",
    "search",
    "transcribe",
    "tts",
    "whisper",
)


def is_text_model_id(model_id: str) -> bool:
    lowered = model_id.lower()
    if any(marker in lowered for marker in NON_CHAT_MODEL_MARKERS):
        return False
    return lowered.startswith(("gpt-", "chat-", "codex-")) or re.fullmatch(r"o\d(?:-[a-z0-9.-]+)?", lowered) is not None


def resolve_model_id(requested_model: str | None = None) -> str:
    model = (requested_model or settings.openai_model).strip()
    if model in CURATED_MODEL_IDS:
        return model
    if re.fullmatch(r"[A-Za-z0-9._:-]{2,80}", model):
        return model
    return settings.openai_model


def get_live_openai_model_ids() -> list[str]:
    if not settings.openai_api_key:
        return []

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        models = client.models.list()
        model_ids = sorted(
            {
                item.id
                for item in models.data
                if is_text_model_id(item.id)
            }
        )
        return model_ids[:100]
    except Exception as exc:
        logger.warning("Could not fetch live OpenAI model list: %s", exc)
        return []


def build_system_prompt(project_name: str | None = None) -> str:
    scope = f"project '{project_name}'" if project_name else "the current workspace"
    return (
        "You are Syntrix AI, an autonomous software engineer. "
        f"Respond with concise implementation guidance for {scope}. "
        "When helpful, mention files, commands, and validation steps."
    )


def build_fallback_reply(user_message: str, project_name: str | None, files: list[str]) -> str:
    heading = f"Working inside {project_name}." if project_name else "Working without a selected project."
    file_context = ", ".join(files[:8]) if files else "No project files are available yet."
    return (
        f"{heading}\n\n"
        f"You asked: {user_message}\n\n"
        "Suggested next actions:\n"
        "1. Review the relevant files before editing.\n"
        "2. Make the smallest safe change that moves the feature forward.\n"
        "3. Run a verification command after the change.\n\n"
        f"Current file context: {file_context}"
    )


def stream_text_chunks(text: str) -> Iterable[str]:
    chunk_size = 32
    for index in range(0, len(text), chunk_size):
        yield text[index : index + chunk_size]


def stream_openai_reply(*, model_id: str, project_name: str | None, files: list[str], user_message: str) -> Iterable[str]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    context_text = json.dumps({"project": project_name, "files": files[:25]})
    stream = client.responses.create(
        model=model_id,
        instructions=build_system_prompt(project_name),
        input=[
            {
                "role": "user",
                "content": f"Project context: {context_text}\n\nUser request: {user_message}",
            }
        ],
        stream=True,
    )

    for event in stream:
        if getattr(event, "type", "") == "response.output_text.delta":
            yield event.delta


def openai_error_message(exc: Exception) -> str:
    message = str(exc)
    lower_message = message.lower()
    if "connection error" in lower_message or "name or service not known" in lower_message:
        return "OpenAI is temporarily unreachable from this Docker container. Check Docker internet/DNS and try again."
    if "insufficient_quota" in lower_message or "exceeded your current quota" in lower_message:
        return "OpenAI could not answer because this model is over your current quota or billing limit."
    if "invalid_api_key" in lower_message or "incorrect api key" in lower_message:
        return "OpenAI could not answer because the API key is invalid or revoked."
    if "model" in lower_message and ("not found" in lower_message or "does not exist" in lower_message):
        return "OpenAI could not answer because this model is not enabled for your API key."
    return "OpenAI could not answer this request."


def stream_chat_reply(*, user_message: str, project=None, model: str | None = None) -> Iterable[str]:
    files = list_relative_files(project) if project is not None else []
    model_id = resolve_model_id(model)
    project_name = getattr(project, "name", None)

    if settings.openai_api_key:
        try:
            yield from stream_openai_reply(
                model_id=model_id,
                project_name=project_name,
                files=files,
                user_message=user_message,
            )
            return
        except Exception as exc:
            fallback_model = resolve_model_id(settings.openai_model)
            if fallback_model != model_id:
                logger.warning("OpenAI model %s failed, retrying with %s: %s", model_id, fallback_model, exc)
                try:
                    yield (
                        f"{openai_error_message(exc)} Retrying with {fallback_model}.\n\n"
                    )
                    yield from stream_openai_reply(
                        model_id=fallback_model,
                        project_name=project_name,
                        files=files,
                        user_message=user_message,
                    )
                    return
                except Exception as fallback_exc:
                    logger.warning("OpenAI fallback model failed: %s", fallback_exc)
                    yield (
                        f"{openai_error_message(fallback_exc)} Check your OpenAI billing, quota, and model access."
                    )
                    return

            logger.warning("OpenAI streaming failed: %s", exc)
            yield f"{openai_error_message(exc)} Check your OpenAI billing, quota, and model access."
            return

    fallback = build_fallback_reply(user_message, project_name, files)
    yield from stream_text_chunks(fallback)
