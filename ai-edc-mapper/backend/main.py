from fastapi import FastAPI, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from model import train_model, predict_mappings, validate_view_mapping, load_model, save_model
from xml_updater import update_odm_xml, get_update_response
from knowledgebase import add_user_mapping, get_all_user_mappings

import shutil
import os
import xml.etree.ElementTree as ET
import logging
import json
from datetime import datetime

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
MODELS_DIR = "models"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

global_model = None
latest_odm_path = None
corrected_mappings = []

def _load_db():
    if os.path.exists("knowledge_db.json"):
        try:
            with open("knowledge_db.json", "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            logger.exception("Failed to load knowledge DB, creating new.")
    return {
        "models": [],       
        "activities": [],   
        "mappings_total": 0,
        "last_export": None,
        "user_corrected": []
    }

def _save_db(db):
    try:
        with open("knowledge_db.json", "w", encoding="utf-8") as fh:
            json.dump(db, fh, indent=2, default=str)
    except Exception:
        logger.exception("Failed to save knowledge DB")

def ensure_model_loaded():
    global global_model
    db = _load_db()
    if db["models"]:
        last = db["models"][-1]
        model_path = last.get("model_path")
        if model_path and os.path.exists(model_path):
            try:
                global_model = load_model(model_path)
                logger.debug(f"Loaded model from {model_path}")
                return
            except Exception:
                logger.exception("Failed to load saved model")
    global_model = None

ensure_model_loaded()

@app.get("/model_status/")
async def model_status():
    ensure_model_loaded()
    db = _load_db()
    latest = db["models"][-1] if db["models"] else None
    return {
        "available": global_model is not None,
        "latest_model": latest
    }

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
        trained_model = train_model(odm_path, viewmap_path)
    except ET.ParseError as e:
        line = getattr(e, "position", ("Unknown", "Unknown"))[0]
        col = getattr(e, "position", ("Unknown", "Unknown"))[1]
        message = f"XML Parsing Error at line {line}, column {col}: {str(e)}"
        return JSONResponse(status_code=400, content={"error": message})
    except Exception as e:
        logger.exception("Training failed")
        return JSONResponse(status_code=500, content={"error": str(e)})

    db = _load_db()
    version = len(db["models"]) + 1
    model_filename = f"model_v{version}.pkl"
    model_path = os.path.join(MODELS_DIR, model_filename)

    try:
        save_model(trained_model, model_path)
    except Exception:
        logger.exception("Failed to save trained model")
        return JSONResponse(status_code=500, content={"error": "Failed to save trained model"})

    metadata = trained_model.get("metadata", {})
    metadata_entry = {
        "version": version,
        "trained_at": datetime.utcnow().isoformat(),
        "odm_filename": odm.filename,
        "viewmap_filename": viewmap.filename,
        "model_path": model_path,
        "train_samples": metadata.get("train_samples", None),
        "mappings_count": metadata.get("mappings_count", None),
        "accuracy_estimate": metadata.get("accuracy_estimate", None),
        "notes": metadata.get("notes", "")
    }

    db["models"].append(metadata_entry)
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "train",
        "message": f"Trained model v{version} from {odm.filename}"
    })
    _save_db(db)

    global_model = trained_model

    return {"status": "trained", "version": version, "metadata": metadata_entry}

@app.post("/predict/")
async def predict(testodm: UploadFile = File(...)):
    ensure_model_loaded()
    if global_model is None:
        return JSONResponse(status_code=400, content={"error": "Model not trained."})

    test_path = os.path.join(UPLOAD_FOLDER, testodm.filename)
    with open(test_path, "wb") as f:
        shutil.copyfileobj(testodm.file, f)

    try:
        odm_mappings = None
        from mapping_utils import parse_odm_file
        odm_mappings = parse_odm_file(test_path)

        result = predict_mappings(global_model, test_path)

        mapped_keys = set((item["StudyEventOID"], item["ItemOID"]) for item in result)
        unmapped = [entry for entry in odm_mappings if (entry["StudyEventOID"], entry["ItemOID"]) not in mapped_keys]
    except ET.ParseError as e:
        line = getattr(e, "position", ("Unknown", "Unknown"))[0]
        col = getattr(e, "position", ("Unknown", "Unknown"))[1]
        message = f"XML Parsing Error at line {line}, column {col}: {str(e)}"
        return JSONResponse(status_code=400, content={"error": message})
    except Exception as e:
        logger.exception("Prediction failed")
        return JSONResponse(status_code=500, content={"error": str(e)})

    db = _load_db()
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "predict",
        "message": f"Predicted mappings for {testodm.filename} ({len(result)} rows)"
    })
    _save_db(db)

    return {"mapped": result, "unmapped": unmapped}

