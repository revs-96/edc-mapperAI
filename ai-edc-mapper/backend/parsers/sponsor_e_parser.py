import xml.etree.ElementTree as ET
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def parse_odm_file(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    ns = {'ns': root.tag[root.tag.find("{")+1:root.tag.find("}")]} if "{" in root.tag else {}

    odm_mappings = []
    for subject in root.findall(".//ns:SubjectData", ns) if ns else root.findall(".//SubjectData"):
        subject_key = subject.attrib.get("SubjectKey")
        for study_event in subject.findall(".//ns:StudyEventData", ns) if ns else subject.findall(".//StudyEventData"):
            study_event_oid = study_event.attrib.get("StudyEventOIDSponsE")
            study_event_repeat_key = study_event.attrib.get("StudyEventRepeatKey")
            for form_data in study_event.findall(".//ns:FormData", ns) if ns else study_event.findall(".//FormData"):
                for item_group in form_data.findall(".//ns:ItemGroupData", ns) if ns else form_data.findall(".//ItemGroupData"):
                    for item_data in item_group.findall(".//ns:ItemData", ns) if ns else item_group.findall(".//ItemData"):
                        item_oid = item_data.attrib.get("ItemOIDSponsE")
                        if study_event_oid and item_oid:
                            odm_mappings.append({
                                "SubjectKey": subject_key,
                                "StudyEventOID": study_event_oid,
                                "StudyEventRepeatKey": study_event_repeat_key,
                                "ItemOID": item_oid
                            })
    return odm_mappings

def parse_view_mapping_file(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    ns = {'ns': root.tag[root.tag.find("{")+1:root.tag.find("}")]} if "{" in root.tag else {}

    view_mappings = []
    visits = root.findall(".//ns:Visit", ns) if ns else root.findall(".//Visit")
    for visit in visits:
        impact_visit_id = visit.attrib.get("IMPACTVisitIDSponsE")
        edc_visit_id = visit.attrib.get("EDCVisitIDSponsE")
        for attribute in visit.findall(".//ns:Attribute", ns) if ns else visit.findall(".//Attribute"):
            impact_attr_id = attribute.attrib.get("IMPACTAttributeIDSponsE")
            edc_attr_id = attribute.attrib.get("EDCAttributeIDSponsE")
            if impact_visit_id and edc_visit_id and edc_attr_id:
                view_mappings.append({
                    "IMPACTVisitID": impact_visit_id,
                    "EDCVisitID": edc_visit_id,
                    "IMPACTAttributeID": impact_attr_id,
                    "EDCAttributeID": edc_attr_id,
                })
    return view_mappings
