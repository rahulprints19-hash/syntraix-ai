from __future__ import annotations

import asyncio
from pathlib import Path
import re
import time

from app.core.config import get_settings

settings = get_settings()

BLOCKED_PATTERNS = [
    "rm ",
    "rm\t",
    "del ",
    "shutdown",
    "format ",
    "mkfs",
    "git reset --hard",
    "git clean -fd",
    "sudo ",
    "su ",
    "chmod ",
    "chown ",
    "docker ",
]


def validate_command(command: str) -> None:
    normalized = command.strip().lower()
    if not normalized:
        raise ValueError("Command is required.")
    if len(command) > 500:
        raise ValueError("Command is too long.")
    if "\x00" in command or "\n" in command or "\r" in command:
        raise ValueError("Multi-line commands are not allowed.")
    if re.search(r"(^|[;&|]\s*)cd\s+(\.\.|/|~)", normalized):
        raise ValueError("Changing outside the project directory is not allowed.")
    if ".." in normalized:
        raise ValueError("Parent-directory traversal is not allowed.")

    for pattern in BLOCKED_PATTERNS:
        if pattern in normalized:
            raise ValueError(f"Blocked command pattern: {pattern.strip()}")


async def run_command(command: str, cwd: Path, timeout_seconds: int) -> dict[str, object]:
    validate_command(command)
    started_at = time.perf_counter()

    process = await asyncio.create_subprocess_shell(
        command,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        exit_code = process.returncode
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        stdout = b""
        stderr = b"Command timed out."
        exit_code = 124

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    return {
        "command": command,
        "exit_code": exit_code,
        "stdout": stdout.decode("utf-8", errors="ignore"),
        "stderr": stderr.decode("utf-8", errors="ignore"),
        "duration_ms": duration_ms,
    }
