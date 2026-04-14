# Deep Learning Virtual Lab

## Contributors

This project was developed by:
- **Sanjay Aski**
- **Rahul Guhagarkar**
- **Nathan Cherian**
- **Vivan Tulsi**
- **Vaibhav Thadwani**

---

## Project Overview

The **Deep Learning Virtual Lab** is an interactive educational platform designed to help students and practitioners understand deep learning concepts through visualization and experimentation. This project integrates multiple components including autoencoders, CNN visualization, and interactive web-based explainers.

### Key Features

- **CNN Visualization**: Interactive visualization of Convolutional Neural Networks for digit recognition
- **Autoencoder Explainer**: Visual explanation of autoencoder architecture and operations
- **Interactive Learning**: Real-time animation and visualization of neural network layers
- **Pre-trained Models**: Pre-trained models for MNIST digit recognition
- **REST API Backend**: Flask-based backend for model inference and analysis
- **Modern Web Interface**: React and Svelte-based frontend for rich user interactions

---

## Theory & Implementation

This Virtual Lab implements and visualizes key deep learning concepts through interactive demonstrations and real-time computations.

### 1. Convolutional Neural Networks (CNNs)

#### Theoretical Foundation
Convolutional Neural Networks are specialized neural networks designed for processing grid-like data, particularly images. They leverage three key principles:

- **Local Connectivity**: Neurons connect only to local regions of input (receptive fields)
- **Shared Weights**: Same filters are applied across the entire input, reducing parameters and increasing efficiency
- **Spatial Hierarchies**: Features are built hierarchically from low-level (edges, textures) to high-level (objects, concepts)

#### Core CNN Operations Implemented

**Convolution Operation:**
- Applies learnable filters across input images
- Formula: $O[i,j] = \sum_{m,n} I[i+m, j+n] \cdot K[m,n] + b$
- Extracted features: edges, textures, patterns, and complex structures
- Interactive visualization shows filter responses on input images

**Pooling Layers:**
- **Max Pooling**: Selects maximum value from local regions
- **Average Pooling**: Computes average of local regions
- Purpose: Reduce spatial dimensions, extract dominant features, provide translation invariance
- Real-time animation demonstrates pooling window movement and selection

**Activation Functions:**
- **ReLU (Rectified Linear Unit)**: $f(x) = \max(0, x)$ - introduces non-linearity
- **Softmax**: Converts final layer outputs to probability distributions for classification
- Interactive visualization shows activation patterns across network layers

**Fully Connected Layers:**
- Maps learned features to output classes
- Final classification layer for MNIST (10 output neurons for digits 0-9)

#### Implementation Details
- **Architecture**: Custom CNN trained on MNIST dataset (60,000 training images)
- **Training**: ~98% accuracy on test set
- **Input Size**: 28×28 grayscale images
- **Output**: Digit classification (0-9) with confidence scores
- **Visualization**: Layer-wise feature maps, activation heatmaps, and Grad-CAM attention maps

---

### 2. Autoencoders (AE)

#### Theoretical Foundation
Autoencoders are unsupervised learning models designed to learn efficient data representations (encodings). They consist of two main components:

**Encoder Component:**
- Maps high-dimensional input data to low-dimensional latent space
- Learns compressed representation: $z = f_{encoder}(x)$
- Progressively reduces dimensions through dense layers
- Creates bottleneck with reduced feature count

**Decoder Component:**
- Reconstructs original data from compressed latent representation
- Maps latent space back to input dimensions: $\hat{x} = f_{decoder}(z)$
- Mirrors encoder architecture to progressively expand dimensions
- Reconstruction goal: $\hat{x} \approx x$

#### Key Concepts Implemented

**Information Bottleneck:**
- Forces network to learn only essential features
- Latent dimension much smaller than input dimension
- Captures most important variations in data
- Enables dimensionality reduction and feature learning