@app.post("/validate/")
async def validate(user_viewmap: UploadFile = File(...)):
    ensure_model_loaded()
    if global_model is None:
        return JSONResponse(status_code=400, content={"error": "Model not trained."})

    user_viewmap_path = os.path.join(UPLOAD_FOLDER, user_viewmap.filename)
    with open(user_viewmap_path, "wb") as f:
        shutil.copyfileobj(user_viewmap.file, f)

    try:
        validation_results = validate_view_mapping(global_model, user_viewmap_path)
    except ET.ParseError as e:
        line = getattr(e, "position", ("Unknown", "Unknown"))[0]
        col = getattr(e, "position", ("Unknown", "Unknown"))[1]
        message = f"XML Parsing Error at line {line}, column {col}: {str(e)}"
        return JSONResponse(status_code=400, content={"error": message})
    except Exception as e:
        logger.exception("Validation failed")
        return JSONResponse(status_code=500, content={"error": str(e)})

    # compute simple summary
    total = len(validation_results)
    wrongly = sum(1 for r in validation_results if r.get("wrongly_mapped"))
    accuracy = None
    if total > 0:
        accuracy = round(((total - wrongly) / total) * 100, 2)

    db = _load_db()
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "validate",
        "message": f"Validated {user_viewmap.filename} (total={total}, wrong={wrongly})"
    })
    # update knowledge DB approx accuracy (store simple rolling average)
    if db["models"]:
        last_model = db["models"][-1]
        # store last validation summary inside model metadata for quick reference
        last_model.setdefault("validations", []).append({
            "time": datetime.utcnow().isoformat(),
            "file": user_viewmap.filename,
            "total": total,
            "wrong": wrongly,
            "accuracy": accuracy
        })
    _save_db(db)

    return {"validation": validation_results, "summary": {"total": total, "wrong": wrongly, "accuracy": accuracy}}


@app.post("/save_mappings/")
async def save_mappings(
    mappings: list[dict] = Body(...),
    odm_filename: str = None
):
    global corrected_mappings, latest_odm_path

    if odm_filename is None:
        return JSONResponse(status_code=400, content={"error": "ODM filename required"})

    odm_path = os.path.join(UPLOAD_FOLDER, odm_filename)
    if not os.path.exists(odm_path):
        return JSONResponse(status_code=400, content={"error": "ODM file not found"})

    corrected_mappings = mappings
    latest_odm_path = odm_path

    for mapping in mappings:
        add_user_mapping(mapping)

    # Optionally retrain model with added mappings could be implemented here

    db = _load_db()
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "save_mappings",
        "message": f"Saved {len(mappings)} corrected mappings for {odm_filename}"
    })
    db["mappings_total"] = db.get("mappings_total", 0) + len(mappings)
    _save_db(db)

    return {"status": "mappings saved"}

@app.get("/export_xml/")
async def export_xml():
    """
    Generate updated ODM XML using the latest corrected_mappings and offer it
    as a streaming download response using xml_updater helpers.
    """
    global corrected_mappings, latest_odm_path
    if latest_odm_path is None:
        return JSONResponse(status_code=400, content={"error": "No ODM file found to export"})

    try:
        xml_content = update_odm_xml(latest_odm_path, corrected_mappings)
        # persist last export timestamp
        db = _load_db()
        db["last_export"] = datetime.utcnow().isoformat()
        db["activities"].insert(0, {
            "time": datetime.utcnow().isoformat(),
            "type": "export",
            "message": f"Exported updated ODM for {os.path.basename(latest_odm_path)}"
        })
        _save_db(db)
        return get_update_response(xml_content)
    except Exception as e:
        logger.exception("Error generating updated XML")
        return JSONResponse(status_code=500, content={"error": f"Error generating updated XML: {str(e)}"})


@app.get("/knowledge_stats/")
async def knowledge_stats():
    """
    Return a concise snapshot of the knowledge DB (models count, total mappings,
    average model accuracy and last updated time) that the frontend can display.
    """
    db = _load_db()
    models = db.get("models", [])
    models_count = len(models)
    mappings_total = db.get("mappings_total", 0)
    last_updated = models[-1]["trained_at"] if models else None

    # average accuracy across models (use stored entry accuracy_estimate if available)
    accuracies = [m.get("accuracy_estimate") for m in models if m.get("accuracy_estimate") is not None]
    avg_acc = None
    if accuracies:
        try:
            avg_acc = round(sum(accuracies) / len(accuracies), 2)
        except Exception:
            avg_acc = None

    return {
        "models": models_count,
        "mappings": mappings_total,
        "accuracy": avg_acc,
        "last_updated": last_updated,
        "models_list": models  # optionally provide list for richer UI
    }
@app.get("/recent_activity/")
async def recent_activity(limit: int = 20):
    db = _load_db()
    return {"activities": db.get("activities", [])[:limit]}
