import { useState } from 'react';
import { message } from 'antd';

export const useTrainer = (
  apiBase,
  addActivity,
  updateKnowledgeStats,
  setModelReady,
  setStatusMsg,
  setLoading,
  setError,
  selectedSponsor // <-- Add selectedSponsor here
) => {
  const [trainFiles, setTrainFiles] = useState({ odm: null, view: null });

  const makeUploadProps = (setter, fileState) => ({
    beforeUpload: (file) => { setter(file); return false; },
    fileList: fileState ? [fileState] : [],
    onRemove: () => setter(null)
  });

  const odmProps = makeUploadProps((f) => setTrainFiles(prev => ({ ...prev, odm: f })), trainFiles.odm);
  const viewProps = makeUploadProps((f) => setTrainFiles(prev => ({ ...prev, view: f })), trainFiles.view);

  const handleTrain = async () => {
    if (!trainFiles.odm || !trainFiles.view) return message.error('Upload both ODM and ViewMapping files');
    if (!selectedSponsor) return message.error('Please select a sponsor');
    setLoading(true); setError(null); setStatusMsg('Training...');
    const form = new FormData();
    form.append('sponsor', selectedSponsor);  // Append sponsor here
    form.append('odm', trainFiles.odm);
    form.append('viewmap', trainFiles.view);
    try {
      const res = await fetch(`${apiBase}/train/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Training failed');
      setModelReady(true);
      setStatusMsg('Model trained successfully');
      addActivity('train', `Model trained for ${selectedSponsor} from ${trainFiles.odm.name}`);
      updateKnowledgeStats({ models: (prev) => prev.models + 1, last_updated: new Date().toLocaleString() });
      message.success('Training complete');
    } catch (err) {
      setError(err.message);
      setModelReady(false);
      setStatusMsg('Training error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const clearFiles = () => {
    setTrainFiles({ odm: null, view: null });
    message.info('Cleared');
  };

  return {
    trainFiles,
    odmProps,
    viewProps,
    handleTrain,
    clearFiles
  };
};
