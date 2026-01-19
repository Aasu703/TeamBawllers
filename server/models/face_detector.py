"""
Face Deepfake Detection Module
==============================
Uses MobileNet Hybrid model for face deepfake detection.
"""

import base64
import io
import numpy as np
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

# Model will be loaded lazily
_face_model = None
_face_cascade = None

@dataclass
class FaceDetectionResult:
    """Result from face deepfake detection"""
    is_fake: bool
    confidence: float  # 0.0 to 1.0 (higher = more likely real)
    message: str
    face_detected: bool


def _load_model():
    """Load the MobileNet model lazily"""
    global _face_model, _face_cascade
    
    if _face_model is None:
        import tensorflow as tf
        import cv2
        
        # Try to load models in order of preference
        model_paths = [
            Path(__file__).parent.parent.parent / "MobileNet_Hybrid_Final.h5",
            Path(__file__).parent.parent.parent / "MobileNet_Hybrid_v2.h5",
            Path(__file__).parent.parent.parent / "MobileNet_Hybrid.h5",
        ]
        
        for model_path in model_paths:
            if model_path.exists():
                print(f"Loading face model: {model_path}")
                _face_model = tf.keras.models.load_model(str(model_path))
                print(f"✅ Face model loaded: {model_path.name}")
                break
        
        if _face_model is None:
            raise FileNotFoundError("No face detection model found!")
        
        # Load face cascade
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    return _face_model, _face_cascade


def detect_face_deepfake(image_bytes: bytes) -> FaceDetectionResult:
    """
    Detect if an image contains a deepfake face.
    
    Args:
        image_bytes: Raw image bytes (JPEG/PNG)
    
    Returns:
        FaceDetectionResult with detection info
    """
    import cv2
    import numpy as np
    
    try:
        model, face_cascade = _load_model()
        
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Could not decode image",
                face_detected=False
            )
        
        # Detect faces
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return FaceDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="No face detected",
                face_detected=False
            )
        
        # Process largest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        face_img = frame[y:y+h, x:x+w]
        
        # Preprocess for model
        resized = cv2.resize(face_img, (224, 224))
        normalized = (resized / 127.5) - 1.0
        input_batch = np.expand_dims(normalized, axis=0)
        
        # Predict
        prediction = model.predict(input_batch, verbose=0)[0][0]
        
        # Threshold for real vs fake (higher score = more real)
        THRESHOLD = 0.80
        is_fake = prediction < THRESHOLD
        
        if is_fake:
            message = f"⚠️ Potential deepfake face detected ({(1-prediction)*100:.1f}% fake confidence)"
        else:
            message = f"✅ Face appears authentic ({prediction*100:.1f}% real confidence)"
        
        return FaceDetectionResult(
            is_fake=is_fake,
            confidence=float(prediction),
            message=message,
            face_detected=True
        )
        
    except Exception as e:
        return FaceDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error: {str(e)}",
            face_detected=False
        )


def detect_face_from_base64(base64_string: str) -> FaceDetectionResult:
    """
    Detect face deepfake from a base64 encoded image.
    """
    try:
        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        image_bytes = base64.b64decode(base64_string)
        return detect_face_deepfake(image_bytes)
        
    except Exception as e:
        return FaceDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error processing image: {str(e)}",
            face_detected=False
        )
