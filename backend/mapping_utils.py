# import xml.etree.ElementTree as ET
# import re


# import xml.etree.ElementTree as ET
# import re


# def parse_odm_file(file_path):
#     tree = ET.parse(file_path)
#     root = tree.getroot()

#     ns = {'ns': root.tag[root.tag.find("{")+1:root.tag.find("}")]} if "{" in root.tag else {}

#     odm_mappings = []
#     for subject in root.findall(".//ns:SubjectData", ns) if ns else root.findall(".//SubjectData"):
#         subject_key = subject.attrib.get("SubjectKey")
#         for study_event in subject.findall(".//ns:StudyEventData", ns) if ns else subject.findall(".//StudyEventData"):
#             study_event_oid = study_event.attrib.get("StudyEventOID")
#             study_event_repeat_key = study_event.attrib.get("StudyEventRepeatKey")
#             for form_data in study_event.findall(".//ns:FormData", ns) if ns else study_event.findall(".//FormData"):
#                 for item_group in form_data.findall(".//ns:ItemGroupData", ns) if ns else form_data.findall(".//ItemGroupData"):
#                     for item_data in item_group.findall(".//ns:ItemData", ns) if ns else item_group.findall(".//ItemData"):
#                         item_oid = item_data.attrib.get("ItemOID")
#                         if study_event_oid and item_oid:
#                             odm_mappings.append({
#                                 "SubjectKey": subject_key,
#                                 "StudyEventOID": study_event_oid,
#                                 "StudyEventRepeatKey": study_event_repeat_key,
#                                 "ItemOID": item_oid
#                             })
#     print(f"parse_odm_file extracted {len(odm_mappings)} mappings with additional fields")
#     return odm_mappings



# def parse_view_mapping_file(file_path):
#     tree = ET.parse(file_path)
#     root = tree.getroot()

#     ns = {'ns': root.tag[root.tag.find("{") + 1:root.tag.find("}")]} if "{" in root.tag else {}

#     view_mappings = []
#     visits = root.findall(".//ns:Visit", ns) if ns else root.findall(".//Visit")
#     for visit in visits:
#         impact_visit_id = visit.attrib.get("IMPACTVisitID")
#         edc_visit_id = visit.attrib.get("EDCVisitID")
#         for attribute in visit.findall(".//ns:Attribute", ns) if ns else visit.findall(".//Attribute"):
#             impact_attr_id = attribute.attrib.get("IMPACTAttributeID")
#             edc_attr_id = attribute.attrib.get("EDCAttributeID")
#             if impact_visit_id and edc_visit_id and edc_attr_id:
#                 view_mappings.append(
#                     {
#                         "IMPACTVisitID": impact_visit_id,
#                         "EDCVisitID": edc_visit_id,
#                         "IMPACTAttributeID": impact_attr_id,
#                         "EDCAttributeID": edc_attr_id,
#                     }
#                 )
#     print(f"parse_view_mapping_file extracted {len(view_mappings)} mappings")
#     return view_mappings


# def build_training_dataset(odm_mappings, view_mappings):
#     training_data = []
#     view_map_lookup = {(vm["EDCVisitID"], vm["EDCAttributeID"]): vm for vm in view_mappings}

#     for odm_entry in odm_mappings:
#         key = (odm_entry["StudyEventOID"], odm_entry["ItemOID"])
#         if key in view_map_lookup:
#             vm = view_map_lookup[key]
#             training_data.append({
#                 "SubjectKey": odm_entry["SubjectKey"],
#                 "StudyEventOID": odm_entry["StudyEventOID"],
#                 "StudyEventRepeatKey": odm_entry.get("StudyEventRepeatKey"),
#                 "ItemOID": odm_entry["ItemOID"],
#                 "EDCVisitID": vm["EDCVisitID"],
#                 "EDCAttributeID": vm["EDCAttributeID"],
#                 "IMPACTVisitID": vm["IMPACTVisitID"],
#                 "IMPACTAttributeID": vm["IMPACTAttributeID"],
#             })
#     print(f"build_training_dataset generated {len(training_data)} training records with extended info")
#     return training_data



# def parse_multiple_odm_snippets(odm_xml_string):
#     parts = re.split(r"</ODM>", odm_xml_string)
#     all_mappings = []
#     for fragment in parts:
#         fragment = fragment.strip()
#         if not fragment:
#             continue
#         candidate_xml = fragment + "</ODM>"
#         try:
#             root = ET.fromstring(candidate_xml)
#             ns = {'ns': root.tag[root.tag.find("{") + 1:root.tag.find("}")]} if "{" in root.tag else {}

#             mappings = []
#             for study_event in root.findall(".//ns:StudyEventData", ns) if ns else root.findall(".//StudyEventData"):
#                 study_event_oid = study_event.attrib.get("StudyEventOID")
#                 for form_data in study_event.findall(".//ns:FormData", ns) if ns else study_event.findall(".//FormData"):
#                     for item_group in form_data.findall(".//ns:ItemGroupData", ns) if ns else form_data.findall(".//ItemGroupData"):
#                         for item_data in item_group.findall(".//ns:ItemData", ns) if ns else item_group.findall(".//ItemData"):
#                             item_oid = item_data.attrib.get("ItemOID")
#                             if study_event_oid and item_oid:
#                                 mappings.append((study_event_oid, item_oid))
#             all_mappings.extend(mappings)
#         except ET.ParseError as e:
#             print(f"Skipping invalid XML fragment due to parse error: {e}")
#     print(f"Total mappings extracted from all fragments: {len(all_mappings)}")
#     return all_mappings


