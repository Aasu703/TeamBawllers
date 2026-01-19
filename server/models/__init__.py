"""
Models package for deepfake detection.
"""

from .detector import (
    DetectionResult,
    FaceDetectionResult,
    AudioDetectionResult,
    detect_deepfake,
    detect_from_base64,
    detect_face_deepfake,
    detect_face_from_base64,
    detect_audio_deepfake,
    detect_audio_from_base64,
    detect_audio_from_pcm,
)

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