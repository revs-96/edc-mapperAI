from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from knowledgebase import add_user_mapping
from xml_updater import update_odm_xml, get_update_response
import shutil, os, json, logging
from datetime import datetime
from model_training.train_sponsorA import train_sponsor_a
from model_training.train_sponsorB import train_sponsor_b
from model_training.train_sponsorC import train_sponsor_c
from model_training.train_sponsorD import train_sponsor_d
from model_training.train_sponsorE import train_sponsor_e
from parsers import sponsor_a_parser, sponsor_b_parser, sponsor_c_parser, sponsor_d_parser, sponsor_e_parser
from ml_utils import load_model, save_model, predict_mappings, validate_view_mapping

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

global_models = {}

PARSERS = {
    "Sponsor A": sponsor_a_parser,
    "Sponsor B": sponsor_b_parser,
    "Sponsor C": sponsor_c_parser,
    "Sponsor D": sponsor_d_parser,
    "Sponsor E": sponsor_e_parser,
}

def _load_db():
    if os.path.exists("knowledge_db.json"):
        try:
            with open("knowledge_db.json", "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            logger.exception("Failed to load knowledge DB, creating new.")
    return {
        "models": [], "activities": [], "mappings_total": 0,
        "last_export": None, "user_corrected": []
    }

def _save_db(db):
    try:
        with open("knowledge_db.json", "w", encoding="utf-8") as fh:
            json.dump(db, fh, indent=2, default=str)
    except Exception:
        logger.exception("Failed to save knowledge DB")

def get_parsers_for_sponsor(sponsor_name):
    return PARSERS.get(sponsor_name)

def ensure_model_loaded():
    global global_models
    sponsors = list(PARSERS.keys())
    for sponsor in sponsors:
        model_files = [f for f in os.listdir(MODELS_DIR) if f.startswith(f"model_{sponsor.lower().replace(' ', '_')}")]
        if not model_files:
            continue
        latest = max(model_files, key=lambda x: int(x.split('_v')[-1].split('.pkl')[0]) if '_v' in x else 0)
        model_path = os.path.join(MODELS_DIR, latest)
        try:
            global_models[sponsor] = load_model(model_path)
            logger.debug(f"Loaded model for {sponsor} from {model_path}")
        except Exception:
            logger.exception(f"Failed to load saved model for {sponsor}")

ensure_model_loaded()

@app.get("/model_status/")
async def model_status():
    ensure_model_loaded()
    db = _load_db()
    sponsors = list(PARSERS.keys())
    return {"available_sponsors": sponsors, "models": db["models"]}


@app.post("/train/")
async def train(
    sponsor: str = Form(...),
    odm: UploadFile = File(...),
    viewmap: UploadFile = File(...)
):
    odm_path = os.path.join(UPLOAD_FOLDER, odm.filename)
    viewmap_path = os.path.join(UPLOAD_FOLDER, viewmap.filename)
    with open(odm_path, "wb") as f:
        shutil.copyfileobj(odm.file, f)
    with open(viewmap_path, "wb") as f:
        shutil.copyfileobj(viewmap.file, f)

    parsers = get_parsers_for_sponsor(sponsor)
    if not parsers:
        return JSONResponse(status_code=400, content={"error": f"No parsers for sponsor '{sponsor}'"})

    try:
        odm_mappings = parsers.parse_odm_file(odm_path)
        view_mappings = parsers.parse_view_mapping_file(viewmap_path)
        
        train_func_map = {
            "Sponsor A": train_sponsor_a,
            "Sponsor B": train_sponsor_b,
            "Sponsor C": train_sponsor_c,
            "Sponsor D": train_sponsor_d,
            "Sponsor E": train_sponsor_e,
        }
        train_func = train_func_map.get(sponsor)
        if train_func is None:
            raise ValueError("Trainer function not found for sponsor")
        # Calculate version and path for model before calling train_func
        db = _load_db()
        sponsor_models = [m for m in db["models"] if m.get("sponsor") == sponsor]
        version = max([m.get("version", 0) for m in sponsor_models] + [0]) + 1
        model_filename = f"model_{sponsor.lower().replace(' ', '_')}_v{version}.pkl"
        model_path = os.path.join(MODELS_DIR, model_filename)
        # FIX: Pass arguments to the train function
        train_func(odm_path, viewmap_path, model_path)
        # After training reload model
        ensure_model_loaded()
    except Exception as e:
        logger.exception("Training failed")
        return JSONResponse(status_code=400, content={"error": str(e)})

    # Model metadata bookkeeping
    metadata_entry = {
        "sponsor": sponsor,
        "version": version,
        "trained_at": datetime.utcnow().isoformat(),
        "odm_filename": odm.filename,
        "viewmap_filename": viewmap.filename,
        "model_path": model_path,
        "train_samples": None,
        "mappings_count": None,
        "accuracy_estimate": None,
        "notes": ""
    }
    db["models"].append(metadata_entry)
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "train",
        "message": f"Trained model for {sponsor} v{version} from {odm.filename}"
    })
    _save_db(db)

    return {"status": "trained", "sponsor": sponsor, "version": version, "metadata": metadata_entry}


