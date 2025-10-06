import os
import pickle
import logging
from datetime import datetime

import pandas as pd

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def save_model(trained_model: dict, path: str):
    """
    Save trained model dictionary as pickle file to `path`.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(trained_model, f)
    logger.info(f"Model saved to {path}")

def load_model(path: str):
    """
    Load model dictionary pickle file from `path`.
    Returns model dict or None if file missing.
    """
    if not os.path.exists(path):
        logger.warning(f"Model file not found: {path}")
        return None
    with open(path, "rb") as f:
        model = pickle.load(f)
    logger.info(f"Model loaded from {path}")
    return model

def predict_mappings(trained_model: dict, odm_mappings: list):
    """
    Use trained model to predict IMPACTVisitID and IMPACTAttributeID for the ODM mappings.
    odm_mappings is list of dict with at least StudyEventOID and ItemOID keys.
    Returns list of predicted mapping dicts.
    """
    df = pd.DataFrame(odm_mappings, dtype=str)

    le_se = trained_model.get("le_studyevent")
    le_item = trained_model.get("le_item")

    if "StudyEventOID" not in df.columns or "ItemOID" not in df.columns:
        logger.warning("ODM mappings missing required fields.")
        return []

    known_studies = set(le_se.classes_)
    known_items = set(le_item.classes_)

    df_valid = df[df["StudyEventOID"].isin(known_studies) & df["ItemOID"].isin(known_items)]
    if df_valid.empty:
        logger.warning("No valid StudyEventOID and ItemOID found in ODM mappings.")
        return []

    X_test = pd.DataFrame({
        "StudyEventOID": le_se.transform(df_valid["StudyEventOID"]),
        "ItemOID": le_item.transform(df_valid["ItemOID"]),
    })

    y_visit_pred = trained_model["model_visit"].predict(X_test)
    y_attr_pred = trained_model["model_attr"].predict(X_test)

    pred_visit = trained_model["le_impact_visit"].inverse_transform(y_visit_pred)
    pred_attr = trained_model["le_impact_attr"].inverse_transform(y_attr_pred)

    results = []
    seen = set()

    for i in range(len(df_valid)):
        row = df_valid.iloc[i]
        key = (row["StudyEventOID"], row["ItemOID"], pred_visit[i])
        if key not in seen:
            seen.add(key)
            results.append({
                "StudyEventOID": row["StudyEventOID"],
                "ItemOID": row["ItemOID"],
                "IMPACTVisitID": pred_visit[i],
                "IMPACTAttributeID": pred_attr[i] if i < len(pred_attr) else None,
            })

    logger.info(f"Predicted {len(results)} mappings")
    return results

def validate_view_mapping(trained_model: dict, user_viewmap_mappings: list):
    """
    Validate user supplied ViewMapping against known correct mappings in trained model.
    user_viewmap_mappings is list of dict with IMPACTVisitID, EDCVisitID, IMPACTAttributeID, EDCAttributeID keys.
    Returns list of dict with added fields 'wrongly_mapped' and 'TrueMappings' suggesting correct options.
    """
    view_mappings = trained_model.get("view_mappings", [])

    valid_rows = set((m["IMPACTVisitID"], m["EDCVisitID"], m["IMPACTAttributeID"], m["EDCAttributeID"]) for m in view_mappings)

    output = []
    for entry in user_viewmap_mappings:
        row_tuple = (
            entry.get("IMPACTVisitID"),
            entry.get("EDCVisitID"),
            entry.get("IMPACTAttributeID"),
            entry.get("EDCAttributeID")
        )
        out = dict(entry)
        out["wrongly_mapped"] = False
        out["TrueMappings"] = []

        if row_tuple not in valid_rows:
            out["wrongly_mapped"] = True

            # Collect correction suggestions for fields
            corrections = []

            valid_edcvisits = [m["EDCVisitID"] for m in view_mappings if m["IMPACTVisitID"] == entry.get("IMPACTVisitID") and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID") and m["EDCAttributeID"] == entry.get("EDCAttributeID")]
            if valid_edcvisits and entry.get("EDCVisitID") not in valid_edcvisits:
                corrections.append({"field": "EDCVisitID", "correct_options": list(set(valid_edcvisits))})

            valid_edcattrs = [m["EDCAttributeID"] for m in view_mappings if m["IMPACTVisitID"] == entry.get("IMPACTVisitID") and m["EDCVisitID"] == entry.get("EDCVisitID") and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID")]
            if valid_edcattrs and entry.get("EDCAttributeID") not in valid_edcattrs:
                corrections.append({"field": "EDCAttributeID", "correct_options": list(set(valid_edcattrs))})

            valid_impactvisits = [m["IMPACTVisitID"] for m in view_mappings if m["EDCVisitID"] == entry.get("EDCVisitID") and m.get("IMPACTAttributeID") == entry.get("IMPACTAttributeID") and m["EDCAttributeID"] == entry.get("EDCAttributeID")]
            if valid_impactvisits and entry.get("IMPACTVisitID") not in valid_impactvisits:
                corrections.append({"field": "IMPACTVisitID", "correct_options": list(set(valid_impactvisits))})

            valid_impactattrs = [m["IMPACTAttributeID"] for m in view_mappings if m["IMPACTVisitID"] == entry.get("IMPACTVisitID") and m["EDCVisitID"] == entry.get("EDCVisitID") and m["EDCAttributeID"] == entry.get("EDCAttributeID")]
            if valid_impactattrs and entry.get("IMPACTAttributeID") not in valid_impactattrs:
                corrections.append({"field": "IMPACTAttributeID", "correct_options": list(set(valid_impactattrs))})

            out["TrueMappings"] = corrections

        output.append(out)
    return output
