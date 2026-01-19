"""
Face Deepfake Detection Module
==============================
Uses MobileNet Hybrid model for face deepfake detection.
Exact logic copied from run_mobilenet.py
"""

import base64
import numpy as np
from dataclasses import dataclass
from typing import Optional, Dict
from pathlib import Path

# Model will be loaded on startup
_face_model = None
_face_cascade = None
_face_cascade_alt = None  # Alternative cascade for better detection
_model_loaded = False

# Separate score buffers for different video sources (local, remote, test)
_score_buffers: Dict[str, list] = {}
BUFFER_SIZE = 10  # Buffer for smoothing

# Configuration - threshold at 85%
DEEPFAKE_STRICTNESS = 0.85  # Back to 0.80 like original run_mobilenet.py

@dataclass
class FaceDetectionResult:
    """Result from face deepfake detection"""
    is_fake: bool
    confidence: float
    message: str
    face_detected: bool


def preload_model():
    """Pre-load the model on server startup for faster first detection"""
    global _face_model, _face_cascade, _face_cascade_alt, _model_loaded
    
    if _model_loaded:
        return True
    
    try:
        import tensorflow as tf
        import cv2
        
        print("🔄 Pre-loading face detection model...")
        
        # Try to load models in order of preference
        model_paths = [
            Path(__file__).parent.parent.parent / "MobileNet_Hybrid_Final.h5",
            Path(__file__).parent.parent.parent / "MobileNet_Hybrid.h5",
        ]
        
        for model_path in model_paths:
            if model_path.exists():
                print(f"Loading face model: {model_path}")
                _face_model = tf.keras.models.load_model(str(model_path))
                print(f"✅ Face model loaded: {model_path.name}")
                break
        
        if _face_model is None:
            print("❌ No face detection model found!")
            return False
        
        # Load multiple face cascades for better detection
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        _face_cascade_alt = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
        )
        
        # Warm up the model with a dummy prediction
        dummy = np.zeros((1, 224, 224, 3))
        _face_model.predict(dummy, verbose=0)
        print("✅ Model warmed up and ready!")
        
        _model_loaded = True
        return True
        
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return False


def _load_model():
    """Load the MobileNet model lazily"""
    global _face_model, _face_cascade
    
    if _face_model is None:
        preload_model()
    
    return _face_model, _face_cascade


def detect_face_deepfake(image_bytes: bytes, source: str = "default") -> FaceDetectionResult:
    """
    Detect if an image contains a deepfake face.
    Logic copied exactly from run_mobilenet.py
    
    Args:
        image_bytes: Raw image bytes
        source: Source identifier for separate score buffers (e.g., 'local', 'remote', 'test')
    """
    global _score_buffers, _face_cascade_alt
    import cv2
    
    try:
        model, face_cascade = _load_model()
        
        if model is None:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Model not loaded",
                face_detected=False
            )
        
        # Check if image_bytes is valid
        if image_bytes is None or len(image_bytes) < 100:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Invalid image bytes",
                face_detected=False
            )
        
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        
        if nparr.size == 0:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Empty image buffer",
                face_detected=False
            )
        
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None or frame.size == 0:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Could not decode image",
                face_detected=False
            )
        
        # Get frame dimensions for scaling
        height, width = frame.shape[:2]
        
        # Try multiple face detection methods for better accuracy
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Method 1: Default cascade with original settings (1.3, 5)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))
        
        # Method 2: If no face found, try with more lenient settings
        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
        
        # Method 3: Try alternative cascade
        if len(faces) == 0 and _face_cascade_alt is not None:
            faces = _face_cascade_alt.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
        
        # Method 4: Try with histogram equalization for better contrast
        if len(faces) == 0:
            gray_eq = cv2.equalizeHist(gray)
            faces = face_cascade.detectMultiScale(gray_eq, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
        
        if len(faces) == 0:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="No face detected",
                face_detected=False
            )
        
        # Process largest face (same as run_mobilenet.py)
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        
        # Add some padding around face for better detection
        pad = int(min(w, h) * 0.1)
        x = max(0, x - pad)
        y = max(0, y - pad)
        w = min(width - x, w + 2 * pad)
        h = min(height - y, h + 2 * pad)
        
        face_img = frame[y:y+h, x:x+w]
        
        if face_img.size == 0:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Invalid face region",
                face_detected=False
            )
        
        # Preprocessing EXACTLY like run_mobilenet.py
        resized = cv2.resize(face_img, (224, 224))
        normalized = (resized / 127.5) - 1.0  # Exact same as run_mobilenet.py
        input_batch = np.expand_dims(normalized, axis=0)
        
        # Predict
        prediction = model.predict(input_batch, verbose=0)[0][0]
        prediction = float(prediction)
        
        # Initialize buffer for this source if not exists
        if source not in _score_buffers:
            _score_buffers[source] = []
        
        # Score buffer for smoothing (like run_mobilenet.py)
        _score_buffers[source].append(prediction)
        if len(_score_buffers[source]) > BUFFER_SIZE:
            _score_buffers[source].pop(0)
        
        avg_score = sum(_score_buffers[source]) / len(_score_buffers[source])
        
        # INVERTED LOGIC: Higher score = MORE likely to be FAKE
        # Real faces get lower scores (~0.80), Deepfakes get higher scores (~0.88+)
        is_fake = bool(avg_score >= DEEPFAKE_STRICTNESS)
        
        if is_fake:
            message = f"⚠️ DEEPFAKE DETECTED ({avg_score:.2f})"
        else:
            message = f"✅ GENUINE FACE ({avg_score:.2f})"
        
        return FaceDetectionResult(
            is_fake=is_fake,
            confidence=float(avg_score),
            message=message,
            face_detected=True
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return FaceDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error: {str(e)}",
            face_detected=False
        )


def detect_face_from_base64(base64_string: str, source: str = "default") -> FaceDetectionResult:
    """
    Detect face deepfake from a base64 encoded image.
    
    Args:
        base64_string: Base64 encoded image string
        source: Source identifier for separate score buffers (e.g., 'local', 'remote', 'test')
    """
    try:
        if not base64_string or len(base64_string) < 100:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Invalid image data",
                face_detected=False
            )
        
        # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        if "," in base64_string:
            base64_string = base64_string.split(",", 1)[1]
        
        # Clean up the base64 string
        base64_string = base64_string.strip()
        
        # Add padding if needed
        padding = 4 - len(base64_string) % 4
        if padding != 4:
            base64_string += "=" * padding
        
        image_bytes = base64.b64decode(base64_string)
        
        if len(image_bytes) < 100:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Image data too small",
                face_detected=False
            )
        
        return detect_face_deepfake(image_bytes, source=source)
        
    except Exception as e:
        print(f"Base64 decode error: {e}")
        return FaceDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error processing image: {str(e)}",
            face_detected=False
        )
