# Setup Guide

This project has:
- `backend/` (FastAPI + TensorFlow CNN inference)
- `frontend/` (React app with canvas + CNN visualizations)

## 1) Prerequisites

- Python 3.10+ (3.12 works in this project)
- Node.js 18+
- npm
- Windows PowerShell (commands below are PowerShell-friendly)

---

## 2) Clone / Open Project

Open this folder in terminal:

```powershell
cd "D:\RAHUL\Projects\Proj\DL-Virtual lab"
```

---

## 3) Backend Setup (FastAPI)

### Create and activate virtual environment

```powershell
python -m venv .venv
& ".\.venv\Scripts\Activate.ps1"
```

### Install backend dependencies

```powershell
pip install fastapi uvicorn tensorflow opencv-python numpy python-multipart
```

### Ensure model file exists

`backend/model.h5` must exist.

If needed, copy from root:

```powershell
Copy-Item -Path ".\mnist_cnn.h5" -Destination ".\backend\model.h5" -Force
```

### Run backend

From project root:

```powershell
uvicorn backend.app:app --reload
```

Backend should run at:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

---

## 4) Frontend Setup (React)

Open a **new terminal** in project root:

```powershell
cd "D:\RAHUL\Projects\Proj\DL-Virtual lab\frontend"
npm install
npm start
```

Frontend should run at:
- `http://localhost:3000`

---

## 5) How to Use

1. Open `http://localhost:3000`
2. Draw a digit on the canvas
3. Click **Predict**
4. Review:
   - predicted digit + confidence
   - probability bars (0–9)
   - feature maps (`conv1`, `conv2`, `conv3`)
   - CNN connected layer view
   - Grad-CAM heatmap

---

## 6) Common Issues

### `ModuleNotFoundError: No module named 'tensorflow'` or `cv2`
Activate `.venv` and reinstall backend dependencies.

### `Form data requires "python-multipart"`
Install:

```powershell
pip install python-multipart
```

### Port `8000` already in use
Run backend on another port:

```powershell
uvicorn backend.app:app --reload --port 8001
```

If you do this, update frontend API URL in `frontend/src/App.js`:
- `http://localhost:8000/predict` -> `http://localhost:8001/predict`

### `npm run dev` fails
Use:

```powershell
npm start
```

### `Can't resolve 'd3'`
Install frontend dependencies again:

```powershell
cd frontend
npm install
```

---

## 7) Quick Start (2 terminals)

### Terminal 1 (backend)

```powershell
cd "D:\RAHUL\Projects\Proj\DL-Virtual lab"
& ".\.venv\Scripts\Activate.ps1"
uvicorn backend.app:app --reload
```

### Terminal 2 (frontend)

```powershell
cd "D:\RAHUL\Projects\Proj\DL-Virtual lab\frontend"
npm install
npm start
```
