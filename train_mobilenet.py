import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import os

# --- PART 1: THE MODEL BUILDER ---
def build_mobilenet_model(learning_rate=0.0001):
    # Load MobileNetV2 (Pre-trained on ImageNet)
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    base_model.trainable = False # Freeze the Google brain

    # Add Our "Deepfake Detector" Head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.5)(x)
    outputs = Dense(1, activation='sigmoid')(x)

    # Compile
    model = Model(inputs=base_model.input, outputs=outputs)
    model.compile(optimizer=Adam(learning_rate=learning_rate),
                  loss='binary_crossentropy',
                  metrics=['accuracy'])
    return model

# --- PART 2: THE TRAINING LOOP ---
BATCH_SIZE = 32
IMG_SIZE = (224, 224)
EPOCHS = 10

# Generator with CORRECT Preprocessing (-1 to 1)
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input, # <--- THE CRITICAL FIX
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest'
)

# Load Data
print("Loading images from 'hybrid_dataset'...")
if not os.path.exists('hybrid_dataset'):
    print("ERROR: Folder 'hybrid_dataset' not found! Please create it.")
    exit()

train_generator = train_datagen.flow_from_directory(
    'hybrid_dataset',
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary'
)

# Build & Train
print("Downloading/Loading MobileNetV2 base...")
model = build_mobilenet_model()

print("Starting Training...")
model.fit(
    train_generator,
    epochs=EPOCHS,
    steps_per_epoch=len(train_generator)
)

# Save
model.save("MobileNet_Hybrid.h5")
print("Success! Model saved as 'MobileNet_Hybrid.h5'")