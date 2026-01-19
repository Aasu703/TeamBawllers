import tensorflow as tf
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
import os

# 1. Load your Best Model So Far
# We load 'MobileNet_Hybrid.h5' because that's your stable base.
print("Loading base model...")
try:
    model = tf.keras.models.load_model("MobileNet_Hybrid.h5")
except:
    print("Error: Could not find MobileNet_Hybrid.h5")
    exit()

# 2. Aggressive Unfreezing
# We unfreeze the top 50 layers to let it learn texture details
model.trainable = True
trainable_layer_count = 50

# Freeze the bottom layers (keep the basic shapes frozen)
for layer in model.layers[:-trainable_layer_count]:
    layer.trainable = False

print(f"Fine-tuning the last {trainable_layer_count} layers...")

# 3. Compile with Micro-Learning Rate
# 1e-5 is small enough to nudge the scores without breaking the model
model.compile(optimizer=Adam(learning_rate=1e-5),  
              loss='binary_crossentropy',
              metrics=['accuracy'])

# 4. Data Setup (Standard)
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=30,      # Increased rotation to make it harder
    width_shift_range=0.3,  # Increased shift
    height_shift_range=0.3,
    zoom_range=0.3,
    horizontal_flip=True,
    fill_mode='nearest'
)

if not os.path.exists('hybrid_dataset'):
    print("Error: hybrid_dataset folder not found")
    exit()

train_generator = train_datagen.flow_from_directory(
    'hybrid_dataset',
    target_size=(224, 224),
    batch_size=16,          # Smaller batch size for better generalization
    class_mode='binary'
)

# 5. Train for 10 Epochs
# We need a bit more time for the fine details to sink in
print("Starting Aggressive Fine-Tuning...")
model.fit(train_generator, epochs=10)

# 6. Save as Final Version
model.save("MobileNet_Hybrid_Final.h5")
print("Done! Update your runner to use 'MobileNet_Hybrid_Final.h5'")