**Loss Function:**
- Reconstruction Loss: $L = ||x - \hat{x}||^2$ (Mean Squared Error)
- Network optimized to minimize difference between input and reconstruction
- Encourages learning of meaningful latent representations

**Applications Demonstrated:**
- **Data Compression**: Reduce high-dimensional data to compact form
- **Noise Reduction**: Learn clean representations by filtering noise
- **Feature Extraction**: Use learned features for downstream tasks
- **Dimensionality Reduction**: Visualize high-dimensional data in 2D/3D

#### Implementation Details
- **Architecture**: Custom Convolutional Autoencoder (CAE) for MNIST
- **Encoder Layers**: Multiple convolution + pooling layers
- **Decoder Layers**: Convolution + upsampling layers
- **Latent Dimension**: Configurable bottleneck size
- **Training**: Unsupervised learning on MNIST dataset
- **Interactive Exploration**: Real-time parameter adjustment, hyperparameter animation

---

### 3. Gradient-weighted Class Activation Mapping (Grad-CAM)

#### Theoretical Foundation
Grad-CAM is a visualization technique that explains CNN predictions by highlighting regions in the input image that influenced the classification decision.

#### Mathematical Formulation
- **Gradient Computation**: Compute gradients of class score with respect to feature maps
- **Weighted Average**: Weight each feature map by its gradient importance
- **Activation Aggregation**: Generate spatial attention map showing influential regions
- **Formula**: $A_{c}[i,j] = \sum_k \frac{\partial y^c}{\partial A_k} \cdot A_k[i,j]$

#### Implementation & Visualization
- Generates class activation maps for CNN predictions
- Highlights regions most relevant to predicted class
- Helps interpret model decision-making
- Useful for debugging and understanding model behavior

---

### 4. Transfer Learning & Model Customization

#### Theoretical Principles
Transfer learning leverages pre-trained models to solve new tasks efficiently:

- **Pre-trained Knowledge**: Models trained on large datasets (ImageNet) learn general features
- **Fine-tuning**: Adapt pre-trained weights to new specific tasks
- **Reduced Training Time**: Start from learned representations instead of random initialization
- **Better Performance**: Often achieves better results with limited data

#### Implementation in Virtual Lab
- Load pre-trained models from Keras
- Fine-tune on MNIST dataset
- Train custom models from scratch
- Compare performance across different architectures
- Interactive model selection and management

---

### 5. MNIST Dataset & Digit Recognition

#### Dataset Overview
- **Total Images**: 70,000 (60,000 training + 10,000 test)
- **Image Size**: 28×28 pixels, grayscale
- **Classes**: 10 (digits 0-9)
- **Preprocessing**: Normalization to [0,1] range
- **Difficulty Level**: Relatively simple but comprehensive for CNN learning

#### Prediction Pipeline
1. **Input**: Upload or draw digit image (28×28)
2. **Preprocessing**: Normalize pixel values
3. **Forward Pass**: Propagate through CNN layers
4. **Feature Extraction**: Extract representations at each layer
5. **Classification**: Generate class probabilities
6. **Visualization**: Display predictions, layer activations, and attention maps

---

### 6. Hyperparameter Exploration

#### Key Hyperparameters Implemented
- **Learning Rate**: Controls gradient descent step size
- **Batch Size**: Number of samples processed before weight update
- **Number of Epochs**: Complete passes through training data
- **Filter Size/Kernel Size**: Dimensions of convolutional filters
- **Number of Filters**: Quantity of parallel convolution operations
- **Pooling Size**: Dimensions of pooling windows
- **Latent Dimension**: Size of autoencoder bottleneck
- **Dropout Rate**: Regularization technique to prevent overfitting

#### Interactive Visualization
- Real-time animation of hyperparameter effects
- Observe impact on model training and accuracy
- Understand trade-offs between different parameters
- Educational exploration of neural network behavior

---

### 7. Model Architecture Visualization

