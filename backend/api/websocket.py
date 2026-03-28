import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Manage WebSocket connections for job log streaming."""

    def __init__(self):
        # Map job_id to set of connected websockets
        self.job_connections: Dict[str, Set[WebSocket]] = {}
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        self.active_connections.add(websocket)
        if job_id not in self.job_connections:
            self.job_connections[job_id] = set()
        self.job_connections[job_id].add(websocket)

    def disconnect(self, websocket: WebSocket, job_id: str):
        self.active_connections.discard(websocket)
        if job_id in self.job_connections:
            self.job_connections[job_id].discard(websocket)
            if not self.job_connections[job_id]:
                del self.job_connections[job_id]

    async def send_job_update(self, job_id: str, message: dict):
        """Send update to all connections subscribed to a job."""
        if job_id not in self.job_connections:
            return
        disconnected = set()
        for connection in self.job_connections[job_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn, job_id)

    async def broadcast(self, message: dict):
        """Broadcast to all connected clients."""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        for conn in disconnected:
            self.active_connections.discard(conn)


manager = ConnectionManager()


async def send_progress_update(
    job_id: str,
    stage: str,
    message: str,
    progress: dict = None
):
    """Send a progress update to all subscribers of a job."""
    payload = {
        "type": "progress",
        "job_id": job_id,
        "stage": stage,
        "message": message,
        "timestamp": asyncio.get_event_loop().time(),
        "progress": progress or {}
    }
    await manager.send_job_update(job_id, payload)


async def send_asset_update(
    job_id: str,
    asset_id: str,
    status: str,
    metadata: dict = None
):
    """Send an update about a specific asset."""
    payload = {
        "type": "asset_update",
        "job_id": job_id,
        "asset_id": asset_id,
        "status": status,
        "metadata": metadata or {},
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.send_job_update(job_id, payload)


async def send_stage_complete(
    job_id: str,
    stage: str,
    stats: dict = None
):
    """Send notification that a stage completed."""
    payload = {
        "type": "stage_complete",
        "job_id": job_id,
        "stage": stage,
        "stats": stats or {},
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.send_job_update(job_id, payload)


async def send_error(job_id: str, error: str, stage: str = None):
    """Send an error notification."""
    payload = {
        "type": "error",
        "job_id": job_id,
        "error": error,
        "stage": stage,
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.send_job_update(job_id, payload)


async def send_job_complete(job_id: str, stats: dict = None):
    """Send a job completion notification (distinct 'completed' type for frontend to detect)."""
    payload = {
        "type": "completed",
        "job_id": job_id,
        "stats": stats or {},
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.send_job_update(job_id, payload)


async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for job log streaming."""
    await manager.connect(websocket, job_id)
    try:
        while True:
            # Keep connection alive and handle client pings
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
