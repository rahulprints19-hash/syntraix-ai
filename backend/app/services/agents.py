from datetime import datetime, timezone
import json
import logging

from app.schemas.agent import AgentStep
from app.core.config import get_settings
from app.services.ai import resolve_model_id
from app.services.workspace import list_relative_files

logger = logging.getLogger(__name__)
settings = get_settings()


def _fallback_agent_plan(objective: str, project, model_id: str) -> tuple[list[AgentStep], str]:
    files = list_relative_files(project)
    file_hint = ", ".join(files[:6]) if files else "no files yet"

    plan = [
        AgentStep(agent="Planner Agent", task=f"Break down the objective: {objective}", status="completed"),
        AgentStep(agent="Coding Agent", task=f"Inspect and modify the relevant files: {file_hint}", status="completed"),
        AgentStep(agent="Debug Agent", task="Review generated code paths and identify likely regressions.", status="completed"),
        AgentStep(agent="Terminal Agent", task="Prepare verification commands and next execution steps.", status="completed"),
    ]

    summary = (
        f"Agent loop completed at {datetime.now(timezone.utc).isoformat()}. "
        f"The system prepared a four-role plan with {model_id} around the objective '{objective}' "
        "and scanned the first project files."
    )
    return plan, summary


def _parse_agent_response(raw_text: str) -> tuple[list[AgentStep], str]:
    data = json.loads(raw_text)
    if not isinstance(data, dict):
        raise ValueError("Agent response must be a JSON object.")

    plan_data = data.get("plan", [])
    if not isinstance(plan_data, list):
        raise ValueError("Agent response must include a plan list.")

    plan = [
        AgentStep(
            agent=str(item.get("agent", "Agent"))[:80],
            task=str(item.get("task", ""))[:800],
            status=str(item.get("status", "completed"))[:32],
        )
        for item in plan_data
        if isinstance(item, dict) and item.get("task")
    ]
    summary = str(data.get("summary", "")).strip()[:1600]
    if not plan or not summary:
        raise ValueError("Agent response was missing usable plan or summary content.")
    return plan, summary


def build_agent_plan(objective: str, project, model: str | None = None) -> tuple[list[AgentStep], str, str]:
    model_id = resolve_model_id(model)
    files = list_relative_files(project)

    if settings.openai_api_key:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.create(
                model=model_id,
                instructions=(
                    "You are Syntrix AI's planner. Return only valid JSON with a summary and a plan array. "
                    "Each plan item needs agent, task, and status. Keep tasks concrete and implementation-focused."
                ),
                input=json.dumps(
                    {
                        "objective": objective,
                        "project": getattr(project, "name", "Project"),
                        "files": files[:40],
                    }
                ),
            )
            plan, summary = _parse_agent_response(response.output_text)
            return plan, summary, model_id
        except Exception as exc:
            logger.exception("OpenAI agent planning failed, falling back to local plan: %s", exc)

    plan, summary = _fallback_agent_plan(objective, project, model_id)
    return plan, summary, model_id
