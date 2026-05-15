from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from uuid import UUID
from app.services.ws_manager import ws_manager

router = APIRouter()

@router.websocket("/workflows/{workflow_id}")
async def workflow_ws(websocket: WebSocket, workflow_id: UUID):
    await ws_manager.connect(workflow_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(workflow_id, websocket)
