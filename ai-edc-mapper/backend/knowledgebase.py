import json
import os

KNOWLEDGE_DB = "knowledge_db.json"

def load_db():
    if os.path.exists(KNOWLEDGE_DB):
        with open(KNOWLEDGE_DB, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return {"models": [], "activities": [], "mappings_total": 0, "last_export": None}

def save_db(db):
    with open(KNOWLEDGE_DB, "w", encoding="utf-8") as fh:
        json.dump(db, fh, indent=2, default=str)

def add_user_mapping(mapping):
    db = load_db()
    # mappings can be validated/normalized
    db.setdefault("user_corrected", []).append(mapping)
    save_db(db)
    return db

def get_all_user_mappings():
    db = load_db()
    return db.get("user_corrected", [])
