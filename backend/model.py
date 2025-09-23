import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from mapping_utils import parse_odm_file, parse_view_mapping_file, build_training_dataset
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def train_model(odm_path, viewmap_path):
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

    # Features and targets
    X = train_df[['StudyEventOID', 'ItemOID']]
    y_visit = train_df['IMPACTVisitID']
    y_attr = train_df['IMPACTAttributeID']

    # Label encoders for categorical variables
    le_studyevent = LabelEncoder()
    le_item = LabelEncoder()
    le_impact_visit = LabelEncoder()
    le_impact_attr = LabelEncoder()

    X_encoded = pd.DataFrame({
        'StudyEventOID': le_studyevent.fit_transform(X['StudyEventOID']),
        'ItemOID': le_item.fit_transform(X['ItemOID']),
    })

    y_visit_encoded = le_impact_visit.fit_transform(y_visit)
    y_attr_encoded = le_impact_attr.fit_transform(y_attr)

    # Train classifiers
    model_visit = RandomForestClassifier(n_estimators=100, random_state=42)
    model_attr = RandomForestClassifier(n_estimators=100, random_state=42)

    model_visit.fit(X_encoded, y_visit_encoded)
    model_attr.fit(X_encoded, y_attr_encoded)

    logger.info("Training completed successfully.")

    trained_model = {
        "model_visit": model_visit,
        "model_attr": model_attr,
        "le_studyevent": le_studyevent,
        "le_item": le_item,
        "le_impact_visit": le_impact_visit,
        "le_impact_attr": le_impact_attr,
    }
    return trained_model


def predict_mappings(trained_model, odm_test_path):
    logger.info(f"Predicting mappings for: {odm_test_path}")
    odm_mappings = parse_odm_file(odm_test_path)
    df = pd.DataFrame(odm_mappings)

    known_study = set(trained_model['le_studyevent'].classes_)
    known_item = set(trained_model['le_item'].classes_)

    df_valid = df[df['StudyEventOID'].isin(known_study) & df['ItemOID'].isin(known_item)]
    if df_valid.empty:
        logger.warning("No valid StudyEventOID and ItemOID in test data for prediction.")
        return []

    X_test = pd.DataFrame({
        'StudyEventOID': trained_model['le_studyevent'].transform(df_valid['StudyEventOID']),
        'ItemOID': trained_model['le_item'].transform(df_valid['ItemOID']),
    })

    y_visit_pred = trained_model['model_visit'].predict(X_test)
    y_attr_pred = trained_model['model_attr'].predict(X_test)

    pred_visit = trained_model['le_impact_visit'].inverse_transform(y_visit_pred)
    pred_attr = trained_model['le_impact_attr'].inverse_transform(y_attr_pred)

    predictions = []
    for i in range(len(df_valid)):
        row = df_valid.iloc[i]
        predictions.append({
            "SubjectKey": row.get("SubjectKey"),
            "StudyEventOID": row["StudyEventOID"],
            "StudyEventRepeatKey": row.get("StudyEventRepeatKey"),
            "ItemOID": row["ItemOID"],
            "IMPACTVisitID": pred_visit[i],
            "IMPACTAttributeID": pred_attr[i],
        })
    logger.info(f"Prediction generated {len(predictions)} records")
    return predictions
