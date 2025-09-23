from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import train_model, predict_mappings
import shutil
import os
import traceback
import logging
from fastapi.responses import JSONResponse
import xml.etree.ElementTree as ET


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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
    except ET.ParseError as e:
        # Extract line and column if available
        line = getattr(e, 'position', ('Unknown', 'Unknown'))[0]
        col = getattr(e, 'position', ('Unknown', 'Unknown'))[1]
        message = f"XML Parsing Error at line {line}, column {col}: {str(e)}"
        return JSONResponse(status_code=400, content={"error": message})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    return {"status": "trained"}


@app.post("/predict/")
async def predict(testodm: UploadFile = File(...)):
    if global_model is None:
        return JSONResponse(status_code=400, content={"error": "Model not trained."})
    test_path = os.path.join(UPLOAD_FOLDER, testodm.filename)
    with open(test_path, "wb") as f:
        shutil.copyfileobj(testodm.file, f)

    try:
        result = predict_mappings(global_model, test_path)
    except ET.ParseError as e:
        line = getattr(e, 'position', ('Unknown', 'Unknown'))[0]
        col = getattr(e, 'position', ('Unknown', 'Unknown'))[1]
        message = f"XML Parsing Error at line {line}, column {col}: {str(e)}"
        return JSONResponse(status_code=400, content={"error": message})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    return {"mappings": result}