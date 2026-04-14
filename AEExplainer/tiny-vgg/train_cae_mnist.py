#!/usr/bin/env python3
"""Train a convolutional autoencoder on MNIST and export TFJS artifacts.

Exports files used by the Svelte app:
- public/assets/data/autoencoder-model.json
- public/assets/data/autoencoder-shard*.bin
- public/assets/data/autoencoder-training-metrics.json
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train MNIST CAE and export TFJS model.")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--bottleneck-dim", type=int, default=10)
    parser.add_argument("--encoder-filters", type=int, nargs=2, default=[8, 16])
    parser.add_argument("--decoder-filters", type=int, nargs=2, default=[8, 1])
    parser.add_argument("--validation-split", type=float, default=0.1)
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root (defaults to parent of tiny-vgg).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for exported TFJS files. Defaults to <project-root>/public/assets/data.",
    )
    parser.add_argument(
        "--keras-output",
        type=Path,
        default=None,
        help="Path to save Keras model (.keras). Defaults to <project-root>/tiny-vgg/trained_cae_mnist.keras.",
    )
    return parser.parse_args()


def set_seed(seed: int) -> None:
    tf.keras.utils.set_random_seed(seed)
    np.random.seed(seed)


def load_mnist() -> np.ndarray:
    (x_train, _), (x_test, _) = tf.keras.datasets.mnist.load_data()
    x = np.concatenate([x_train, x_test], axis=0).astype("float32")
    x /= 255.0
    return np.expand_dims(x, axis=-1)


def compute_latent_shape(input_shape: Tuple[int, int, int], num_pools: int, channels: int) -> Tuple[int, int, int]:
    height, width, _ = input_shape
    divisor = 2 ** num_pools
    if height % divisor != 0 or width % divisor != 0:
        raise ValueError(
            f"Input shape {input_shape} is incompatible with {num_pools} pooling steps."
        )
    return (height // divisor, width // divisor, channels)


def build_cae(
    input_shape: Tuple[int, int, int],
    bottleneck_dim: int,
    encoder_filters: List[int],
    decoder_filters: List[int],
) -> tf.keras.Model:
    if len(encoder_filters) != 2 or len(decoder_filters) != 2:
        raise ValueError("This architecture expects 2 encoder filters and 2 decoder filters.")

    latent_h, latent_w, latent_c = compute_latent_shape(
        input_shape=input_shape,
        num_pools=2,
        channels=encoder_filters[-1],
    )
    flattened_dim = latent_h * latent_w * latent_c

    model = tf.keras.Sequential(name="cae_mnist")

    model.add(
        tf.keras.layers.Conv2D(
            filters=encoder_filters[0],
            kernel_size=(3, 3),
            strides=(1, 1),
            padding="same",
            activation="linear",
            use_bias=True,
            input_shape=input_shape,
            name="conv_1",
        )
    )
    model.add(tf.keras.layers.Activation("relu", name="relu_1"))
    model.add(
        tf.keras.layers.MaxPooling2D(
            pool_size=(2, 2), strides=(2, 2), padding="valid", name="max_pool_1"
        )
    )

    model.add(
        tf.keras.layers.Conv2D(
            filters=encoder_filters[1],
            kernel_size=(3, 3),
            strides=(1, 1),
            padding="same",
            activation="linear",
            use_bias=True,
            name="conv_2",
        )
    )
    model.add(tf.keras.layers.Activation("relu", name="relu_2"))
    model.add(
        tf.keras.layers.MaxPooling2D(
            pool_size=(2, 2), strides=(2, 2), padding="valid", name="max_pool_2"
        )
    )

    model.add(tf.keras.layers.Flatten(name="flatten"))
    model.add(
        tf.keras.layers.Dense(
            units=bottleneck_dim,
            activation="linear",
            use_bias=True,
            name="bottleneck",
        )
    )
    model.add(
        tf.keras.layers.Dense(
            units=flattened_dim,
            activation="linear",
            use_bias=True,
            name="fc_layer",
        )
    )
    model.add(tf.keras.layers.Reshape(target_shape=(latent_h, latent_w, latent_c), name="unflatten"))

    model.add(tf.keras.layers.UpSampling2D(size=(2, 2), interpolation="nearest", name="upsample_1"))
    model.add(
        tf.keras.layers.Conv2D(
            filters=decoder_filters[0],
            kernel_size=(3, 3),
            strides=(1, 1),
            padding="same",
            activation="linear",
            use_bias=True,
            name="conv_3",
        )
    )
    model.add(tf.keras.layers.Activation("relu", name="relu_3"))

    model.add(tf.keras.layers.UpSampling2D(size=(2, 2), interpolation="nearest", name="upsample_2"))
    model.add(
        tf.keras.layers.Conv2D(
            filters=decoder_filters[1],
            kernel_size=(3, 3),
            strides=(1, 1),
            padding="same",
            activation="linear",
            use_bias=True,
            name="conv_4",
        )
    )
    model.add(tf.keras.layers.Activation("sigmoid", name="sigmoid"))
    model.add(tf.keras.layers.Activation("linear", name="output"))

    return model


def split_train_validation(data: np.ndarray, validation_split: float) -> Tuple[np.ndarray, np.ndarray]:
    if validation_split <= 0 or validation_split >= 1:
        raise ValueError("validation_split must be in (0, 1).")

    num_samples = data.shape[0]
    num_val = int(num_samples * validation_split)
    if num_val <= 0:
        raise ValueError("validation split resulted in zero validation samples.")

    indices = np.arange(num_samples)
    np.random.shuffle(indices)

    val_indices = indices[:num_val]
    train_indices = indices[num_val:]
    return data[train_indices], data[val_indices]


def make_dataset(data: np.ndarray, batch_size: int, training: bool) -> tf.data.Dataset:
    ds = tf.data.Dataset.from_tensor_slices((data, data))
    if training:
        ds = ds.shuffle(min(len(data), 20000), reshuffle_each_iteration=True)
    ds = ds.batch(batch_size)
    ds = ds.prefetch(tf.data.AUTOTUNE)
    return ds


def _patch_input_layer_config(model_json: Dict[str, object]) -> None:
    """Normalize InputLayer config keys for tfjs-layers browser compatibility.

    Some converter outputs from Keras 3 use `batch_shape` while tfjs-layers
    expects `batchInputShape` (or `inputShape`) in InputLayer configs.
    """
    model_topology = model_json.get("modelTopology", {})
    model_config = model_topology.get("model_config", {})
    sequential_config = model_config.get("config", {})
    layers = sequential_config.get("layers", [])

    for layer in layers:
        if layer.get("class_name") != "InputLayer":
            continue
        config = layer.get("config", {})
        if "batch_shape" in config and "batchInputShape" not in config:
            config["batchInputShape"] = config.pop("batch_shape")


def _normalize_weight_names(model_json: Dict[str, object]) -> None:
    """Normalize manifest weight names for broader tfjs runtime compatibility.

    Some loaders resolve variables without the top-level model-name prefix.
    Strip '<model_name>/' from manifest names to avoid no-target-variable errors.
    """
    model_topology = model_json.get("modelTopology", {})
    model_config = model_topology.get("model_config", {})
    sequential_config = model_config.get("config", {})
    model_name = sequential_config.get("name")
    if not model_name:
        return

    prefix = f"{model_name}/"
    for manifest_entry in model_json.get("weightsManifest", []):
        for weight_info in manifest_entry.get("weights", []):
            weight_name = weight_info.get("name", "")
            if weight_name.startswith(prefix):
                weight_info["name"] = weight_name[len(prefix):]


def export_tfjs_model(model: tf.keras.Model, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)

    temp_dir = output_dir / "_tfjs_temp"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    tfjs.converters.save_keras_model(model, str(temp_dir))

    source_json = temp_dir / "model.json"
    if not source_json.exists():
        raise FileNotFoundError("tensorflowjs export did not produce model.json")

    with source_json.open("r", encoding="utf-8") as fh:
        model_json = json.load(fh)

    _patch_input_layer_config(model_json)
    _normalize_weight_names(model_json)

    source_shards = sorted(temp_dir.glob("*.bin"))
    if not source_shards:
        raise FileNotFoundError("tensorflowjs export did not produce any shard .bin files")

    target_json = output_dir / "autoencoder-model.json"
    total_shards = len(source_shards)
    remapped_paths: List[str] = []

    for shard_index, source_shard in enumerate(source_shards, start=1):
        target_name = f"autoencoder-shard{shard_index}of{total_shards}.bin"
        shutil.copyfile(source_shard, output_dir / target_name)
        remapped_paths.append(target_name)

    for manifest_entry in model_json.get("weightsManifest", []):
        manifest_entry["paths"] = remapped_paths

    with target_json.open("w", encoding="utf-8") as fh:
        json.dump(model_json, fh)

    shutil.rmtree(temp_dir)

    return {
        "model_json": str(target_json),
        "shards": remapped_paths,
    }


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    project_root = args.project_root.resolve()
    output_dir = (args.output_dir or (project_root / "public" / "assets" / "data")).resolve()
    keras_output = (args.keras_output or (project_root / "tiny-vgg" / "trained_cae_mnist.keras")).resolve()

    data = load_mnist()
    x_train, x_val = split_train_validation(data, args.validation_split)

    train_ds = make_dataset(x_train, batch_size=args.batch_size, training=True)
    val_ds = make_dataset(x_val, batch_size=args.batch_size, training=False)

    model = build_cae(
        input_shape=(28, 28, 1),
        bottleneck_dim=args.bottleneck_dim,
        encoder_filters=args.encoder_filters,
        decoder_filters=args.decoder_filters,
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
        loss=tf.keras.losses.MeanSquaredError(),
        metrics=[tf.keras.metrics.MeanAbsoluteError(name="mae")],
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
            verbose=1,
        )
    ]

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
        verbose=2,
    )

    eval_loss, eval_mae = model.evaluate(val_ds, verbose=0)

    keras_output.parent.mkdir(parents=True, exist_ok=True)
    model.save(keras_output)

    export_info = export_tfjs_model(model, output_dir=output_dir)

    metrics = {
        "seed": args.seed,
        "epochs_requested": args.epochs,
        "epochs_ran": len(history.history.get("loss", [])),
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "validation_split": args.validation_split,
        "final_train_loss": float(history.history["loss"][-1]),
        "final_val_loss": float(history.history["val_loss"][-1]),
        "final_train_mae": float(history.history["mae"][-1]),
        "final_val_mae": float(history.history["val_mae"][-1]),
        "eval_loss": float(eval_loss),
        "eval_mae": float(eval_mae),
        "keras_output": str(keras_output),
        "tfjs_model_json": export_info["model_json"],
        "tfjs_shards": export_info["shards"],
        "architecture": {
            "input_shape": [28, 28, 1],
            "encoder_filters": args.encoder_filters,
            "bottleneck_dim": args.bottleneck_dim,
            "decoder_filters": args.decoder_filters,
        },
    }

    metrics_path = output_dir / "autoencoder-training-metrics.json"
    with metrics_path.open("w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    print("Exported trained CAE artifacts:")
    print(f"- {export_info['model_json']}")
    for shard in export_info["shards"]:
        print(f"- {output_dir / shard}")
    print(f"- {metrics_path}")


if __name__ == "__main__":
    main()