The Virtual Lab provides comprehensive visualization of:
- **Network Topology**: Layer-by-layer architecture diagram
- **Parameter Counts**: Number of learnable parameters per layer
- **Activation Shapes**: Dimensions of feature maps at each layer
- **Data Flow**: Visualization of forward propagation
- **Feature Maps**: Actual learned features visualized as images
- **Decision Boundaries**: How network separates different classes

---

## Backend Architecture & Implementation

The backend is built with **FastAPI** and **TensorFlow/Keras**, providing high-performance REST APIs for model inference, training, and visualization.

### Backend Technology Stack

- **Framework**: FastAPI (modern, fast Python web framework)
- **Server**: Uvicorn (ASGI server for high concurrency)
- **ML Framework**: TensorFlow 2.x / Keras
- **Image Processing**: OpenCV (cv2)
- **Data Processing**: NumPy, SciPy
- **API Format**: JSON with Base64-encoded image data

### Core Backend Modules

#### 1. **app.py** - Main Application Server

The central application file that handles all API requests and orchestrates model operations.

**Key Responsibilities:**
- Initialize FastAPI application with CORS middleware support
- Load and manage pre-trained models in memory
- Validate incoming requests and process uploads
- Coordinate inference and training operations
- Manage model registry (JSON-based metadata store)

**Main API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check / Root endpoint |
| `/models` | GET | List all available models |
| `/models/{model_name}` | GET | Get specific model metadata |
| `/predict` | POST | Predict digit from uploaded image |
| `/train` | POST | Train new CNN model with custom parameters |
| `/gradcam` | POST | Generate Grad-CAM visualization |
| `/smoke_test` | POST | Run quick validation tests |
| `/docs` | GET | OpenAPI/Swagger documentation |

**Request/Response Flow:**

```
Client Request (Image Upload)
        ↓
CORS Validation & File Validation
        ↓
Image Decoding (Base64/Binary)
        ↓
Image Preprocessing (Normalize, Resize)
        ↓
Model Inference (Forward Pass)
        ↓
Post-processing & Visualization (Grad-CAM, Feature Maps)
        ↓
JSON Response (Predictions, Heatmaps, Activations)
```

#### 2. **gradcam.py** - Gradient-weighted Class Activation Mapping

Implements the Grad-CAM visualization technique for explaining CNN predictions.

**Key Functions:**

**`compute_gradcam(model, model_input, last_conv_layer_name, class_index)`**
- Computes gradient-based attention maps
- Identifies regions in input image most relevant to prediction
- Returns heatmap highlighting important features
- Process:
  1. Extract feature maps from last convolutional layer
  2. Compute gradients of class score w.r.t. feature maps
  3. Calculate gradient weights: $w_k = \frac{1}{N} \sum_{i,j} \frac{\partial y^c}{\partial A_k^{i,j}}$
  4. Generate attention map: $L_{Grad-CAM} = ReLU(\sum_k w_k A_k)$
  5. Normalize and upscale to input image dimensions

**`extract_feature_maps(model, model_input)`**
- Extracts activation maps from all convolutional layers
- Visualizes learned features at each layer
- Shows feature map dimensions and channel counts
- Serializes maps to JSON for frontend visualization

#### 3. **utils.py** - Utility Functions

Helper functions for image processing and data transformation.

**Key Functions:**

**`decode_image_bytes(image_bytes)`**
- Decodes uploaded image from binary or Base64 format
- Supports formats: PNG, JPG, JPEG, BMP
- Returns OpenCV image (BGR format)
- Error handling for corrupted files

**`preprocess_for_mnist(image_bgr)`**
- Converts BGR image to grayscale
- Resizes to 28×28 pixels (MNIST standard)
- Normalizes pixel values to [0, 1] range
- Handles both black-text-on-white and white-text-on-black images
- Returns:
  - `model_input`: Normalized array for model
  - `original_display`: Original preprocessed image for visualization

