from __future__ import annotations

import json
from pathlib import Path

from app.core.config import get_settings
from app.models import Project
from app.schemas.changes import FileChange
from app.services.ai import resolve_model_id
from app.services.workspace import detect_language, list_relative_files, resolve_project_path

settings = get_settings()


def _read_text_file(project: Project, path: str) -> str:
    target = resolve_project_path(project, path)
    if not target.exists() or target.is_dir():
        return ""
    return target.read_text(encoding="utf-8")


def _candidate_paths(project: Project, requested_paths: list[str]) -> list[str]:
    if requested_paths:
        return requested_paths[:8]

    preferred_extensions = {".html", ".css", ".js", ".ts", ".tsx", ".py", ".md", ".json"}
    return [
        path
        for path in list_relative_files(project)
        if Path(path).suffix.lower() in preferred_extensions
    ][:8]


def _fallback_changes(project: Project, objective: str, paths: list[str]) -> list[FileChange]:
    target_path = "README.md"
    original = _read_text_file(project, target_path)
    plan = (
        "\n\n## Syntrix Implementation Plan\n\n"
        f"Objective: {objective}\n\n"
        "Next steps:\n"
        "1. Review the affected files.\n"
        "2. Make a focused code change.\n"
        "3. Run the project validation command.\n"
    )
    return [
        FileChange(
            path=target_path,
            action="update" if original else "create",
            summary="Add an implementation plan that can be reviewed before applying.",
            original_content=original,
            proposed_content=(original.rstrip() + plan).lstrip(),
        )
    ]


def _parse_json_changes(project: Project, raw_text: str) -> list[FileChange]:
    data = json.loads(raw_text)
    if isinstance(data, dict):
        data = data.get("changes", [])
    if not isinstance(data, list):
        raise ValueError("AI response did not include a changes list.")

    changes: list[FileChange] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        path = str(item.get("path", "")).strip().replace("\\", "/").strip("/")
        proposed = item.get("proposed_content")
        if not path or not isinstance(proposed, str):
            continue
        original = _read_text_file(project, path)
        changes.append(
            FileChange(
                path=path,
                action="update" if original else "create",
                summary=str(item.get("summary", ""))[:500],
                original_content=original,
                proposed_content=proposed,
            )
        )
    return changes


def propose_file_changes(project: Project, objective: str, paths: list[str], model: str | None = None) -> list[FileChange]:
    candidates = _candidate_paths(project, paths)
    model_id = resolve_model_id(model)
    file_context = [
        {
            "path": path,
            "language": detect_language(path),
            "content": _read_text_file(project, path)[:12000],
        }
        for path in candidates
    ]

    if settings.openai_api_key:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.create(
                model=model_id,
                instructions=(
                    "You are a senior coding agent. Return only valid JSON with a top-level "
                    "'changes' array. Each change needs path, summary, and proposed_content. "
                    "Only propose complete file contents, not patches."
                ),
                input=json.dumps({"objective": objective, "files": file_context}),
            )
            changes = _parse_json_changes(project, response.output_text)
            if changes:
                return changes
        except Exception:
            pass

    return _fallback_changes(project, objective, candidates)


def apply_file_changes(project: Project, changes: list[FileChange]) -> list[str]:
    applied: list[str] = []
    for change in changes:
        target = resolve_project_path(project, change.path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(change.proposed_content, encoding="utf-8")
        applied.append(change.path)
    return applied
