from __future__ import annotations

import numpy as np
import tensorflow as tf


def _ensure_model_graph(model: tf.keras.Model, model_input: np.ndarray) -> None:
    try:
        _ = model.outputs
    except Exception:
        model(model_input, training=False)

def compute_gradcam(
    model: tf.keras.Model,
    model_input: np.ndarray,
    last_conv_layer_name: str = "conv3",
    class_index: int | None = None,
) -> np.ndarray:
    _ensure_model_graph(model, model_input)
    conv_layer = model.get_layer(last_conv_layer_name)
    conv_layer_index = next(
        i for i, layer in enumerate(model.layers) if layer.name == last_conv_layer_name
    )

    conv_model = tf.keras.models.Model(inputs=model.inputs, outputs=conv_layer.output)

    classifier_input = tf.keras.Input(shape=conv_layer.output.shape[1:])
    classifier_output = classifier_input
    for layer in model.layers[conv_layer_index + 1 :]:
        classifier_output = layer(classifier_output)
    classifier_model = tf.keras.models.Model(classifier_input, classifier_output)

    input_tensor = tf.convert_to_tensor(model_input, dtype=tf.float32)

    with tf.GradientTape() as tape:
        conv_outputs = conv_model(input_tensor, training=False)
        tape.watch(conv_outputs)
        predictions = classifier_model(conv_outputs, training=False)
        if class_index is None:
            class_index = int(tf.argmax(predictions[0]))
        class_channel = predictions[:, class_index]

    gradients = tape.gradient(class_channel, conv_outputs)
    if gradients is None:
        raise ValueError(
            f"Unable to compute Grad-CAM gradients for layer '{last_conv_layer_name}'. "
            "Ensure the selected layer is part of the path to the output logits."
        )
    pooled_gradients = tf.reduce_mean(gradients, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(conv_outputs * pooled_gradients, axis=-1)
    heatmap = tf.maximum(heatmap, 0)
    max_val = tf.reduce_max(heatmap)
    heatmap = tf.where(max_val > 0, heatmap / max_val, tf.zeros_like(heatmap))

    return heatmap.numpy().astype(np.float32)


def extract_feature_maps(model: tf.keras.Model, model_input: np.ndarray) -> dict[str, np.ndarray]:
    _ensure_model_graph(model, model_input)
    conv_layers = [
        layer
        for layer in model.layers
        if isinstance(layer, tf.keras.layers.Conv2D)
    ]

    if not conv_layers:
        return {}

    feature_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[layer.output for layer in conv_layers],
    )

    feature_outputs = feature_model(model_input, training=False)
    if not isinstance(feature_outputs, list):
        feature_outputs = [feature_outputs]

    return {
        layer.name: output[0].numpy().astype(np.float32)
        for layer, output in zip(conv_layers, feature_outputs)
    }
