from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

try:
    from .gradcam import compute_gradcam, extract_feature_maps
    from .utils import decode_image_bytes, preprocess_for_mnist
except ImportError:
    from gradcam import compute_gradcam, extract_feature_maps
    from utils import decode_image_bytes, preprocess_for_mnist


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SAVED_MODELS_DIR = BASE_DIR / "saved_models"
MODEL_REGISTRY_PATH = SAVED_MODELS_DIR / "registry.json"
KAGGLE_DATASET_ID = "hojjatk/mnist-dataset"

app = FastAPI(title="MNIST CNN Inference API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TrainRequest(BaseModel):
    model_name: str = Field(min_length=1, max_length=120)
    conv_filters: list[int] = Field(min_length=1, max_length=4)
    dense_neurons: list[int] = Field(min_length=1, max_length=12)
    optimizer: str = Field(default="adam")
    learning_rate: float = Field(default=0.001, gt=0.0, le=1.0)
    epochs: int = Field(default=3, ge=1, le=50)
    batch_size: int = Field(default=128, ge=16, le=512)
    validation_split: float = Field(default=0.1, ge=0.05, le=0.4)

    @field_validator("conv_filters", "dense_neurons")
    @classmethod
    def _validate_layer_sizes(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("At least one layer value is required.")
        if any(v <= 0 for v in value):
            raise ValueError("Layer values must be positive integers.")
        return value

    @field_validator("conv_filters")
    @classmethod
    def _validate_conv_filters(cls, value: list[int]) -> list[int]:
        if any(v < 8 or v > 256 for v in value):
            raise ValueError("Convolution filters must be between 8 and 256.")
        return value

    @field_validator("dense_neurons")
    @classmethod
    def _validate_dense_neurons(cls, value: list[int]) -> list[int]:
        if any(v < 4 or v > 1024 for v in value):
            raise ValueError("Dense neurons must be between 4 and 1024.")
        return value


class SelectModelRequest(BaseModel):
    model_name: str


model: tf.keras.Model | None = None
active_model_name = ""


def _supported_model_candidates() -> list[Path]:
    return [
        BASE_DIR / "model.h5",
        BASE_DIR / "model.keras",
        PROJECT_ROOT / "mnist_cnn.h5",
        PROJECT_ROOT / "mnist_cnn.keras",
    ]


def _ensure_registry() -> None:
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if not MODEL_REGISTRY_PATH.exists():
        MODEL_REGISTRY_PATH.write_text(
            json.dumps({"active_model": "", "models": []}, indent=2),
            encoding="utf-8",
        )


def _read_registry() -> dict[str, Any]:
    _ensure_registry()
    return json.loads(MODEL_REGISTRY_PATH.read_text(encoding="utf-8"))


def _write_registry(data: dict[str, Any]) -> None:
    MODEL_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _unique_model_name(preferred_name: str, existing_names: set[str]) -> str:
    normalized = "_".join(preferred_name.strip().split())
    if normalized not in existing_names:
        return normalized
    suffix = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"{normalized}_{suffix}"


def _load_model_for_serving(model_path: Path, model_name: str) -> None:
    global model
    global active_model_name
    loaded = tf.keras.models.load_model(model_path)
    dummy_input_shape = tuple(dim if dim is not None else 1 for dim in loaded.input_shape)
    _ = loaded(np.zeros(dummy_input_shape, dtype=np.float32), training=False)
    model = loaded
    active_model_name = model_name


def _last_conv_layer_name(current_model: tf.keras.Model) -> str | None:
    conv_layers = [
        layer.name for layer in current_model.layers if isinstance(layer, tf.keras.layers.Conv2D)
    ]
    if not conv_layers:
        return None
    return conv_layers[-1]


def _idx_read_u32(bytestream: Any) -> int:
    return int.from_bytes(bytestream.read(4), byteorder="big")


def _load_idx_images(path: Path) -> np.ndarray:
    with path.open("rb") as f:
        magic = _idx_read_u32(f)
        if magic != 2051:
            raise ValueError(f"Invalid IDX image file: {path}")
        num_images = _idx_read_u32(f)
        rows = _idx_read_u32(f)
        cols = _idx_read_u32(f)
        data = np.frombuffer(f.read(), dtype=np.uint8)
    return data.reshape(num_images, rows, cols)


def _load_idx_labels(path: Path) -> np.ndarray:
    with path.open("rb") as f:
        magic = _idx_read_u32(f)
        if magic != 2049:
            raise ValueError(f"Invalid IDX label file: {path}")
        num_labels = _idx_read_u32(f)
        data = np.frombuffer(f.read(), dtype=np.uint8)
    return data[:num_labels]


def _load_mnist_dataset() -> tuple[tuple[np.ndarray, np.ndarray], tuple[np.ndarray, np.ndarray], str]:
    try:
        import kagglehub  # type: ignore

        dataset_dir = Path(kagglehub.dataset_download(KAGGLE_DATASET_ID))
        train_images = next(dataset_dir.rglob("train-images-idx3-ubyte"), None)
        train_labels = next(dataset_dir.rglob("train-labels-idx1-ubyte"), None)
        test_images = next(dataset_dir.rglob("t10k-images-idx3-ubyte"), None)
        test_labels = next(dataset_dir.rglob("t10k-labels-idx1-ubyte"), None)

        if all([train_images, train_labels, test_images, test_labels]):
            x_train = _load_idx_images(train_images)
            y_train = _load_idx_labels(train_labels)
            x_test = _load_idx_images(test_images)
            y_test = _load_idx_labels(test_labels)
            return (x_train, y_train), (x_test, y_test), f"kagglehub:{dataset_dir}"
    except Exception:
        pass

    (x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
    return (x_train, y_train), (x_test, y_test), "keras.datasets.mnist"


def _preprocess_mnist_images(images: np.ndarray) -> np.ndarray:
    normalized = images.astype("float32") / 255.0
    return np.expand_dims(normalized, axis=-1)


def _build_configurable_model(request: TrainRequest) -> tf.keras.Model:
    layers: list[tf.keras.layers.Layer] = [tf.keras.layers.Input(shape=(28, 28, 1))]
    for index, filters in enumerate(request.conv_filters, start=1):
        layers.append(
            tf.keras.layers.Conv2D(
                filters,
                (3, 3),
                activation="relu",
                padding="same",
                name=f"conv{index}",
            )
        )
        layers.append(tf.keras.layers.MaxPooling2D((2, 2), name=f"pool{index}"))

    layers.append(tf.keras.layers.Flatten(name="flatten"))
    for index, neurons in enumerate(request.dense_neurons, start=1):
        layers.append(tf.keras.layers.Dense(neurons, activation="relu", name=f"dense{index}"))
        layers.append(tf.keras.layers.Dropout(0.2, name=f"dropout{index}"))

    layers.append(tf.keras.layers.Dense(10, activation="softmax", name="predictions"))
    model_instance = tf.keras.Sequential(layers, name="mnist_custom_cnn")

    optimizer_name = request.optimizer.lower()
    if optimizer_name == "adam":
        optimizer = tf.keras.optimizers.Adam(learning_rate=request.learning_rate)
    elif optimizer_name == "sgd":
        optimizer = tf.keras.optimizers.SGD(learning_rate=request.learning_rate)
    elif optimizer_name == "rmsprop":
        optimizer = tf.keras.optimizers.RMSprop(learning_rate=request.learning_rate)
    else:
        raise ValueError("Unsupported optimizer. Use one of: adam, sgd, rmsprop.")

    model_instance.compile(
        optimizer=optimizer,
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model_instance


def _initialize_active_model() -> None:
    registry = _read_registry()
    candidates = _supported_model_candidates()

    for saved in registry.get("models", []):
        saved_path = SAVED_MODELS_DIR / saved.get("file_name", "")
        if saved.get("name") == registry.get("active_model") and saved_path.exists():
            _load_model_for_serving(saved_path, saved.get("name", ""))
            return

    for candidate in candidates:
        if candidate.exists():
            _load_model_for_serving(candidate, candidate.stem)
            if not registry.get("active_model"):
                registry["active_model"] = candidate.stem
                _write_registry(registry)
            return

    raise FileNotFoundError(
        "No usable model found. Add one of: backend/model.h5, backend/model.keras, "
        "CNN-Visualization-for-Digit-recognition/mnist_cnn.h5, or train a new model via /train."
    )


_initialize_active_model()



def _to_serializable_feature_maps(feature_maps: dict[str, np.ndarray]) -> dict[str, list]:
    return {layer_name: fmap.tolist() for layer_name, fmap in feature_maps.items()}


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "MNIST backend is running"}


@app.get("/models")
def list_models() -> dict[str, Any]:
    registry = _read_registry()
    return {
        "active_model": active_model_name or registry.get("active_model", ""),
        "models": registry.get("models", []),
    }


@app.post("/models/select")
def select_model(payload: SelectModelRequest) -> dict[str, Any]:
    registry = _read_registry()
    target_model = next(
        (m for m in registry.get("models", []) if m.get("name") == payload.model_name),
        None,
    )
    if target_model is None:
        raise HTTPException(status_code=404, detail=f"Model '{payload.model_name}' not found in registry.")

    model_path = SAVED_MODELS_DIR / target_model.get("file_name", "")
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model file missing: {model_path.name}")

    try:
        _load_model_for_serving(model_path, payload.model_name)
        registry["active_model"] = payload.model_name
        _write_registry(registry)
        return {
            "message": "Model selected successfully.",
            "active_model": payload.model_name,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {exc}") from exc


@app.post("/train")
def train_model(payload: TrainRequest) -> dict[str, Any]:
    try:
        registry = _read_registry()
        existing_names = {entry.get("name", "") for entry in registry.get("models", [])}
        unique_name = _unique_model_name(payload.model_name, existing_names)

        (x_train, y_train), (x_test, y_test), dataset_source = _load_mnist_dataset()
        x_train = _preprocess_mnist_images(x_train)
        x_test = _preprocess_mnist_images(x_test)

        trained_model = _build_configurable_model(payload)
        history = trained_model.fit(
            x_train,
            y_train,
            epochs=payload.epochs,
            batch_size=payload.batch_size,
            validation_split=payload.validation_split,
            verbose=0,
        )
        test_loss, test_accuracy = trained_model.evaluate(x_test, y_test, verbose=0)

        file_name = f"{unique_name}.keras"
        output_path = SAVED_MODELS_DIR / file_name
        trained_model.save(output_path)

        history_payload = {
            "loss": [float(v) for v in history.history.get("loss", [])],
            "accuracy": [float(v) for v in history.history.get("accuracy", [])],
            "val_loss": [float(v) for v in history.history.get("val_loss", [])],
            "val_accuracy": [float(v) for v in history.history.get("val_accuracy", [])],
        }

        model_entry = {
            "name": unique_name,
            "file_name": file_name,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "optimizer": payload.optimizer,
            "learning_rate": payload.learning_rate,
            "conv_filters": payload.conv_filters,
            "dense_neurons": payload.dense_neurons,
            "epochs": payload.epochs,
            "batch_size": payload.batch_size,
            "dataset_source": dataset_source,
            "test_loss": float(test_loss),
            "test_accuracy": float(test_accuracy),
        }

        registry.setdefault("models", []).append(model_entry)
        registry["active_model"] = unique_name
        _write_registry(registry)

        _load_model_for_serving(output_path, unique_name)

        return {
            "message": "Training completed and model saved.",
            "active_model": unique_name,
            "saved_model": model_entry,
            "history": history_payload,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}") from exc


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    if model is None:
        raise HTTPException(status_code=500, detail="No active model loaded.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    try:
        image_bytes = await file.read()
        image_bgr = decode_image_bytes(image_bytes)
        processed = preprocess_for_mnist(image_bgr)
        model_input = processed["model_input"]

        prediction_scores_primary = model.predict(model_input, verbose=0)[0]
        model_input_inverted = 1.0 - model_input
        prediction_scores_inverted = model.predict(model_input_inverted, verbose=0)[0]

        if float(np.max(prediction_scores_inverted)) > float(np.max(prediction_scores_primary)):
            model_input = model_input_inverted
            prediction_scores = prediction_scores_inverted
        else:
            prediction_scores = prediction_scores_primary

        predicted_digit = int(np.argmax(prediction_scores))
        last_conv_layer_name = _last_conv_layer_name(model)

        heatmap_resized = np.zeros((28, 28), dtype=np.float32)
        if last_conv_layer_name is not None:
            heatmap = compute_gradcam(
                model=model,
                model_input=model_input,
                last_conv_layer_name=last_conv_layer_name,
                class_index=predicted_digit,
            )
            heatmap_resized = cv2.resize(heatmap, (28, 28), interpolation=cv2.INTER_CUBIC)

        feature_maps = extract_feature_maps(model=model, model_input=model_input)

        return {
            "predicted_digit": predicted_digit,
            "probabilities": prediction_scores.astype(float).tolist(),
            "gradcam": {
                "target_layer": last_conv_layer_name,
                "heatmap": heatmap_resized.astype(float).tolist(),
            },
            "active_model": active_model_name,
            "feature_maps": _to_serializable_feature_maps(feature_maps),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


