from pathlib import Path

from app.models import Project
from app.schemas.deploy import DeployFile
from app.services.workspace import ensure_project_directory


def export_deployment_files(project: Project, targets: list[str]) -> list[DeployFile]:
    project_root = ensure_project_directory(project)
    generated_files: list[DeployFile] = []

    target_map = {
        "docker": ("Dockerfile", _dockerfile_content(project.name)),
        "render": ("render.yaml", _render_yaml_content(project.name)),
        "vercel": ("vercel.json", _vercel_json_content()),
    }

    for target in targets:
        if target not in target_map:
            continue
        relative_path, content = target_map[target]
        file_path = project_root / relative_path
        file_path.write_text(content, encoding="utf-8")
        generated_files.append(DeployFile(path=relative_path, content=content))

    return generated_files


def _dockerfile_content(project_name: str) -> str:
    return f"""FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
# Generated for {project_name}
"""


def _render_yaml_content(project_name: str) -> str:
    return f"""services:
  - type: web
    name: {project_name.lower().replace(' ', '-')}-web
    env: static
    buildCommand: ""
    staticPublishPath: .
"""


def _vercel_json_content() -> str:
    return """{
  "framework": null,
  "buildCommand": "",
  "outputDirectory": ".",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
"""
