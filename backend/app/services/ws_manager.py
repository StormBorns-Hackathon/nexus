from typing import Dict, Set
from fastapi import WebSocket
import json


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, workflow_id, websocket: WebSocket):
        await websocket.accept()
        key = str(workflow_id)
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)

    def disconnect(self, workflow_id, websocket: WebSocket):
        key = str(workflow_id)
        conns = self.active_connections.get(key)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self.active_connections.pop(key, None)

    async def broadcast(self, workflow_id, message: dict):
        """Broadcast a message to all WebSocket clients for a workflow."""
        key = str(workflow_id)
        conns = self.active_connections.get(key, set())
        data = json.dumps(message, default=str)
        for ws in list(conns):
            try:
                await ws.send_text(data)
            except Exception:
                self.disconnect(workflow_id, ws)


ws_manager = WebSocketManager()
