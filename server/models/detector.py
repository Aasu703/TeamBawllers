"""
Deepfake Detection Module
=========================
Unified detection interface combining face and audio deepfake detection.
"""

import base64
from dataclasses import dataclass
from typing import Optional

# Import specialized detectors
from .face_detector import (
    detect_face_deepfake, 
    detect_face_from_base64, 
    FaceDetectionResult
)
from .audio_detector import (
    detect_audio_deepfake, 
    detect_audio_from_base64,
    detect_audio_from_pcm,
    AudioDetectionResult
)


@dataclass
class DetectionResult:
    """Combined result from deepfake detection"""
    is_fake: bool
    confidence: float  # 0.0 to 1.0
    message: str
    face_result: Optional[FaceDetectionResult] = None
    audio_result: Optional[AudioDetectionResult] = None


def detect_deepfake(image_bytes: bytes) -> DetectionResult:
    """
    Detect if an image contains a deepfake (face detection).
    
    Args:
        image_bytes: Raw image bytes (JPEG/PNG)
    
    Returns:
        DetectionResult with is_fake, confidence, and message
    """
    face_result = detect_face_deepfake(image_bytes)
    
    return DetectionResult(
        is_fake=face_result.is_fake,
        confidence=face_result.confidence,
        message=face_result.message,
        face_result=face_result
    )


def detect_from_base64(base64_string: str) -> DetectionResult:
    """
    Detect deepfake from a base64 encoded image.
    """
    face_result = detect_face_from_base64(base64_string)
    
    return DetectionResult(
        is_fake=face_result.is_fake,
        confidence=face_result.confidence,
        message=face_result.message,
        face_result=face_result
    )


# Re-export for convenience
__all__ = [
    'DetectionResult',
    'FaceDetectionResult', 
    'AudioDetectionResult',
    'detect_deepfake',
    'detect_from_base64',
    'detect_face_deepfake',
    'detect_face_from_base64',
    'detect_audio_deepfake',
    'detect_audio_from_base64',
    'detect_audio_from_pcm',
]
