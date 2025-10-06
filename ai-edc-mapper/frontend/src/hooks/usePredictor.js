import { useState } from 'react';
import { message } from 'antd';

export const usePredictor = (
  apiBase,
  addActivity,
  updateKnowledgeStats,
  setLoading,
  setError,
  setStatusMsg,
  selectedSponsor
) => {
  const [testFile, setTestFile] = useState(null);
  const [mappedResult, setMappedResult] = useState([]);
  const [editableMappings, setEditableMappings] = useState([]);
  const [groupedUnmapped, setGroupedUnmapped] = useState([]);

  const testProps = {
    beforeUpload: (file) => { setTestFile(file); return false; },
    fileList: testFile ? [testFile] : [],
    onRemove: () => setTestFile(null),
  };

  const handlePredict = async () => {
    if (!testFile) {
      message.error('Upload test ODM file for prediction');
      return;
    }
    if (!selectedSponsor) {
      message.error('Select a sponsor');
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMsg('Predicting...');
    try {
      const formData = new FormData();
      formData.append('sponsor', selectedSponsor);
      formData.append('testodm', testFile);

      const res = await fetch(`${apiBase}/predict/`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Prediction failed');

      setMappedResult(data.mapped || []);
      setEditableMappings(data.mapped || []);
      setGroupedUnmapped(data.unmapped || []);
      setStatusMsg('Prediction successful');
      addActivity('predict', `Prediction run for ${selectedSponsor} using ${testFile.name}`);
    } catch (err) {
      setError(err.message);
      setStatusMsg('Prediction error');
      message.error(err.message);
    }
    setLoading(false);
  };

  // Save corrected mappings (optional)
  const saveMappings = async () => {
    // Implement save logic with sponsor info as needed
  };

  const handleUnmappedEdit = (key, field, value) => {
    setGroupedUnmapped(prev =>
      prev.map(item => item.key === key ? { ...item, [field]: value } : item)
    );
  };

  const handleActionChange = (key, value) => {
    setGroupedUnmapped(prev =>
      prev.map(item => item.key === key ? { ...item, isIgnored: value === 'Ignore' } : item)
    );
  };

  return {
    testFile,
    testProps,
    handlePredict,
    error: null,
    mappedResult,
    editableMappings,
    groupedUnmapped,
    setEditableMappings,
    saveMappings,
    handleUnmappedEdit,
    handleActionChange,
  };

};
