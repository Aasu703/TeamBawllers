import time
import queue
import numpy as np
import sounddevice as sd
import librosa
import tensorflow as tf
import datetime # Added for timestamps

# --- CONSTANTS ---
SAMPLE_RATE = 16000
DURATION = 3.0  # <--- CHANGED TO 3.0 SECONDS (The interval you asked for)
N_MFCC = 128
BLOCK_SIZE = int(SAMPLE_RATE * DURATION)

# --- SENSITIVITY SETTINGS ---
HUMAN_THRESHOLD = 0.98 

print("⏳ Loading Brain...")
model = tf.keras.models.load_model("deepfake_detector.keras")
print("✅ Brain Loaded!")

# Queue to hold audio
audio_queue = queue.Queue()

def audio_callback(indata, frames, time, status):
    """Fast callback: Just grabs audio and throws it in the bucket."""
    if status:
        print(f"⚠️ Mic Status: {status}")
    audio_queue.put(indata.copy())

def normalize_audio(audio):
    """Boosts mic volume to match training data."""
    max_val = np.max(np.abs(audio))
    if max_val < 0.001: 
        return audio 
    return audio / max_val

def predict_loop():
    print(f"\n🛡️ STRICT MODE ACTIVE (Threshold: {HUMAN_THRESHOLD*100}%)")
    print(f"🎤 LISTENING... (One check every {DURATION} seconds)")
    print("Press Ctrl+C to stop.\n")
    print("-" * 60) # Visual separator
    
    while True:
        try:
            # 1. Get Audio from Queue (Wait if empty)
            # This line naturally waits for 3 seconds of audio to arrive
            indata = audio_queue.get()
            
            # 2. Volume Gate (Skip silence)
            vol = np.max(np.abs(indata))
            if vol < 0.01:
                # Optional: Print a small dot to show it's alive but silent
                # print(".", end="", flush=True) 
                continue

            # 3. Process & Normalize
            audio = indata.flatten()
            audio = normalize_audio(audio) 
            
            mfccs = librosa.feature.mfcc(y=audio, sr=SAMPLE_RATE, n_mfcc=N_MFCC)
            
            # Shape Fix
            expected_width = model.input_shape[2]
            if mfccs.shape[1] < expected_width:
                mfccs = np.pad(mfccs, ((0,0), (0, expected_width - mfccs.shape[1])))
            else:
                mfccs = mfccs[:, :expected_width]
            
            mfccs = mfccs[np.newaxis, ..., np.newaxis]
            
            # 4. Predict
            prediction = model.predict(mfccs, verbose=0)
            score = prediction[0][0] 
            
            # 5. Display Result (LOG STYLE)
            # Get current time for the log
            timestamp = datetime.datetime.now().strftime("%H:%M:%S")

            if score >= HUMAN_THRESHOLD:
                # Print a clean new line for every check
                print(f"[{timestamp}] ✅ HUMAN | Score: {score:.4f}")
            else:
                print(f"[{timestamp}] 🚨 FAKE  | Score: {score:.4f}")

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

# --- MAIN EXECUTION ---
try:
    with sd.InputStream(callback=audio_callback, 
                        channels=1, 
                        samplerate=SAMPLE_RATE, 
                        blocksize=BLOCK_SIZE):
        
        # Run the main loop
        predict_loop()
        
except KeyboardInterrupt:
    print("\nStopped.")
except Exception as e:
    print(f"\n❌ Mic Error: {e}")