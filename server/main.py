from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import AI models
from models.detector import (
    detect_deepfake, 
    detect_from_base64, 
    DetectionResult,
    detect_face_from_base64,
    detect_audio_from_base64,
    detect_audio_from_pcm,
    FaceDetectionResult,
    AudioDetectionResult,
)

app = FastAPI(title="Cyber Guardian AI Gateway - Deepfake Detection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Face Deepfake Detection Endpoints
# ============================================

class FrameData(BaseModel):
    frame: str  # base64 encoded image


class AudioData(BaseModel):
    audio: str  # base64 encoded audio


@app.post("/api/detect")
async def detect_frame(data: FrameData):
    """
    Detect deepfake from a base64 encoded image frame.
    Uses MobileNet Hybrid model for face deepfake detection.
    """
    result = detect_from_base64(data.frame)
    return {
        "is_fake": result.is_fake,
        "confidence": result.confidence,
        "message": result.message,
        "face_detected": result.face_result.face_detected if result.face_result else False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/detect/face")
async def detect_face(data: FrameData):
    """
    Dedicated face deepfake detection endpoint.
    """
    result = detect_face_from_base64(data.frame)
    return {
        "is_fake": result.is_fake,
        "confidence": result.confidence,
        "message": result.message,
        "face_detected": result.face_detected,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ============================================
# Audio Deepfake Detection Endpoints
# ============================================

@app.post("/api/detect/audio")
async def detect_audio(data: AudioData):
    """
    Detect deepfake from base64 encoded audio.
    Uses trained Keras model for audio deepfake detection.
    """
    result = detect_audio_from_base64(data.audio)
    return {
        "is_fake": result.is_fake,
        "confidence": result.confidence,
        "message": result.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/detect/upload")
async def detect_upload(file: UploadFile = File(...)):
    """
    Detect deepfake from uploaded image file.
    """
    contents = await file.read()
    result = detect_deepfake(contents)
    return {
        "is_fake": result.is_fake,
        "confidence": result.confidence,
        "message": result.message,
        "filename": file.filename,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/detect/audio/upload")
async def detect_audio_upload(file: UploadFile = File(...)):
    """
    Detect deepfake from uploaded audio file.
    """
    from models.audio_detector import detect_audio_deepfake
    
    contents = await file.read()
    result = detect_audio_deepfake(contents)
    return {
        "is_fake": result.is_fake,
        "confidence": result.confidence,
        "message": result.message,
        "filename": file.filename,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "models": {
            "face": "MobileNet_Hybrid",
            "audio": "deepfake_detector.keras"
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ============================================
# Frame Analysis (Local fallback)
# ============================================


def _analyze_frame(frame_b64: str, sent_at_ms: float) -> dict[str, object]:
    now_ms = time.time() * 1000
    replay = now_ms - sent_at_ms > 2000
    # Basic stub heuristic: longer payloads + randomness => confidence.
    payload = frame_b64.split(",")[-1]
    try:
        decoded = base64.b64decode(payload, validate=True)
    except Exception:
        return {
            "is_fake": True,
            "confidence": 0.99,
            "alert_msg": "Invalid frame encoding",
        }

    entropy_hint = min(len(set(decoded[:512])), 64) / 64
    noise = secrets.randbelow(20) / 100
    confidence = min(0.5 + entropy_hint + noise, 0.99)

    if replay:
        return {
          "is_fake": True,
          "confidence": max(confidence, 0.85),
          "alert_msg": "Potential Replay Attack: frame older than 2s",
        }

    is_fake = confidence > 0.75
    alert = "Anomaly detected" if is_fake else "Frame appears authentic"
    return {
        "is_fake": is_fake,
        "confidence": round(confidence, 3),
        "alert_msg": alert,
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            try:
                payload = json.loads(data)
                frame = payload.get("frame")
                sent_at = float(payload.get("sent_at", 0))
            except (ValueError, TypeError):
                await ws.send_json({"is_fake": True, "confidence": 0.99, "alert_msg": "Bad payload"})
                continue

            # Use AI model for detection
            result = _analyze_frame(frame or "", sent_at)
            result["timestamp"] = datetime.now(timezone.utc).isoformat()
            await ws.send_json(result)
            await asyncio.sleep(0)
    except WebSocketDisconnect:
        return


# Conference room state: meetingId -> dict of peerId -> websocket
conference_rooms: dict[str, dict[str, WebSocket]] = {}


@app.websocket("/conference")
async def conference_endpoint(ws: WebSocket):
    await ws.accept()
    meeting_id: str | None = None
    peer_id: str = secrets.token_hex(4)
    
    try:
        while True:
            data = await ws.receive_text()
            try:
                payload = json.loads(data)
                msg_type = payload.get("type")

                if msg_type == "join":
                    meeting_id = payload.get("meetingId")
                    if not meeting_id:
                        await ws.send_json({"type": "error", "message": "Meeting ID required"})
                        continue

                    if meeting_id not in conference_rooms:
                        conference_rooms[meeting_id] = {}
                    
                    # Get existing peers before adding new one
                    existing_peers = list(conference_rooms[meeting_id].keys())
                    
                    # Add new peer
                    conference_rooms[meeting_id][peer_id] = ws

                    # Send joined confirmation with peer list
                    await ws.send_json({
                        "type": "joined",
                        "peerId": peer_id,
                        "existingPeers": existing_peers,
                        "participantCount": len(conference_rooms[meeting_id]),
                    })

                    # Notify all existing peers about new participant
                    for other_peer_id, peer_ws in conference_rooms[meeting_id].items():
                        if other_peer_id != peer_id:
                            await peer_ws.send_json({
                                "type": "peer-joined",
                                "peerId": peer_id,
                                "participantCount": len(conference_rooms[meeting_id]),
                            })

                elif msg_type in ("offer", "answer", "ice-candidate"):
                    target_peer_id = payload.get("targetPeerId")
                    meeting_id = payload.get("meetingId")
                    
                    if not meeting_id or meeting_id not in conference_rooms:
                        continue

                    # If target specified, send only to that peer
                    if target_peer_id and target_peer_id in conference_rooms[meeting_id]:
                        payload["fromPeerId"] = peer_id
                        await conference_rooms[meeting_id][target_peer_id].send_json(payload)
                    else:
                        # Broadcast to all peers except sender
                        for other_peer_id, peer_ws in conference_rooms[meeting_id].items():
                            if other_peer_id != peer_id:
                                payload["fromPeerId"] = peer_id
                                await peer_ws.send_json(payload)

            except (ValueError, TypeError):
                await ws.send_json({"type": "error", "message": "Invalid payload"})
                continue

    except WebSocketDisconnect:
        if meeting_id and meeting_id in conference_rooms:
            if peer_id in conference_rooms[meeting_id]:
                del conference_rooms[meeting_id][peer_id]
            # Notify remaining peers that someone left
            for other_peer_id, peer_ws in conference_rooms.get(meeting_id, {}).items():
                try:
                    await peer_ws.send_json({
                        "type": "peer-left",
                        "peerId": peer_id,
                        "participantCount": len(conference_rooms.get(meeting_id, {})),
                    })
                except:
                    pass
            if not conference_rooms.get(meeting_id):
                del conference_rooms[meeting_id]
        return


# API endpoint to check room status
@app.get("/api/room/{meeting_id}")
async def get_room_info(meeting_id: str):
    if meeting_id in conference_rooms:
        return {
            "exists": True,
            "participantCount": len(conference_rooms[meeting_id]),
            "maxParticipants": 10,
        }
    return {"exists": False, "participantCount": 0, "maxParticipants": 10}
