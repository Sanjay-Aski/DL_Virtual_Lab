# Deploying Deep Learning Virtual Lab on Render

This guide walks through deploying the frontend (React) as a Static Site and the backend (FastAPI) as a Web Service on Render.

Prerequisites
- Repository pushed to GitHub
- Render account (https://render.com)

Overview
- Frontend: `CNN-Visualization-for-Digit-recognition/frontend` → Static Site on Render
- Backend: `CNN-Visualization-for-Digit-recognition/backend` → Web Service on Render

Frontend (Static Site)
1. Build locally (optional verification):
   ```bash
   cd CNN-Visualization-for-Digit-recognition/frontend
   npm install
   npm run build
   ```
   The produced `build/` directory contains the static site.

2. On Render:
   - New → Static Site → Connect to GitHub repo
   - Root Directory: `CNN-Visualization-for-Digit-recognition/frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`

3. Environment variables (in Render Static Site settings):
   - `REACT_APP_API_BASE` — set this to your backend URL (e.g. `https://dlvl-backend.onrender.com/`). Include trailing slash.

Backend (Web Service)
1. On Render:
   - New → Web Service → Connect to GitHub repo
   - Root Directory: `CNN-Visualization-for-Digit-recognition/backend`
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command (recommended production):
     ```
     gunicorn -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:$PORT
     ```

   Note about Python / TensorFlow compatibility
   - If you see errors during `pip install` like "No matching distribution found for tensorflow==2.21.0" or messages about ignored versions requiring a different Python version, the Render build environment Python version is incompatible with the TensorFlow wheel declared in `requirements.txt`.

   Two easy fixes:
   1. Request Python 3.10 for the backend (recommended):
      - Add a `runtime.txt` file in `backend/` with the line `python-3.10.12` (already added in this repo). Render will try to use that Python version which matches many TensorFlow wheel builds.

   2. Use a TensorFlow version that has wheels for the Python version Render provides, or use the CPU-only wheel. If the `runtime.txt` route still fails, edit `backend/requirements.txt` and replace `tensorflow==2.21.0` with a known-compatible version such as `tensorflow==2.10.1` or `tensorflow-cpu==2.10.1`, then push and redeploy.

   After making either change, redeploy the backend on Render so the correct Python environment and wheels are used.

2. Add any environment variables needed by your backend (Render Dashboard → Environment):
   - `SAVED_MODELS_DIR` (optional): path to persist models (Render offers persistent disk for paid plans)
   - Any API keys or secrets your app requires

Notes on models and persistence
- The backend writes model files to `backend/saved_models/` by default. On Render this folder will be ephemeral unless you use a persistent disk or upload models to object storage (S3). For reliable persistence use S3 and update your code to read/write models from there, or mount Render persistent storage if available.

CORS / Frontend integration
- The frontend uses the `REACT_APP_API_BASE` environment variable to locate the backend. In `frontend/src/App.js` this is read as `process.env.REACT_APP_API_BASE`.
- Sample CORS middleware (restrict origins): in `backend/app.py` you can replace the `allow_origins` value with your frontend URL to tighten security:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://<your-frontend-url>.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Health checks
- For Render, enable a health check endpoint. The backend already exposes `/` returning `{"status":"ok"}`.

Testing locally before push
- Frontend dev server:
  ```bash
  cd CNN-Visualization-for-Digit-recognition/frontend
  npm install
  npm start
  ```
- Backend locally:
  ```bash
  cd CNN-Visualization-for-Digit-recognition/backend
  python -m venv .venv
  .venv/Scripts/activate   # Windows
  pip install -r requirements.txt
  uvicorn app:app --reload --host 0.0.0.0 --port 8000
  ```
  - If the frontend runs locally, set `REACT_APP_API_BASE=http://localhost:8000` when building the production bundle for local integration testing.

Final steps on Render
1. Deploy backend; copy the backend public URL.
2. Set `REACT_APP_API_BASE` for the frontend static site to the backend URL.
3. Deploy the frontend static site.
4. Visit your frontend URL and verify predictions.

If you want, I can:
- Add this file to the repo (I already created it). 
- Create a short `backend/README_DEPLOY.md` with configuration examples for persistent model storage.
- Walk through the Render dashboard setup while you perform it.
