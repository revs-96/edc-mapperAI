import os
from parsers import sponsor_a_parser
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
import pickle
import logging
from datetime import datetime

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

MODEL_SAVE_PATH = "models/model_sponsor_a_v1.pkl"
os.makedirs("models", exist_ok=True)


def train_sponsor_a(odm_path, viewmap_path, model_save_path):

    odm_mappings = sponsor_a_parser.parse_odm_file(odm_path)
    view_mappings = sponsor_a_parser.parse_view_mapping_file(viewmap_path)

    # Build training dataset specific to Sponsor A datapoints
    train_df = build_training_dataset(odm_mappings, view_mappings,
                                      study_event_col="StudyEventOID",
                                      item_oid_col="ItemOID",
                                      visit_col="IMPACTVisitID",
                                      attr_col="IMPACTAttributeID")

    X = train_df[[ "StudyEventOID", "ItemOID" ]].astype(str)
    y_visit = train_df["IMPACTVisitID"].astype(str)
    y_attr = train_df["IMPACTAttributeID"].astype(str)

    le_studyevent = LabelEncoder()
    le_item = LabelEncoder()
    le_visit = LabelEncoder()
    le_attr = LabelEncoder()

    X_encoded = pd.DataFrame({
        "StudyEventOID": le_studyevent.fit_transform(X["StudyEventOID"]),
        "ItemOID": le_item.fit_transform(X["ItemOID"]),
    })
    y_visit_encoded = le_visit.fit_transform(y_visit)
    y_attr_encoded = le_attr.fit_transform(y_attr)

    model_visit = RandomForestClassifier(random_state=42, n_estimators=100, oob_score=True, n_jobs=-1)
    model_attr = RandomForestClassifier(random_state=42, n_estimators=100, oob_score=True, n_jobs=-1)

    model_visit.fit(X_encoded, y_visit_encoded)
    model_attr.fit(X_encoded, y_attr_encoded)

    accuracy_estimate = None
    try:
        acc_v = model_visit.oob_score_
        acc_a = model_attr.oob_score_
        accuracy_estimate = round(((acc_v + acc_a)/2)*100, 2)
    except Exception:
        logger.exception("Error computing accuracy")

    model = {
        "model_visit": model_visit,
        "model_attr": model_attr,
        "le_studyevent": le_studyevent,
        "le_item": le_item,
        "le_impact_visit": le_visit,
        "le_impact_attr": le_attr,
        "accuracy_estimate": accuracy_estimate,
        "trained_at": datetime.utcnow().isoformat(),
        "view_mappings": view_mappings
    }

    with open(model_save_path, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved Sponsor A model to {model_save_path}")


def build_training_dataset(odm_mappings, view_mappings,
                           study_event_col, item_oid_col,
                           visit_col, attr_col):
    # Map odm to view with correct column names for Sponsor A
    viewmap_lookup = {(vm["EDCVisitID"], vm["EDCAttributeID"]) for vm in view_mappings}

    training_data = []
    for odm in odm_mappings:
        key = (odm["StudyEventOID"], odm["ItemOID"])
        if key in viewmap_lookup:
            # Assuming that Sponsor A uses these keys for view map lookups
            matching_vm = next(vm for vm in view_mappings if vm["EDCVisitID"] == key[0] and vm["EDCAttributeID"] == key[1])
            training_data.append({
                study_event_col: odm["StudyEventOID"],
                item_oid_col: odm["ItemOID"],
                visit_col: matching_vm["IMPACTVisitID"],
                attr_col: matching_vm["IMPACTAttributeID"],
            })
    return pd.DataFrame(training_data)


if __name__ == "__main__":
    train_sponsor_a()
