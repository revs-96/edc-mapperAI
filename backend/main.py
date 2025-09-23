from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import train_model, predict_mappings
import shutil
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
global_model = None

@app.post("/train/")
async def train(odm: UploadFile = File(...), viewmap: UploadFile = File(...)):
    odm_path = os.path.join(UPLOAD_FOLDER, odm.filename)
    viewmap_path = os.path.join(UPLOAD_FOLDER, viewmap.filename)
    with open(odm_path, "wb") as f:
        shutil.copyfileobj(odm.file, f)
    with open(viewmap_path, "wb") as f:
        shutil.copyfileobj(viewmap.file, f)

    global global_model
    try:
        global_model = train_model(odm_path, viewmap_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "trained"}

@app.post("/predict/")
async def predict(testodm: UploadFile = File(...)):
    if global_model is None:
        raise HTTPException(400, "Model not trained.")
    test_path = os.path.join(UPLOAD_FOLDER, testodm.filename)
    with open(test_path, "wb") as f:
        shutil.copyfileobj(testodm.file, f)

    try:
        result = predict_mappings(global_model, test_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"mappings": result}
