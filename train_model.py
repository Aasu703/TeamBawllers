import os
import numpy as np
import librosa
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization
from sklearn.utils import shuffle

# --- SETTINGS ---
# Double check these folder names exist exactly as written!
BASE_CLEAN = "hackathon-training/for-2sec/for-2seconds"
BASE_NOISY = "hackathon-training/for-rerec/for-rerecorded"

SAMPLE_RATE = 16000
DURATION = 2.0
N_MFCC = 128
MAX_FILES_PER_TYPE = 2500 

def extract_features(file_path):
    try:
        # 1. Load Audio
        audio, _ = librosa.load(file_path, sr=SAMPLE_RATE, duration=DURATION)
        
        # 2. Pad/Truncate
        target_len = int(SAMPLE_RATE * DURATION)
        if len(audio) < target_len:
            audio = np.pad(audio, (0, target_len - len(audio)))
        else:
            audio = audio[:target_len]
            
        # 3. CRITICAL NORMALIZATION FIX
        # This matches the "normalize_audio" in your mic script.
        # Without this, the training data is "louder" than the mic data.
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            audio = audio / max_val

        # 4. MFCC
        mfccs = librosa.feature.mfcc(y=audio, sr=SAMPLE_RATE, n_mfcc=N_MFCC)
        return mfccs
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def load_data_from_folder(base_dir, limit):
    X, y = [], []
    classes = {'fake': 0, 'real': 1} 
    
    if not os.path.exists(base_dir):
        print(f"⚠️ PATH NOT FOUND: {base_dir}")
        return [], []

    # Handle different folder structures (training vs just root)
    search_path = os.path.join(base_dir, "training")
    if not os.path.exists(search_path):
        search_path = base_dir # Fallback
    
    print(f"📂 Looking in: {search_path}")
    
    for label_name, label_idx in classes.items():
        folder = os.path.join(search_path, label_name)
        
        # DEBUG: Check if specific class folder exists
        if not os.path.exists(folder):
            print(f"   ❌ MISSING FOLDER: {label_name} (Expected at: {folder})")
            continue
            
        files = os.listdir(folder)
        print(f"   ✅ Found {len(files)} files in '{label_name}'")
        
        np.random.shuffle(files)
        
        count = 0
        for file in files:
            if count >= limit: break
            if not file.lower().endswith(('.wav', '.mp3', '.flac')): continue # Skip non-audio
            
            path = os.path.join(folder, file)
            features = extract_features(path)
            
            if features is not None:
                X.append(features)
                y.append(label_idx)
                count += 1
                
        print(f"      -> Loaded {count} features for '{label_name}'")
        
    return X, y

# --- 1. LOAD DATA ---
print("--- STARTING DATA LOAD ---")

# Load Training Data
X_c, y_c = load_data_from_folder(BASE_CLEAN, MAX_FILES_PER_TYPE)
X_n, y_n = load_data_from_folder(BASE_NOISY, MAX_FILES_PER_TYPE)

X_train = np.array(X_c + X_n)
y_train = np.array(y_c + y_n)

# --- DEBUG: CHECK BALANCE ---
num_real = np.sum(y_train == 1)
num_fake = np.sum(y_train == 0)
print(f"\n📊 DATA STATS: Real: {num_real} | Fake: {num_fake}")

if num_fake == 0:
    print("🚨 ERROR: You have 0 FAKE files loaded! The model will only predict HUMAN.")
    print("Check your folder names. Is it 'fake' or 'fake_audio'?")
    exit() # Stop script

# Shuffle
X_train, y_train = shuffle(X_train, y_train, random_state=42)
X_train = X_train[..., np.newaxis]

print(f"🔥 Training Shape: {X_train.shape}")

# --- 2. BUILD MODEL ---
model = Sequential([
    # Input shape must match MFCC (N_MFCC, Time_Steps, 1)
    Conv2D(32, (3,3), activation='relu', padding='same', input_shape=(N_MFCC, X_train.shape[2], 1)),
    BatchNormalization(),
    MaxPooling2D((2,2)),
    
    Conv2D(64, (3,3), activation='relu', padding='same'),
    BatchNormalization(),
    MaxPooling2D((2,2)),
    
    Conv2D(128, (3,3), activation='relu', padding='same'),
    BatchNormalization(),
    MaxPooling2D((2,2)),
    
    Flatten(),
    Dense(128, activation='relu'),
    Dropout(0.5),
    Dense(1, activation='sigmoid') # 0=Fake, 1=Real
])

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), 
              loss='binary_crossentropy', 
              metrics=['accuracy'])

# --- 3. TRAIN ---
print("Starting Training...")
# Use 20% of training data for validation automatically (simpler than loading separate folders)
history = model.fit(X_train, y_train, epochs=10, batch_size=32, validation_split=0.2)

model.save("deepfake_detector.keras")
print("✅ MODEL SAVED!")