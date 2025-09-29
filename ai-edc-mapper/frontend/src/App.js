import React, { useState } from 'react';
import { Modal, Form, Input, Button, Space, message } from 'antd';
import './App.css';

import {
  AppLayout,
  Dashboard,
  ModelTrainer,
  MappingsPredictor,
  MappingValidator,
  Knowledgebase
} from './components';

import { useAppState } from './hooks/useAppState';
import { useTrainer } from './hooks/useTrainer';
import { usePredictor } from './hooks/usePredictor';
import { useValidator } from './hooks/useValidator';

export default function App() {
  const appState = useAppState();
  const {
    collapsed, setCollapsed, selectedMenu, setSelectedMenu, modelReady, setModelReady,
    loading, setLoading, statusMsg, setStatusMsg, error, setError, themeDark, setThemeDark,
    drawerOpen, setDrawerOpen, activityLog, setActivityLog, knowledgeStats, setKnowledgeStats,
    apiBase, addActivity, updateKnowledgeStats
  } = appState;

  const trainer = useTrainer(apiBase, addActivity, updateKnowledgeStats, setModelReady, setStatusMsg, setLoading, setError);
  const predictor = usePredictor(apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg);
  const validator = useValidator(apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg);

  const [modalVisible, setModalVisible] = useState(false);
  const [activeMapping, setActiveMapping] = useState(null);

  const openEditModal = (row) => { setActiveMapping(row); setModalVisible(true); };
  const applyEdit = (values) => {
    predictor.setEditableMappings(prev => prev.map(m => m.key === activeMapping.key ? { ...m, ...values } : m));
    setModalVisible(false); message.success('Mapping updated (local)');
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard knowledgeStats={knowledgeStats} activityLog={activityLog} setActivityLog={setActivityLog} />;
      case 'trainer':
        return <ModelTrainer
          odmProps={trainer.odmProps}
          viewProps={trainer.viewProps}
          handleTrain={trainer.handleTrain}
          clearFiles={trainer.clearFiles}
          loading={loading}
          statusMsg={statusMsg}
          error={error}
        />;
      case 'predictor':
        return <MappingsPredictor
          testProps={predictor.testProps}
          handlePredict={predictor.handlePredict}
          modelReady={modelReady}
          loading={loading}
          saveMappings={predictor.saveMappings}
          editableMappings={predictor.editableMappings}
          groupedUnmapped={predictor.groupedUnmapped}
          mappedResult={predictor.mappedResult}
          handleUnmappedEdit={predictor.handleUnmappedEdit}
          handleActionChange={predictor.handleActionChange}
          error={error}
        />;
      case 'validator':
        return <MappingValidator
          userViewmapProps={validator.userViewmapProps}
          handleValidate={validator.handleValidate}
          modelReady={modelReady}
          loading={loading}
          validationResult={validator.validationResult}
          clearValidation={validator.clearValidation}
          exportUpdatedXml={validator.exportUpdatedXml}
          error={error}
        />;
      case 'knowledge':
        return <Knowledgebase
          knowledgeStats={knowledgeStats}
          exportUpdatedXml={validator.exportUpdatedXml}
          setActivityLog={setActivityLog}
        />;
      default:
        return null;
    }
  };

  return (
    <AppLayout
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      selectedMenu={selectedMenu}
      setSelectedMenu={setSelectedMenu}
      themeDark={themeDark}
      setThemeDark={setThemeDark}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      modelReady={modelReady}
      setModelReady={setModelReady}
      statusMsg={statusMsg}
      setStatusMsg={setStatusMsg}
    >
      {renderContent()}

      <Modal title="Edit Mapping" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
        {activeMapping ? (
          <Form layout="vertical" initialValues={activeMapping} onFinish={applyEdit}>
            <Form.Item label="StudyEventOID" name="StudyEventOID"><Input /></Form.Item>
            <Form.Item label="ItemOID" name="ItemOID"><Input /></Form.Item>
            <Form.Item label="IMPACTVisitID" name="IMPACTVisitID"><Input /></Form.Item>
            <Form.Item>
              <Space>
                <Button htmlType="submit" type="primary">Apply</Button>
                <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        ) : <div>No mapping selected</div>}
      </Modal>
    </AppLayout>
  );
}