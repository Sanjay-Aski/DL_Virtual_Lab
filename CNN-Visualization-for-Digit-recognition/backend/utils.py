from __future__ import annotations

import cv2
import numpy as np


TARGET_SIZE = (28, 28)


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    np_buffer = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image. Ensure the uploaded file is a valid image.")
    return image


def preprocess_image(img):
    # Convert to grayscale
    img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    # Resize to 28x28
    img = cv2.resize(img, (28, 28))

    # Invert colors
    img = 255 - img

    # Normalize
    img = img / 255.0
    img = np.expand_dims(img, axis=0)
    img = np.expand_dims(img, axis=-1)

    return img


def preprocess_for_mnist(image_bgr: np.ndarray) -> dict[str, np.ndarray]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, TARGET_SIZE, interpolation=cv2.INTER_AREA)
    inverted = cv2.bitwise_not(resized)

    normalized = inverted.astype(np.float32) / 255.0
    model_input = np.expand_dims(normalized, axis=(0, -1))

    return {
        "gray": gray,
        "resized": resized,
        "inverted": inverted,
        "normalized": normalized,
        "model_input": model_input,
    }
