from typing import Dict, Set
from fastapi import WebSocket
from uuid import UUID
import json

class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}

    async def connect(self, workflow_id: UUID, websocket: WebSocket):
        await websocket.accept()
        if workflow_id not in self.active_connections:
            self.active_connections[workflow_id] = set()
        self.active_connections[workflow_id].add(websocket)

    def disconnect(self, workflow_id: UUID, websocket: WebSocket):
        conns = self.active_connections.get(workflow_id)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self.active_connections.pop(workflow_id, None)

    async def send_json(self, workflow_id: UUID, message: dict):
        conns = self.active_connections.get(workflow_id, set())
        data = json.dumps(message, default=str)
        for ws in list(conns):
            try:
                await ws.send_text(data)
            except Exception:
                self.disconnect(workflow_id, ws)

ws_manager = WebSocketManager()