**Image Preprocessing Pipeline:**
```
Raw Image (Any Size, Any Color)
    ↓
BGR → Grayscale Conversion
    ↓
Resize to 28×28 (Bilinear Interpolation)
    ↓
Normalize to [0, 1] Range
    ↓
Expand Dimensions (Add Batch & Channel)
    ↓
Ready for Model Inference
```

### Model Management System

#### Model Registry (`registry.json`)

Centralized metadata store for all trained and pre-loaded models:

```json
{
  "models": [
    {
      "name": "mnist_custom_model",
      "file_name": "mnist_custom_model.keras",
      "created_at": "2026-04-22T10:30:00Z",
      "optimizer": "adam",
      "learning_rate": 0.001,
      "conv_filters": [32, 64, 128],
      "dense_neurons": [256, 128],
      "epochs": 10,
      "batch_size": 128,
      "dataset_source": "keras_mnist",
      "test_loss": 0.035,
      "test_accuracy": 0.992
    }
  ],
  "active_model": "mnist_custom_model"
}
```

**Model Lifecycle:**
1. **Model Loading**: FastAPI loads active model at startup into memory
2. **Model Training**: New models trained and saved to `saved_models/`
3. **Registry Update**: Metadata added to registry and `active_model` updated
4. **Inference**: Requests use currently active model
5. **Model Switching**: API allows selecting different models for inference

### Training Pipeline

#### Custom Model Training Workflow

**Input (TrainRequest):**
```python
{
  "model_name": "my_custom_cnn",
  "conv_filters": [32, 64, 128],      # Filters per conv layer
  "dense_neurons": [256, 128],        # Neurons per dense layer
  "optimizer": "adam",
  "learning_rate": 0.001,
  "epochs": 10,
  "batch_size": 128,
  "validation_split": 0.1
}
```

**Training Process:**
1. Load MNIST dataset (automatic download from Keras/Kaggle)
2. Preprocess images (normalize, reshape)
3. Build CNN with specified architecture
4. Train with validation monitoring
5. Evaluate on test set
6. Save model in Keras format (.keras)
7. Update registry with metadata and accuracy metrics
8. Load trained model into memory for immediate use

**Output (Training Response):**
```python
{
  "message": "Training completed and model saved.",
  "active_model": "my_custom_cnn",
  "saved_model": {
    "name": "my_custom_cnn",
    "file_name": "my_custom_cnn.keras",
    "test_accuracy": 0.989,
    "test_loss": 0.045
  },
  "history": {
    "loss": [...],
    "accuracy": [...],
    "val_loss": [...],
    "val_accuracy": [...]
  }
}
```

### Prediction Pipeline

#### Step-by-Step Prediction Process

**1. Input Validation**
- Check file upload type (must be image)
- Validate file size (reasonable limits)
- Verify image format compatibility

**2. Image Preprocessing**
- Decode uploaded file
- Convert to grayscale
- Resize to 28×28
- Normalize pixel values
- Create batch dimension

**3. Model Inference**
- Forward pass through CNN
- Optimize by testing both normal and inverted (1.0 - pixel) versions
- Use prediction with higher confidence score

**4. Visualization Generation**
- Extract layer-wise feature maps
- Compute Grad-CAM heatmap for predicted class
- Identify most important regions in input image

**5. Response Construction**
```python
{
  "predicted_digit": 7,
  "probabilities": [0.001, 0.002, ..., 0.987, ...],  # 10 values (0-9)
  "active_model": "mnist_custom_model",
  "gradcam": {
    "target_layer": "conv2d_3",
    "heatmap": [[...], [...], ...]  # 28×28 attention map
  },
  "feature_maps": {
    "conv2d_1": {...},
    "conv2d_2": {...},
    "conv2d_3": {...}
  }
}
```

### Data Flow Architecture