@app.post("/predict/")
async def predict(
    sponsor: str = Form(...),
    testodm: UploadFile = File(...)
):
    ensure_model_loaded()
    if sponsor not in global_models:
        return JSONResponse(status_code=400, content={"error": f"Model for sponsor '{sponsor}' not available."})
    test_path = os.path.join(UPLOAD_FOLDER, testodm.filename)
    with open(test_path, "wb") as f:
        shutil.copyfileobj(testodm.file, f)
    try:
        odm_mappings = get_parsers_for_sponsor(sponsor).parse_odm_file(test_path)
        result = predict_mappings(global_models[sponsor], odm_mappings)
        mapped_keys = set((item["StudyEventOID"], item["ItemOID"]) for item in result)
        unmapped = [entry for entry in odm_mappings if (entry["StudyEventOID"], entry["ItemOID"]) not in mapped_keys]
    except Exception as e:
        logger.exception("Prediction failed")
        return JSONResponse(status_code=500, content={"error": str(e)})
    db = _load_db()
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "predict",
        "message": f"Predicted mappings for {sponsor} using {testodm.filename} ({len(result)} rows)"
    })
    _save_db(db)
    return {"mapped": result, "unmapped": unmapped}


@app.post("/validate/")
async def validate(
    sponsor: str = Form(...),
    user_viewmap: UploadFile = File(...)
):
    ensure_model_loaded()
    if sponsor not in global_models:
        return JSONResponse(status_code=400, content={"error": f"Model for sponsor '{sponsor}' not available."})
    user_viewmap_path = os.path.join(UPLOAD_FOLDER, user_viewmap.filename)
    with open(user_viewmap_path, "wb") as f:
        shutil.copyfileobj(user_viewmap.file, f)
    try:
        validation_mappings = get_parsers_for_sponsor(sponsor).parse_view_mapping_file(user_viewmap_path)
        validation_results = validate_view_mapping(global_models[sponsor], validation_mappings)
    except Exception as e:
        logger.exception("Validation failed")
        return JSONResponse(status_code=500, content={"error": str(e)})
    total = len(validation_results)
    wrongly = sum(1 for r in validation_results if r.get("wrongly_mapped"))
    accuracy = round(((total - wrongly) / total) * 100, 2) if total else None
    db = _load_db()
    db["activities"].insert(0, {
        "time": datetime.utcnow().isoformat(),
        "type": "validate",
        "message": f"Validated {user_viewmap.filename} for {sponsor} (total={total}, wrong={wrongly})"
    })
    if db["models"]:
        last_model = db["models"][-1]
        last_model.setdefault("validations", []).append({
            "time": datetime.utcnow().isoformat(),
            "file": user_viewmap.filename,
            "total": total,
            "wrong": wrongly,
            "accuracy": accuracy
        })
    _save_db(db)
    return {"validation": validation_results, "summary": {"total": total, "wrong": wrongly, "accuracy": accuracy}}


@app.get("/knowledge_stats/")
async def knowledge_stats():
    db = _load_db()
    models = db.get("models", [])
    sponsors = list(set(m.get("sponsor") for m in models if m.get("sponsor")))
    models_count = len(models)
    mappings_total = db.get("mappings_total", 0)
    last_updated = models[-1]["trained_at"] if models else None
    accuracies = [m.get("accuracy_estimate") for m in models if m.get("accuracy_estimate") is not None]
    avg_acc = round(sum(accuracies) / len(accuracies), 2) if accuracies else None
    return {
        "sponsors": sponsors,
        "models": models_count,
        "mappings": mappings_total,
        "accuracy": avg_acc,
        "last_updated": last_updated,
        "models_list": models
    }


@app.get("/recent_activity/")
async def recent_activity(limit: int = 20):
    db = _load_db()
    return {"activities": db.get("activities", [])[:limit]}
