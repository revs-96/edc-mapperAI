import { useState } from 'react';
import { message } from 'antd';

export const useValidator = (apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg) => {
  const [userViewmapFile, setUserViewmapFile] = useState(null);
  const [validationResult, setValidationResult] = useState([]);

  const userViewmapProps = {
    beforeUpload: (file) => { setUserViewmapFile(file); return false; },
    fileList: userViewmapFile ? [userViewmapFile] : [],
    onRemove: () => setUserViewmapFile(null),
    accept: '.xml'
  };

  const handleValidate = async () => {
    if (!userViewmapFile) return message.error('Upload a ViewMapping file for validation');
    setLoading(true); setError(null); setValidationResult([]);
    const form = new FormData(); form.append('user_viewmap', userViewmapFile);
    try {
      const res = await fetch(`${apiBase}/validate/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      setValidationResult(data.validation || []);
      addActivity('validate', `Validated ${userViewmapFile.name} (${data.validation?.length ?? 0})`);
      const wrong = (data.validation || []).filter(r => r.wrongly_mapped).length;
      const total = (data.validation || []).length || 1;
      const acc = Math.max(0, Math.round(((total - wrong) / total) * 10000) / 100);
      updateKnowledgeStats({ accuracy: (prev) => Math.round(((prev.accuracy + acc) / 2) * 100) / 100 });
      setStatusMsg('Validation complete');
    } catch (err) {
      setError(err.message);
      setStatusMsg('Validation error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const clearValidation = () => {
    setValidationResult([]);
    message.info('Cleared');
  };

  const exportUpdatedXml = async () => {
    try {
      const resp = await fetch(`${apiBase}/export_xml/`);
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'updated_odm.xml'; a.click();
      URL.revokeObjectURL(url);
      message.success('Export started');
    } catch (err) { message.error(err.message); }
  };

  return {
    userViewmapFile,
    userViewmapProps,
    validationResult,
    handleValidate,
    clearValidation,
    exportUpdatedXml
  };
};