```
┌─────────────────┐
│  Client Upload  │
│   (Image File)  │
└────────┬────────┘
         │
         ↓
    ┌─────────────────┐
    │ CORS Validation │
    └────────┬────────┘
             │
             ↓
    ┌──────────────────┐
    │  File Decoding   │
    │  (PNG/JPG/etc)   │
    └────────┬─────────┘
             │
             ↓
    ┌───────────────────────┐
    │ Image Preprocessing   │
    │ (Grayscale, Resize,   │
    │  Normalize to [0,1])  │
    └────────┬──────────────┘
             │
             ↓
    ┌─────────────────────────┐
    │  Model Inference        │
    │  (Forward Pass through  │
    │   CNN Layers)           │
    └────────┬────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
 Predictions      Feature Maps
 + Probabilities  + Layer Activations
    │                 │
    └────────┬────────┘
             │
             ↓
    ┌──────────────────┐
    │  Grad-CAM        │
    │  Computation     │
    └────────┬─────────┘
             │
             ↓
    ┌─────────────────────────┐
    │  JSON Response          │
    │  (Predictions,          │
    │   Heatmaps,             │
    │   Feature Maps)         │
    └────────┬────────────────┘
             │
             ↓
    ┌──────────────────┐
    │  Client Display  │
    │  (Frontend)      │
    └──────────────────┘
```

### Backend Dependencies

**Core ML Libraries** (`requirements.txt`):
```
tensorflow>=2.10.0          # Deep learning framework
keras>=2.10.0              # Neural network API
numpy>=1.21.0              # Numerical computing
opencv-python>=4.5.0       # Image processing
fastapi>=0.95.0            # Web framework
uvicorn>=0.21.0            # ASGI server
python-multipart>=0.0.5    # File upload support
pydantic>=1.9.0            # Data validation
scipy>=1.7.0               # Scientific computing
pillow>=8.3.0              # Image library
```

### Performance Considerations

**Inference Optimization:**
- Models loaded once at startup (memory-efficient)
- Batch inference support for multiple predictions
- GPU acceleration when available
- Automatic image inversion detection for better accuracy

**Scalability:**
- Uvicorn server handles concurrent requests
- CORS enabled for cross-origin frontend requests
- Async file upload handling
- Efficient model serving with minimal latency

### Error Handling

The backend includes comprehensive error handling:

- **400 Bad Request**: Invalid image format, malformed requests
- **500 Server Error**: Model not loaded, inference failure, memory issues
- **File Size Limits**: Protection against excessively large uploads
- **Model Validation**: Ensures trained models meet accuracy thresholds
- **CUDA/GPU Warnings**: Graceful fallback to CPU

---

## Project Structure

```
DL_Virtual_Lab_Merger/
├── AEExplainer/                    # Autoencoder explainer (Svelte-based)
│   ├── src/                        # Source files
│   ├── public/                     # Static files and assets
│   ├── package.json                # Dependencies
│   └── rollup.config.js            # Build configuration
│
├── CNN-Visualization-for-Digit-recognition/  # CNN visualization application
│   ├── backend/                    # Flask API server
│   │   ├── app.py                 # Main Flask application
│   │   ├── requirements.txt       # Python dependencies
│   │   └── saved_models/          # Pre-trained Keras models
│   └── frontend/                   # React-based UI
│       ├── src/                   # React components
│       └── package.json           # Dependencies
│
└── README.md                       # This file
```

---

## Prerequisites

Before installing the project, ensure you have the following installed on your system:

- **Python 3.8+** - For backend and machine learning components
- **Node.js 14+** and **npm** - For frontend applications
- **Git** - For version control
- **pip** - Python package manager (usually comes with Python)
- **conda** (optional) - For environment management

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd DL_Virtual_Lab_Merger
```

### 2. Backend Setup (CNN Visualization)

Navigate to the backend directory:

```bash
cd CNN-Visualization-for-Digit-recognition/backend
```

Create a Python virtual environment:

```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

### 3. Frontend Setup (CNN Visualization)

Navigate to the frontend directory:

```bash
cd ../frontend
```

