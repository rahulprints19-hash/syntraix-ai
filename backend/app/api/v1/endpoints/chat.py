from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_project_for_user
from app.db.session import get_db_session
from app.models import ChatMessage, ChatThread, User
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatThreadResponse,
    ChatThreadUpdateRequest,
)
from app.services.ai import resolve_model_id
from app.services.ai import stream_chat_reply
from app.services.saas import record_usage_event

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/threads", response_model=list[ChatThreadResponse])
async def list_threads(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ChatThreadResponse]:
    result = await session.execute(
        select(ChatThread).where(ChatThread.user_id == user.id).order_by(ChatThread.updated_at.desc())
    )
    threads = result.scalars().all()
    return [
        ChatThreadResponse(id=thread.id, title=thread.title, project_id=thread.project_id, updated_at=thread.updated_at)
        for thread in threads
    ]


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
async def list_thread_messages(
    thread_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ChatMessageResponse]:
    thread_result = await session.execute(
        select(ChatThread).where(ChatThread.id == thread_id, ChatThread.user_id == user.id)
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found.")

    result = await session.execute(
        select(ChatMessage).where(ChatMessage.thread_id == thread.id).order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        ChatMessageResponse(
            id=message.id,
            role=message.role,
            content=message.content,
            created_at=message.created_at,
        )
        for message in messages
    ]


@router.patch("/threads/{thread_id}", response_model=ChatThreadResponse)
async def update_thread(
    thread_id: str,
    payload: ChatThreadUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ChatThreadResponse:
    result = await session.execute(
        select(ChatThread).where(ChatThread.id == thread_id, ChatThread.user_id == user.id)
    )
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found.")

    thread.title = payload.title
    thread.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(thread)
    return ChatThreadResponse(
        id=thread.id,
        title=thread.title,
        project_id=thread.project_id,
        updated_at=thread.updated_at,
    )


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    result = await session.execute(
        select(ChatThread).where(ChatThread.id == thread_id, ChatThread.user_id == user.id)
    )
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found.")

    message_result = await session.execute(select(ChatMessage).where(ChatMessage.thread_id == thread.id))
    for message in message_result.scalars().all():
        await session.delete(message)
    await session.delete(thread)
    await session.commit()


@router.post("/stream")
async def stream_chat(
    payload: ChatMessageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    project = None
    if payload.project_id:
        project = await get_project_for_user(payload.project_id, session, user)

    if payload.thread_id:
        thread_result = await session.execute(
            select(ChatThread).where(ChatThread.id == payload.thread_id, ChatThread.user_id == user.id)
        )
        thread = thread_result.scalar_one_or_none()
        if thread is None:
            raise HTTPException(status_code=404, detail="Thread not found.")
        if payload.project_id and thread.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail="Thread does not belong to the selected project.")
    else:
        title = payload.message.strip()[:48] or "New conversation"
        thread = ChatThread(user_id=user.id, project_id=payload.project_id, title=title)
        session.add(thread)
        await session.flush()

    user_message = ChatMessage(thread_id=thread.id, role="user", content=payload.message)
    session.add(user_message)
    thread.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(thread)

    async def event_stream():
        assistant_chunks: list[str] = []
        for chunk in stream_chat_reply(user_message=payload.message, project=project, model=payload.model):
            assistant_chunks.append(chunk)
            yield f"data: {json.dumps({'type': 'delta', 'delta': chunk, 'threadId': thread.id})}\n\n"

        assistant_content = "".join(assistant_chunks).strip()
        assistant_message = ChatMessage(thread_id=thread.id, role="assistant", content=assistant_content)
        session.add(assistant_message)
        await record_usage_event(
            session,
            user=user,
            project_id=project.id if project else None,
            feature="chat",
            model=resolve_model_id(payload.model),
            prompt_text=payload.message,
            completion_text=assistant_content,
            status="success",
        )
        thread.updated_at = datetime.now(timezone.utc)
        await session.commit()

        yield f"data: {json.dumps({'type': 'done', 'threadId': thread.id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.websocket("/ws")
async def chat_runtime_socket(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
        await websocket.send_json({"type": "connected", "message": "Syntrix runtime socket is online."})
        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type", "ping")
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json(
                    {
                        "type": "ack",
                        "received": message_type,
                        "message": "Runtime WebSocket is ready for future agent and terminal events.",
                    }
                )
    except WebSocketDisconnect:
        return
