import { useState } from 'react';
import { message } from 'antd';

export const useValidator = (
  apiBase,
  addActivity,
  updateKnowledgeStats,
  setLoading,
  setError,
  setStatusMsg,
  selectedSponsor
) => {
  const [userViewmapFile, setUserViewmapFile] = useState(null);
  const [validationResult, setValidationResult] = useState([]);

  const userViewmapProps = {
    beforeUpload: (file) => { setUserViewmapFile(file); return false; },
    fileList: userViewmapFile ? [userViewmapFile] : [],
    onRemove: () => setUserViewmapFile(null),
  };

  const handleValidate = async () => {
    if (!userViewmapFile) {
      message.error('Upload user ViewMapping file for validation');
      return;
    }
    if (!selectedSponsor) {
      message.error('Select a sponsor');
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMsg('Validating...');
    try {
      const formData = new FormData();
      formData.append('sponsor', selectedSponsor);
      formData.append('user_viewmap', userViewmapFile);

      const res = await fetch(`${apiBase}/validate/`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Validation failed');

      setValidationResult(data.validation || []);
      setStatusMsg('Validation successful');
      addActivity('validate', `Validation run for ${selectedSponsor} using ${userViewmapFile.name}`);
    } catch (err) {
      setError(err.message);
      setStatusMsg('Validation error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const clearValidation = () => {
    setUserViewmapFile(null);
    setValidationResult([]);
    message.info('Validation cleared');
  };

  const exportUpdatedXml = () => {
    // Implement export functionality; include sponsor param if needed
  };

  return {
    userViewmapFile,
    userViewmapProps,
    handleValidate,
    loading: false,
    error: null,
    validationResult,
    clearValidation,
    exportUpdatedXml,
  };
};
