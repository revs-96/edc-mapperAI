import { useState } from 'react';
import { message } from 'antd';

export const usePredictor = (apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg) => {
  const [testFile, setTestFile] = useState(null);
  const [predictResult, setPredictResult] = useState([]);
  const [mappedResult, setMappedResult] = useState([]);
  const [groupedUnmapped, setGroupedUnmapped] = useState([]);
  const [editableMappingsState, setEditableMappingsState] = useState([]);
  const [currentOdmFileName, setCurrentOdmFileName] = useState(null);

  const testProps = {
    beforeUpload: (file) => { setTestFile(file); return false; },
    fileList: testFile ? [testFile] : [],
    onRemove: () => setTestFile(null),
    accept: '.xml'
  };

  const handlePredict = async () => {
    if (!testFile) return message.error('Upload a test ODM file');
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append('testodm', testFile);
      const res = await fetch(`${apiBase}/predict/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prediction failed');

      setMappedResult(data.mapped || []);
      // Group unmapped by StudyEventOID
      const groups = {};
      (data.unmapped || []).forEach(row => {
        const key = row.StudyEventOID;
        if (!groups[key]) {
          groups[key] = {
            key,
            StudyEventOID: key,
            itemOptions: [],
            itemEdit: '',
            impactEdit: '',
            editMode: false,
            isIgnored: false,
          };
        }
        if (!groups[key].itemOptions.includes(row.ItemOID)) {
          groups[key].itemOptions.push(row.ItemOID);
        }
      });
      setGroupedUnmapped(Object.values(groups));
      setEditableMappingsState(data.mapped.map((m, i) => ({ key: i, ...m })));
      setCurrentOdmFileName(testFile.name);
      addActivity('predict', `Predicted mappings for ${testFile.name} (${data.mapped.length})`);
      updateKnowledgeStats({ mappings: (prev) => prev.mappings + (data.mapped.length || 0) });
      setStatusMsg('Predictions ready');
    } catch (err) {
      setError(err.message);
      setStatusMsg('Prediction error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const handleUnmappedEdit = (rowKey, field, value) => {
    setGroupedUnmapped(prev =>
      prev.map(row => row.key === rowKey ? { ...row, [field]: value } : row)
    );
  };

  const handleActionChange = (rowKey, action) => {
    setGroupedUnmapped(prev =>
      prev.map(row =>
        row.key === rowKey
          ? action === "Ignore"
            ? { ...row, isIgnored: true, editMode: false }
            : { ...row, editMode: true, isIgnored: false }
          : row
      )
    );
  };

  const saveMappings = async () => {
    if (!currentOdmFileName) return message.error('No ODM file associated');

    const newUnmappedAdded = groupedUnmapped
      .filter(r => !r.isIgnored && r.impactEdit && r.itemEdit)
      .map(r => ({
        StudyEventOID: r.StudyEventOID,
        ItemOID: r.itemEdit,
        IMPACTVisitID: r.impactEdit
      }));

    const allToSave = [...editableMappingsState, ...newUnmappedAdded];

    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBase}/save_mappings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: allToSave, odm_filename: currentOdmFileName })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');

      addActivity('save', `Saved mappings for ${currentOdmFileName}`);
      message.success('Mappings saved');
    } catch (err) {
      setError(err.message); message.error(err.message);
    }
    setLoading(false);
  };

  const setEditableMappings = (updater) => {
    if (typeof updater === 'function') {
      setEditableMappingsState(updater);
    } else {
      setEditableMappingsState(updater);
    }
  };

  return {
    testFile,
    testProps,
    predictResult,
    mappedResult,
    groupedUnmapped,
    editableMappings: editableMappingsState,
    setEditableMappings,
    currentOdmFileName,
    handlePredict,
    handleUnmappedEdit,
    handleActionChange,
    saveMappings
  };
};