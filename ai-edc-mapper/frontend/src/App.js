import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Space, message } from 'antd';
import './App.css';

import {
  AppLayout,
  Dashboard,
  SponsorSelector,
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
  // App-level states from hooks
  const appState = useAppState();
  const {
    collapsed, setCollapsed, selectedMenu, setSelectedMenu,
    selectedSponsor, setSelectedSponsor, modelReady, setModelReady,
    loading, setLoading, statusMsg, setStatusMsg, error, setError,
    themeDark, setThemeDark, drawerOpen, setDrawerOpen,
    activityLog, setActivityLog, knowledgeStats, setKnowledgeStats,
    apiBase, addActivity, updateKnowledgeStats
  } = appState;

  // Sponsors state
  const [sponsors, setSponsors] = useState([]);

  // Edit mapping modal
  const [modalVisible, setModalVisible] = useState(false);
  const [activeMapping, setActiveMapping] = useState(null);

  // Hooks for model, predictor, validator with sponsor propagation
  const trainer = useTrainer(apiBase, addActivity, updateKnowledgeStats, setModelReady, setStatusMsg, setLoading, setError, selectedSponsor);

  const predictor = usePredictor(apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg, selectedSponsor);
  const validator = useValidator(apiBase, addActivity, updateKnowledgeStats, setLoading, setError, setStatusMsg, selectedSponsor);


  // Fetch sponsors + stats on mount whenever apiBase changes
  useEffect(() => {
    fetch(`${apiBase}/model_status/`)
      .then(res => res.json())
      .then(data => setSponsors(data.available_sponsors || []));
    fetch(`${apiBase}/knowledge_stats/`)
      .then(res => res.json())
      .then(setKnowledgeStats);
    fetch(`${apiBase}/recent_activity/`)
      .then(res => res.json())
      .then(data => setActivityLog(data.activities || []));
  }, [apiBase, setActivityLog, setKnowledgeStats]);

  // Modal (edit mapping) logic
  const openEditModal = (row) => { setActiveMapping(row); setModalVisible(true); };
  const applyEdit = (values) => {
    predictor.setEditableMappings(prev =>
      prev.map(m => m.key === activeMapping.key ? { ...m, ...values } : m)
    );
    setModalVisible(false);
    message.success('Mapping updated (local)');
  };

  // Content rendering by menu
  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard knowledgeStats={knowledgeStats} activityLog={activityLog} setActivityLog={setActivityLog} />;
      case 'trainer':
        return (
          <ModelTrainer
            odmProps={trainer.odmProps}
            viewProps={trainer.viewProps}
            handleTrain={trainer.handleTrain}
            clearFiles={trainer.clearFiles}
            loading={loading}
            statusMsg={statusMsg}
            error={error}
            selectedSponsor={selectedSponsor}
          />
        );
      case 'predictor':
        return (
          <MappingsPredictor
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
            selectedSponsor={selectedSponsor}
            openEditModal={openEditModal}
          />
        );
      case 'validator':
        return (
          <MappingValidator
            userViewmapProps={validator.userViewmapProps}
            handleValidate={validator.handleValidate}
            modelReady={modelReady}
            loading={loading}
            validationResult={validator.validationResult}
            clearValidation={validator.clearValidation}
            exportUpdatedXml={validator.exportUpdatedXml}
            error={error}
            selectedSponsor={selectedSponsor}
          />
        );
      case 'knowledge':
        return (
          <Knowledgebase
            knowledgeStats={knowledgeStats}
            exportUpdatedXml={validator.exportUpdatedXml}
            setActivityLog={setActivityLog}
          />
        );
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
      <div style={{ marginBottom: 24 }}>
        <SponsorSelector
          sponsors={sponsors}
          selectedSponsor={selectedSponsor}
          setSelectedSponsor={setSelectedSponsor}
        />
        {selectedSponsor && (
          <span style={{ marginLeft: '1em', color: '#888' }}>
            Current sponsor: <b>{selectedSponsor}</b>
          </span>
        )}
      </div>
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
