# model.py
import os
import logging
import pickle
from datetime import datetime

import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

from mapping_utils import parse_odm_file, parse_view_mapping_file, build_training_dataset

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# default models directory (main.py will persist versions here)
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)


def save_model(trained_model: dict, path: str = None):
    """
    Persist a trained_model (dict containing sklearn objects and encoders) to disk.
    path: full path to write pickle. If omitted, writes to models/model_data.pkl
    """
    if path is None:
        path = os.path.join(MODELS_DIR, "model_data.pkl")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        pickle.dump(trained_model, fh)


def load_model(path: str = None):
    """
    Load a trained model from a provided path. If path is None, attempts to load
    models/model_data.pkl (legacy).
    """
    if path is None:
        path = os.path.join(MODELS_DIR, "model_data.pkl")
    if not os.path.exists(path):
        logger.debug(f"model path {path} does not exist")
        return None
    with open(path, "rb") as fh:
        obj = pickle.load(fh)
    return obj


def train_model(odm_path: str, viewmap_path: str) -> dict:
    """
    Train two RandomForest models:
      - model_visit predicts IMPACTVisitID
      - model_attr predicts IMPACTAttributeID

    Returns a dictionary containing trained sklearn models, label encoders and
    metadata under key 'metadata'.
    """
    logger.info("Starting training process")
    odm_mappings = parse_odm_file(odm_path)
    view_mappings = parse_view_mapping_file(viewmap_path)

    training_records = build_training_dataset(odm_mappings, view_mappings)
    train_df = pd.DataFrame(training_records)

    if train_df.empty:
        message = "No matching mappings found between ODM and ViewMapping data"
        logger.error(message)
        raise ValueError(message)

    logger.debug("Training DataFrame shape: %s", train_df.shape)
    logger.debug("Training DataFrame sample:\n%s", train_df.head())

    X = train_df[["StudyEventOID", "ItemOID"]].astype(str)
    y_visit = train_df["IMPACTVisitID"].astype(str)
    y_attr = train_df["IMPACTAttributeID"].astype(str)

    le_studyevent = LabelEncoder()
    le_item = LabelEncoder()
    le_impact_visit = LabelEncoder()
    le_impact_attr = LabelEncoder()

    X_encoded = pd.DataFrame({
        "StudyEventOID": le_studyevent.fit_transform(X["StudyEventOID"]),
        "ItemOID": le_item.fit_transform(X["ItemOID"]),
    })

    y_visit_encoded = le_impact_visit.fit_transform(y_visit)
    y_attr_encoded = le_impact_attr.fit_transform(y_attr)

    # Train RandomForest models with oob where possible
    model_visit = RandomForestClassifier(n_estimators=100, random_state=42, oob_score=True, n_jobs=-1)
    model_attr = RandomForestClassifier(n_estimators=100, random_state=42, oob_score=True, n_jobs=-1)

    model_visit.fit(X_encoded, y_visit_encoded)
    model_attr.fit(X_encoded, y_attr_encoded)

    # attempt to estimate training accuracy
    accuracy_estimate = None
    try:
        # prefer OOB if available
        acc_visit = getattr(model_visit, "oob_score_", None)
        acc_attr = getattr(model_attr, "oob_score_", None)
        if acc_visit is not None and acc_attr is not None:
            accuracy_estimate = round(((acc_visit + acc_attr) / 2) * 100, 2)
        else:
            # fallback to cross_val_score on smaller folds if dataset permits
            n_samples = X_encoded.shape[0]
            cv = 3 if n_samples >= 6 else 2
            scores_v = cross_val_score(model_visit, X_encoded, y_visit_encoded, cv=cv, n_jobs=-1)
            scores_a = cross_val_score(model_attr, X_encoded, y_attr_encoded, cv=cv, n_jobs=-1)
            accuracy_estimate = round(((scores_v.mean() + scores_a.mean()) / 2) * 100, 2)
    except Exception:
        logger.exception("Could not compute accuracy estimate")

    # Build lookup set for valid view mappings (for validation)
    valid_mappings_lookup = set()
    for vm in view_mappings:
        valid_mappings_lookup.add((vm["EDCVisitID"], vm["EDCAttributeID"]))

    trained_model = {
        "model_visit": model_visit,
        "model_attr": model_attr,
        "le_studyevent": le_studyevent,
        "le_item": le_item,
        "le_impact_visit": le_impact_visit,
        "le_impact_attr": le_impact_attr,
        "valid_mappings_lookup": valid_mappings_lookup,
        "view_mappings": view_mappings,
        "metadata": {
            "trained_at": datetime.utcnow().isoformat(),
            "train_samples": int(train_df.shape[0]),
            "mappings_count": int(len(view_mappings)),
            "accuracy_estimate": accuracy_estimate,
            "notes": "RandomForest-based mapping model"
        }
    }

    # Persisting is done by main.py (so we keep train_model free of I/O responsibility)
    logger.info("Training completed successfully.")
    return trained_model


