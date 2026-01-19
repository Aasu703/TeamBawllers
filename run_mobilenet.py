import cv2
import numpy as np
import tensorflow as tf
import time

# --- CONFIGURATION ---
DEEPFAKE_STRICTNESS = 0.80   # Lowered to 0.80 to catch your 0.84 scores
LIVENESS_THRESHOLD = 0.15    # Ratio threshold (Sensitivity)
WINDOW_NAME = "Final Robust Demo"

# 1. Load Model
print("Loading Model...")
try:
    model = tf.keras.models.load_model("MobileNet_Hybrid_Final.h5") 
    print("Model Loaded: MobileNet_Hybrid_Final.h5")
except:
    try:
        model = tf.keras.models.load_model("MobileNet_Hybrid.h5")
        print("Model Loaded: MobileNet_Hybrid.h5")
    except:
        print("Error: No model found.")
        exit()

# 2. Setup Camera
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
cap = cv2.VideoCapture(0)

# Window Setup
cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
cv2.resizeWindow(WINDOW_NAME, 1280, 720) 

# Variables
score_buffer = []
liveness_state = "IDLE" 
flash_start_time = 0
baseline_ratio = 0
final_verdict = ""
final_color = (0, 0, 0)

print("READY. Press 'L' for Liveness. Press 'Q' to Quit.")

while True:
    ret, frame = cap.read()
    if not ret: break

    avg_score = 0 # Default safety value

    display_frame = cv2.resize(frame, (1280, 720))
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    current_ratio = 0
    face_detected = False
    
    for (x, y, w, h) in faces:
        face_detected = True
        face_img = frame[y:y+h, x:x+w]
        
        # --- THE FIX: COLOR RATIO MATH ---
        # Instead of raw brightness, we calculate (Blue / Green)
        # Pink light adds Blue/Red but not Green.
        b_mean = np.mean(face_img[:, :, 0])
        g_mean = np.mean(face_img[:, :, 1])
        
        # Avoid divide by zero
        if g_mean == 0: g_mean = 1
        
        current_ratio = b_mean / g_mean
        
        # --- Deepfake Check ---
        try:
            resized = cv2.resize(face_img, (224, 224))
            normalized = (resized / 127.5) - 1.0
            input_batch = np.expand_dims(normalized, axis=0)
            prediction = model.predict(input_batch, verbose=0)[0][0]
            
            score_buffer.append(prediction)
            if len(score_buffer) > 10: score_buffer.pop(0)
            avg_score = sum(score_buffer) / len(score_buffer)
        except:
            avg_score = 0.5

        # Draw UI (Only if not flashing)
        if liveness_state == "IDLE":
            scale_x = 1280 / frame.shape[1]
            scale_y = 720 / frame.shape[0]
            dx, dy, dw, dh = int(x*scale_x), int(y*scale_y), int(w*scale_x), int(h*scale_y)

            color = (0, 255, 0) if avg_score > DEEPFAKE_STRICTNESS else (0, 0, 255)
            label = "REAL" if avg_score > DEEPFAKE_STRICTNESS else "FAKE"
            
            cv2.rectangle(display_frame, (dx, dy), (dx+dw, dy+dh), color, 3)
            cv2.putText(display_frame, f"{label} ({avg_score:.2f})", (dx, dy-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    # --- STATE MACHINE ---
    if liveness_state == "IDLE":
        if face_detected:
            # Continually update baseline ratio
            baseline_ratio = current_ratio
        
        cv2.putText(display_frame, "Press 'L' for Liveness Check", (50, 50), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 2)

    elif liveness_state == "FLASH":
        # Solid Pink Flash
        display_frame[:] = (180, 105, 255) 
        cv2.putText(display_frame, "HOLD STILL...", (400, 360), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 255, 255), 5)

        if time.time() - flash_start_time > 1.5:
            liveness_state = "CHECK"

    elif liveness_state == "CHECK":
        # Calculate Ratio Difference
        diff = current_ratio - baseline_ratio
        
        is_real_person = avg_score > DEEPFAKE_STRICTNESS
        is_reflecting = diff > LIVENESS_THRESHOLD
        
        print(f"DEBUG: Score={avg_score:.2f}, RatioDiff={diff:.3f} (Threshold={LIVENESS_THRESHOLD})")

        if is_real_person and is_reflecting:
            final_verdict = "PASSED: REAL HUMAN"
            final_color = (0, 255, 0)
        elif not is_real_person:
            final_verdict = "FAILED: AI FACE DETECTED"
            final_color = (0, 0, 255)
        else:
            final_verdict = "FAILED: NO REFLECTION (FAKE VIDEO)"
            final_color = (0, 0, 255)
            
        liveness_state = "RESULT"
        flash_start_time = time.time()

    elif liveness_state == "RESULT":
        cv2.rectangle(display_frame, (0, 0), (1280, 720), final_color, 20)
        cv2.putText(display_frame, final_verdict, (100, 360), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, final_color, 4)
        
        if time.time() - flash_start_time > 3.0:
            liveness_state = "IDLE"

    cv2.imshow(WINDOW_NAME, display_frame)
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'): break
    if key == ord('l') and liveness_state == "IDLE":
        liveness_state = "FLASH"
        flash_start_time = time.time()

cap.release()
cv2.destroyAllWindows()