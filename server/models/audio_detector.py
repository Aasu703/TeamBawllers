"""
Audio Deepfake Detection Module
===============================
Uses trained Keras model for audio deepfake detection.
"""

import base64
import io
import numpy as np
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

# Model loaded lazily
_audio_model = None

# Constants matching training
SAMPLE_RATE = 16000
N_MFCC = 128

@dataclass
class AudioDetectionResult:
    """Result from audio deepfake detection"""
    is_fake: bool
    confidence: float  # 0.0 to 1.0 (higher = more likely human/real)
    message: str


def _load_audio_model():
    """Load the audio deepfake model lazily"""
    global _audio_model
    
    if _audio_model is None:
        import tensorflow as tf
        
        model_path = Path(__file__).parent.parent.parent / "deepfake_detector.keras"
        
        if not model_path.exists():
            raise FileNotFoundError(f"Audio model not found: {model_path}")
        
        print(f"Loading audio model: {model_path}")
        _audio_model = tf.keras.models.load_model(str(model_path))
        print("✅ Audio model loaded!")
    
    return _audio_model


def detect_audio_deepfake(audio_bytes: bytes, sample_rate: int = SAMPLE_RATE) -> AudioDetectionResult:
    """
    Detect if audio is deepfake/AI-generated.
    
    Args:
        audio_bytes: Raw audio bytes (WAV format preferred)
        sample_rate: Audio sample rate
    
    Returns:
        AudioDetectionResult with detection info
    """
    import librosa
    
    try:
        model = _load_audio_model()
        
        # Load audio from bytes
        audio_io = io.BytesIO(audio_bytes)
        audio, sr = librosa.load(audio_io, sr=SAMPLE_RATE)
        
        # Normalize audio
        max_val = np.max(np.abs(audio))
        if max_val > 0.001:
            audio = audio / max_val
        
        # Extract MFCCs
        mfccs = librosa.feature.mfcc(y=audio, sr=SAMPLE_RATE, n_mfcc=N_MFCC)
        
        # Match expected input shape
        expected_width = model.input_shape[2]
        if mfccs.shape[1] < expected_width:
            mfccs = np.pad(mfccs, ((0, 0), (0, expected_width - mfccs.shape[1])))
        else:
            mfccs = mfccs[:, :expected_width]
        
        mfccs = mfccs[np.newaxis, ..., np.newaxis]
        
        # Predict
        prediction = model.predict(mfccs, verbose=0)
        score = float(prediction[0][0])
        
        # High score = human, low score = fake
        HUMAN_THRESHOLD = 0.98
        is_fake = score < HUMAN_THRESHOLD
        
        if is_fake:
            message = f"🚨 AI-generated audio detected ({(1-score)*100:.1f}% fake confidence)"
        else:
            message = f"✅ Human voice detected ({score*100:.1f}% human confidence)"
        
        return AudioDetectionResult(
            is_fake=is_fake,
            confidence=score,
            message=message
        )
        
    except Exception as e:
        return AudioDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error: {str(e)}"
        )


def detect_audio_from_base64(base64_string: str) -> AudioDetectionResult:
    """
    Detect audio deepfake from base64 encoded audio.
    """
    try:
        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        audio_bytes = base64.b64decode(base64_string)
        return detect_audio_deepfake(audio_bytes)
        
    except Exception as e:
        return AudioDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error processing audio: {str(e)}"
        )


def detect_audio_from_pcm(pcm_data: bytes, sample_rate: int = SAMPLE_RATE) -> AudioDetectionResult:
    """
    Detect audio deepfake from raw PCM data (float32).
    Used for real-time audio streams.
    """
    import librosa
    
    try:
        model = _load_audio_model()
        
        # Convert PCM bytes to numpy array (assuming float32)
        audio = np.frombuffer(pcm_data, dtype=np.float32)
        
        # Check if we have enough audio (need ~3 seconds)
        min_samples = int(SAMPLE_RATE * 2.0)  # At least 2 seconds
        if len(audio) < min_samples:
            return AudioDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Audio too short for analysis"
            )
        
        # Normalize
        max_val = np.max(np.abs(audio))
        if max_val > 0.001:
            audio = audio / max_val
        else:
            return AudioDetectionResult(
                is_fake=False,
                confidence=0.0,
                message="Audio too quiet"
            )
        
        # Extract MFCCs
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=N_MFCC)
        
        # Match expected input shape
        expected_width = model.input_shape[2]
        if mfccs.shape[1] < expected_width:
            mfccs = np.pad(mfccs, ((0, 0), (0, expected_width - mfccs.shape[1])))
        else:
            mfccs = mfccs[:, :expected_width]
        
        mfccs = mfccs[np.newaxis, ..., np.newaxis]
        
        # Predict
        prediction = model.predict(mfccs, verbose=0)
        score = float(prediction[0][0])
        
        HUMAN_THRESHOLD = 0.98
        is_fake = score < HUMAN_THRESHOLD
        
        if is_fake:
            message = f"🚨 AI voice ({(1-score)*100:.1f}% fake)"
        else:
            message = f"✅ Human ({score*100:.1f}%)"
        
        return AudioDetectionResult(
            is_fake=is_fake,
            confidence=score,
            message=message
        )
        
    except Exception as e:
        return AudioDetectionResult(
            is_fake=False,
            confidence=0.0,
            message=f"Error: {str(e)}"
        )