def predict_mappings(trained_model: dict, odm_test_path: str):
    logger.info(f"Predicting mappings for: {odm_test_path}")
    odm_mappings = parse_odm_file(odm_test_path)
    df = pd.DataFrame(odm_mappings, dtype=str)

    le_se = trained_model["le_studyevent"]
    le_item = trained_model["le_item"]

    known_study = set(le_se.classes_.tolist())
    known_item = set(le_item.classes_.tolist())

    if "StudyEventOID" not in df.columns or "ItemOID" not in df.columns:
        logger.warning("Test ODM missing expected fields")
        return []

    # filter rows to those encodable by training encoders
    df_valid = df[df["StudyEventOID"].isin(known_study) & df["ItemOID"].isin(known_item)]
    if df_valid.empty:
        logger.warning("No valid StudyEventOID and ItemOID in test data for prediction.")
        return []

    X_test = pd.DataFrame({
        "StudyEventOID": le_se.transform(df_valid["StudyEventOID"]),
        "ItemOID": le_item.transform(df_valid["ItemOID"]),
    })

    y_visit_pred = trained_model["model_visit"].predict(X_test)
    y_attr_pred = trained_model["model_attr"].predict(X_test)

    pred_visit = trained_model["le_impact_visit"].inverse_transform(y_visit_pred)
    pred_attr = trained_model["le_impact_attr"].inverse_transform(y_attr_pred)

    predictions = []
    seen = set()
    for i in range(len(df_valid)):
        row = df_valid.iloc[i]
        key = (row["StudyEventOID"], row["ItemOID"], pred_visit[i])
        if key not in seen:
            seen.add(key)
            predictions.append({
                "StudyEventOID": row["StudyEventOID"],
                "ItemOID": row["ItemOID"],
                "IMPACTVisitID": pred_visit[i],
                "IMPACTAttributeID": pred_attr[i] if i < len(pred_attr) else None
            })
    logger.info(f"Prediction generated {len(predictions)} unique records")
    return predictions


def validate_view_mapping(trained_model: dict, user_viewmap_path: str):
    """
    Validate a user supplied ViewMapping file against the trained model's
    known view_mappings. Returns a list where each entry includes:
      - original fields
      - wrongly_mapped: bool
      - TrueMappings: suggestions for corrections
    """
    user_mappings = parse_view_mapping_file(user_viewmap_path)
    view_mappings = trained_model["view_mappings"]

    valid_rows = set(
        (m["IMPACTVisitID"], m["EDCVisitID"], m["IMPACTAttributeID"], m["EDCAttributeID"])
        for m in view_mappings
    )

    output = []
    for entry in user_mappings:
        row_tuple = (
            entry.get("IMPACTVisitID"), entry.get("EDCVisitID"),
            entry.get("IMPACTAttributeID"), entry.get("EDCAttributeID")
        )
        out = {**entry, "wrongly_mapped": False, "TrueMappings": []}
        corrections = []

        if row_tuple not in valid_rows:
            out["wrongly_mapped"] = True

            # EDCVisitID suggestions
            valid_edcvisits = [
                m["EDCVisitID"] for m in view_mappings
                if m["IMPACTVisitID"] == entry.get("IMPACTVisitID")
                and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID")
                and m["EDCAttributeID"] == entry.get("EDCAttributeID")
            ]
            if valid_edcvisits and entry.get("EDCVisitID") not in valid_edcvisits:
                corrections.append({"field": "EDCVisitID", "correct_options": list(set(valid_edcvisits))})

            # EDCAttributeID suggestions
            valid_edcattrs = [
                m["EDCAttributeID"] for m in view_mappings
                if m["IMPACTVisitID"] == entry.get("IMPACTVisitID")
                and m["EDCVisitID"] == entry.get("EDCVisitID")
                and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID")
            ]
            if valid_edcattrs and entry.get("EDCAttributeID") not in valid_edcattrs:
                corrections.append({"field": "EDCAttributeID", "correct_options": list(set(valid_edcattrs))})

            # IMPACTVisitID suggestions
            valid_impactvisits = [
                m["IMPACTVisitID"] for m in view_mappings
                if m["EDCVisitID"] == entry.get("EDCVisitID")
                and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID")
                and m["EDCAttributeID"] == entry.get("EDCAttributeID")
            ]
            if valid_impactvisits and entry.get("IMPACTVisitID") not in valid_impactvisits:
                corrections.append({"field": "IMPACTVisitID", "correct_options": list(set(valid_impactvisits))})

            # IMPACTAttributeID suggestions
            valid_impactattrs = [
                m["IMPACTAttributeID"] for m in view_mappings
                if m["IMPACTVisitID"] == entry.get("IMPACTVisitID")
                and m["EDCVisitID"] == entry.get("EDCVisitID")
                and m["EDCAttributeID"] == entry.get("EDCAttributeID")
            ]
            if valid_impactattrs and entry.get("IMPACTAttributeID") not in valid_impactattrs:
                corrections.append({"field": "IMPACTAttributeID", "correct_options": list(set(valid_impactattrs))})

            out["TrueMappings"] = corrections

        output.append(out)

    return output
