import xml.etree.ElementTree as ET
import io
from fastapi.responses import StreamingResponse


def update_odm_xml(odm_file_path, updated_mappings):
    tree = ET.parse(odm_file_path)
    root = tree.getroot()

    # Build mapping lookup
    mapping_index = {(um['StudyEventOID'], um['ItemOID']): (um['IMPACTVisitID'], um['IMPACTAttributeID'])
                     for um in updated_mappings}

    nsmap = {}
    if root.tag.startswith("{"):
        uri = root.tag[root.tag.find("{")+1:root.tag.find("}")]
        nsmap['ns'] = uri

    for sed in root.findall('.//ns:StudyEventData', nsmap) if nsmap else root.findall('.//StudyEventData'):
        sed_oid = sed.attrib.get("StudyEventOID")
        for form_data in sed.findall('.//ns:FormData', nsmap) if nsmap else sed.findall('.//FormData'):
            for igd in form_data.findall('.//ns:ItemGroupData', nsmap) if nsmap else form_data.findall('.//ItemGroupData'):
                for item_data in igd.findall('.//ns:ItemData', nsmap) if nsmap else igd.findall('.//ItemData'):
                    item_oid = item_data.attrib.get("ItemOID")
                    key = (sed_oid, item_oid)
                    if key in mapping_index:
                        impact_visit_id, impact_attr_id = mapping_index[key]
                        item_data.set("IMPACTVisitID", impact_visit_id)
                        item_data.set("IMPACTAttributeID", impact_attr_id)

    buf = io.BytesIO()
    tree.write(buf, encoding='utf-8', xml_declaration=True)
    return buf.getvalue()


def get_update_response(xml_bytes, filename="updated_odm.xml"):
    response = StreamingResponse(io.BytesIO(xml_bytes), media_type="application/xml")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response
