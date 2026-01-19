import tensorflow as tf
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
import os

# 1. Load the Model
print("Loading 'MobileNet_Hybrid.h5'...")
try:
    model = tf.keras.models.load_model("MobileNet_Hybrid.h5")
    print("Model loaded successfully.")
except:
    print("Error: Could not find 'MobileNet_Hybrid.h5'. Run training first!")
    exit()

# 2. THE FIX: Unfreeze the Brain correctly
# First, we let EVERYTHING be trainable
model.trainable = True

# Then, we verify how many layers we have (usually ~160 for MobileNetV2)
total_layers = len(model.layers)
fine_tune_at = total_layers - 40 # We will only train the last 40 layers

print(f"Total layers: {total_layers}. Freezing the first {fine_tune_at} layers...")

# Freeze all the layers before the "fine_tune_at" point
for layer in model.layers[:fine_tune_at]:
    layer.trainable = False

# 3. Re-Compile with Low Learning Rate
# We use a very small number (1e-5) to gently teach the new layers
model.compile(optimizer=Adam(learning_rate=1e-5),  
              loss='binary_crossentropy',
              metrics=['accuracy'])

# 4. Setup Data
print("Setting up data...")
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

if not os.path.exists('hybrid_dataset'):
    print("Error: 'hybrid_dataset' folder missing!")
    exit()

train_generator = train_datagen.flow_from_directory(
    'hybrid_dataset',
    target_size=(224, 224),
    batch_size=32,
    class_mode='binary'
)

# 5. Train
print("Starting Fine-Tuning...")
model.fit(train_generator, epochs=5)

# 6. Save as V2
model.save("MobileNet_Hybrid_v2.h5")
print("Success! Saved as 'MobileNet_Hybrid_v2.h5'.")
print("Make sure to update run_mobilenet.py to load this new V2 file!")