import xml.etree.ElementTree as ET
import re
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def parse_odm_file(file_path):
    logger.info(f"Parsing ODM file: {file_path}")
    tree = ET.parse(file_path)
    root = tree.getroot()

    ns = {'ns': root.tag[root.tag.find("{")+1:root.tag.find("}")]} if "{" in root.tag else {}
    logger.debug(f"Namespace detected: {ns}")

    odm_mappings = []
    for subject in root.findall(".//ns:SubjectData", ns) if ns else root.findall(".//SubjectData"):
        subject_key = subject.attrib.get("SubjectKey")
        logger.debug(f"SubjectKey: {subject_key}")
        for study_event in subject.findall(".//ns:StudyEventData", ns) if ns else subject.findall(".//StudyEventData"):
            study_event_oid = study_event.attrib.get("StudyEventOID")
            study_event_repeat_key = study_event.attrib.get("StudyEventRepeatKey")
            logger.debug(f"StudyEventOID: {study_event_oid}, StudyEventRepeatKey: {study_event_repeat_key}")
            for form_data in study_event.findall(".//ns:FormData", ns) if ns else study_event.findall(".//FormData"):
                for item_group in form_data.findall(".//ns:ItemGroupData", ns) if ns else form_data.findall(".//ItemGroupData"):
                    for item_data in item_group.findall(".//ns:ItemData", ns) if ns else item_group.findall(".//ItemData"):
                        item_oid = item_data.attrib.get("ItemOID")
                        if study_event_oid and item_oid:
                            odm_mappings.append({
                                "SubjectKey": subject_key,
                                "StudyEventOID": study_event_oid,
                                "StudyEventRepeatKey": study_event_repeat_key,
                                "ItemOID": item_oid
                            })
    logger.info(f"parse_odm_file extracted {len(odm_mappings)} mappings with additional fields")
    return odm_mappings


def parse_view_mapping_file(file_path):
    logger.info(f"Parsing ViewMapping file: {file_path}")
    tree = ET.parse(file_path)
    root = tree.getroot()

    ns = {'ns': root.tag[root.tag.find("{")+1:root.tag.find("}")]} if "{" in root.tag else {}
    logger.debug(f"Namespace detected: {ns}")

    view_mappings = []
    visits = root.findall(".//ns:Visit", ns) if ns else root.findall(".//Visit")
    for visit in visits:
        impact_visit_id = visit.attrib.get("IMPACTVisitID")
        edc_visit_id = visit.attrib.get("EDCVisitID")
        logger.debug(f"Visit IMPACTVisitID: {impact_visit_id}, EDCVisitID: {edc_visit_id}")
        for attribute in visit.findall(".//ns:Attribute", ns) if ns else visit.findall(".//Attribute"):
            impact_attr_id = attribute.attrib.get("IMPACTAttributeID")
            edc_attr_id = attribute.attrib.get("EDCAttributeID")
            logger.debug(f"Attribute IMPACTAttributeID: {impact_attr_id}, EDCAttributeID: {edc_attr_id}")
            if impact_visit_id and edc_visit_id and edc_attr_id:
                view_mappings.append(
                    {
                        "IMPACTVisitID": impact_visit_id,
                        "EDCVisitID": edc_visit_id,
                        "IMPACTAttributeID": impact_attr_id,
                        "EDCAttributeID": edc_attr_id,
                    }
                )
    logger.info(f"parse_view_mapping_file extracted {len(view_mappings)} mappings")
    return view_mappings


def build_training_dataset(odm_mappings, view_mappings):
    logger.info("Building training dataset")
    training_data = []
    view_map_lookup = {(vm["EDCVisitID"], vm["EDCAttributeID"]): vm for vm in view_mappings}
    logger.debug(f"View mapping lookup size: {len(view_map_lookup)}")

    for odm_entry in odm_mappings:
        key = (odm_entry["StudyEventOID"], odm_entry["ItemOID"])
        if key in view_map_lookup:
            vm = view_map_lookup[key]
            training_data.append({
                "SubjectKey": odm_entry["SubjectKey"],
                "StudyEventOID": odm_entry["StudyEventOID"],
                "StudyEventRepeatKey": odm_entry.get("StudyEventRepeatKey"),
                "ItemOID": odm_entry["ItemOID"],
                "EDCVisitID": vm["EDCVisitID"],
                "EDCAttributeID": vm["EDCAttributeID"],
                "IMPACTVisitID": vm["IMPACTVisitID"],
                "IMPACTAttributeID": vm["IMPACTAttributeID"],
            })
    logger.info(f"build_training_dataset generated {len(training_data)} training records with extended info")
    return training_data