Install Node.js dependencies:

```bash
npm install
```

### 4. AEExplainer Setup

Navigate to the AEExplainer directory:

```bash
cd ../../AEExplainer
```

Install Node.js dependencies:

```bash
npm install
```

---

## Running the Project

### Option 1: Run Full Application (Recommended)

Use the provided batch script (Windows):

```bash
cd CNN-Visualization-for-Digit-recognition
start-merged-lab.bat
```

This script will start both the backend API server and the frontend application.

### Option 2: Manual Setup

#### Start Backend Server

```bash
cd CNN-Visualization-for-Digit-recognition/backend
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The API server will run on `http://localhost:8000`

**Access the API Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

#### Start Frontend Application

In a new terminal:

```bash
cd CNN-Visualization-for-Digit-recognition/frontend
npm start
```

The frontend will typically run on `http://localhost:3000`

#### Start AEExplainer

In another new terminal:

```bash
cd AEExplainer
npm run dev
```

The AEExplainer will run on `http://localhost:8000` (or another port if specified)

---

## Features & Components

### CNN Visualization Module
- Real-time CNN model inference on uploaded images
- Layer-wise feature map visualization
- Gradient-based activation mapping (Grad-CAM)
- Support for custom MNIST digit recognition
- Model training and fine-tuning capabilities

### Autoencoder Explainer (AEExplainer)
- Interactive animations for encoder/decoder operations
- Layer activation visualization
- Hyperparameter exploration
- Real-time visualization updates
- Responsive design for different screen sizes

---

## API Endpoints

### Backend (Flask API)

- `POST /predict` - Predict digit from uploaded image
- `POST /train` - Train a new model
- `GET /models` - List available models
- `POST /gradcam` - Generate Grad-CAM visualization
- `POST /smoke_test` - Run smoke tests

For detailed API documentation, refer to the backend's `app.py` file.

---

## Technologies Used

### Backend
- **Flask** - Web framework
- **TensorFlow/Keras** - Deep learning framework
- **NumPy/SciPy** - Scientific computing
- **Python** - Programming language

### Frontend
- **React** - UI framework for CNN Visualization
- **Svelte** - UI framework for AEExplainer
- **Node.js** - Runtime environment
- **Rollup/Webpack** - Module bundlers

---

## Usage Examples

### Testing the CNN Visualization

1. Open the web application at `http://localhost:3000`
2. Upload an MNIST digit image (0-9)
3. View real-time predictions and visualizations
4. Explore different layers and activation maps

### Testing the API

```bash
# Test endpoint
curl -X POST http://localhost:8000/predict \
  -F "image=@test_image.png"
```

---

## Model Information

The project includes pre-trained Keras models for MNIST digit recognition:

- Location: `CNN-Visualization-for-Digit-recognition/backend/saved_models/`
- Format: `.keras` (Keras 3 format)
- Training Data: MNIST dataset (70,000 images)
- Accuracy: ~98% on test set

---

## Troubleshooting

### Port Already in Use
If port 8000 or 3000 is already in use, modify the port in:
- Backend: Change port in uvicorn command: `uvicorn app:app --port 8000`
- Frontend: `.env` file or `package.json`

### Dependencies Issues
```bash
# Clear and reinstall
pip install --force-reinstall -r requirements.txt
npm cache clean --force
npm install
```

### Model Not Found
Ensure the model files are present in `saved_models/` directory. Download or train models if missing.

---

## Future Enhancements

- [ ] Additional neural network architectures (RNN, Transformer)
- [ ] Real-time model training interface
- [ ] Extended dataset support (CIFAR-10, ImageNet)
- [ ] Advanced visualization techniques
- [ ] Cloud deployment options
- [ ] Mobile application support

---

## License

This project is part of a college mini-project for Deep Learning education. 

---

## Support & Questions

For issues, questions, or suggestions, please contact the project contributors or create an issue in the repository.

**Last Updated**: April 2026

