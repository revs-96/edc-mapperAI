import React, { useState } from 'react';
import { Layout, Menu, Upload, Button, Typography, Table, message, Card, Steps, Badge, List, Space, Divider, Alert } from 'antd';
import { UploadOutlined, FileSearchOutlined, CheckCircleOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const navItems = [
  { key: 'trainer', icon: <SettingOutlined />, label: 'Model Trainer' },
  { key: 'predictor', icon: <FileSearchOutlined />, label: 'Mappings Predictor' },
  { key: 'validator', icon: <CheckCircleOutlined />, label: 'Mapping Validator' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: 'Trained Knowledgebase' }
];

const dummyColumns = [
  { title: 'IMPACTVisitID', dataIndex: 'IMPACTVisitID' },
  { title: 'EDCVisitID', dataIndex: 'EDCVisitID' },
  { title: 'IMPACTAttributeID', dataIndex: 'IMPACTAttributeID' },
  { title: 'EDCAttributeID', dataIndex: 'EDCAttributeID' },
  {
    title: 'Valid Mapping',
    dataIndex: 'valid',
    render: (valid) =>
      valid ? <Badge status="success" text="Yes" /> : <Badge status="error" text="No" />
  }
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('trainer');
  const [trainFiles, setTrainFiles] = useState({ odm: null, view: null });
  const [testFile, setTestFile] = useState(null);
  const [userViewmapFile, setUserViewmapFile] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [predictResult, setPredictResult] = useState([]);
  const [validationResult, setValidationResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editableMappings, setEditableMappings] = useState([]);
  const [currentOdmFileName, setCurrentOdmFileName] = useState(null);


  const apiBase = 'http://localhost:8000';

  // Upload props for Ant Design Upload
  const odmProps = {
    beforeUpload: (file) => {
      setTrainFiles(f => ({ ...f, odm: file }));
      return false; // Prevent auto upload
    },
    fileList: trainFiles.odm ? [trainFiles.odm] : [],
    onRemove: () => setTrainFiles(f => ({ ...f, odm: null }))
  };

  const viewProps = {
    beforeUpload: (file) => {
      setTrainFiles(f => ({ ...f, view: file }));
      return false;
    },
    fileList: trainFiles.view ? [trainFiles.view] : [],
    onRemove: () => setTrainFiles(f => ({ ...f, view: null }))
  };

  const testProps = {
    beforeUpload: (file) => {
      setTestFile(file);
      return false;
    },
    fileList: testFile ? [testFile] : [],
    onRemove: () => setTestFile(null)
  };

  const userViewmapProps = {
    beforeUpload: (file) => {
      setUserViewmapFile(file);
      return false;
    },
    fileList: userViewmapFile ? [userViewmapFile] : [],
    onRemove: () => setUserViewmapFile(null)
  };

  // API Calls

  const handleTrain = async () => {
    if (!trainFiles.odm || !trainFiles.view) {
      message.error('Upload both ODM and ViewMapping files!');
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMsg('');
    const form = new FormData();
    form.append('odm', trainFiles.odm);
    form.append('viewmap', trainFiles.view);
    try {
      const res = await fetch(`${apiBase}/train/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Training failed');
      setStatusMsg('Model trained successfully.');
      setModelReady(true);
    } catch (err) {
      setError(err.message);
      setModelReady(false);
    }
    setLoading(false);
  };

  const handlePredict = async () => {
    if (!testFile) {
      message.error('Upload a test ODM file!');
      return;
    }
    setLoading(true);
    setError(null);
    setPredictResult([]);
    const form = new FormData();
    form.append('testodm', testFile);
    try {
      const res = await fetch(`${apiBase}/predict/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prediction failed');
      setPredictResult(data.mappings);
      setEditableMappings(data.mappings.map(m => ({ ...m }))); // Cloned for editing
      setCurrentOdmFileName(testFile.name); // Store for save/export
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };


  const handleValidate = async () => {
    if (!userViewmapFile) {
      message.error('Upload a ViewMapping file for validation!');
      return;
    }
    setLoading(true);
    setError(null);
    setValidationResult([]);
    const form = new FormData();
    form.append('user_viewmap', userViewmapFile);
    try {
      const res = await fetch(`${apiBase}/validate/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      setValidationResult(data.validation);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const saveMappings = async () => {
    if (!currentOdmFileName) {
      message.error("No ODM file associated with mappings to save.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase}/save_mappings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: editableMappings,
          odm_filename: currentOdmFileName,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        message.success("Mappings saved!");
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err) {
      setError(err.message);
      message.error(err.message);
    }
    setLoading(false);
  };

  

  // UI components
  const menu = (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[selectedMenu]}
      onClick={e => setSelectedMenu(e.key)}
      items={navItems.map(item => ({
        key: item.key,
        icon: item.icon,
        label: item.label
      }))}
      style={{ fontWeight: 500, fontSize: 16 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible={false} theme="light" width={255} style={{ borderRight: '1px solid #e2e7ec' }}>
        <div style={{ margin: 24, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32, color: '#2173d7' }}>📘</span>
          <span>
            <Title level={4} style={{ margin: 0 }}>EDC Data Mapper</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Clinical Data Management</Text>
          </span>
        </div>
        <Divider style={{ marginTop: 16, marginBottom: 8 }} />
        {menu}
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, boxShadow: '0 1px 3px #f3f5f8', height: 58 }} />
        <Content style={{ margin: '24px 34px' }}>
          {selectedMenu === 'trainer' && (
            <Card
              title={<span style={{ fontSize: 25, fontWeight: 600 }}>Model Trainer</span>}
              style={{ maxWidth: 900, margin: '32px auto' }}
            >
              <Steps
                current={0}
                items={[
                  { title: 'Upload ODM & ViewMapping' },
                  { title: 'Train Model' }
                ]}
                style={{ marginBottom: 38, maxWidth: 540 }}
              />
              <Space align="start" size="large">
                <div>
                  <Upload {...odmProps} accept=".xml">
                    <Button icon={<UploadOutlined />}>ODM File Upload</Button>
                  </Upload>
                  <br /><br />
                  <Upload {...viewProps} accept=".xml">
                    <Button icon={<UploadOutlined />}>ViewMapping File Upload</Button>
                  </Upload>
                </div>
                <Button
                  type="primary"
                  size="large"
                  style={{ marginTop: 42, fontWeight: 600 }}
                  loading={loading}
                  onClick={handleTrain}
                >
                  Start Training
                </Button>
              </Space>
              <Divider />
              <Text type="success" style={{ fontSize: 16 }}>{statusMsg}</Text>
              {error && <Alert type="error" message={error} style={{ marginTop: 20 }} />}
            </Card>
          )}

          {selectedMenu === 'predictor' && (
            <Card
              title={<span style={{ fontSize: 25, fontWeight: 600 }}>Mappings Predictor</span>}
              style={{ maxWidth: 900, margin: '32px auto' }}
            >
              <List
                header={<span style={{ fontSize: 18, fontWeight: 500 }}>Test ODM File Upload</span>}
                bordered
                style={{ maxWidth: 500, marginBottom: 22 }}
                dataSource={[]}
                renderItem={() => null}
              />
              <Space>
                <Upload {...testProps} accept=".xml">
                  <Button icon={<UploadOutlined />}>Select File</Button>
                </Upload>
                <Button
                  type="primary"
                  icon={<FileSearchOutlined />}
                  disabled={!testFile || !modelReady}
                  loading={loading}
                  onClick={handlePredict}
                >
                  Predict Mappings
                </Button>
                <span>
                  <Badge status={modelReady ? "success" : "error"} />
                  Model Status: <b>{modelReady ? "Ready" : "No Model Available"}</b>
                </span>
              </Space>
              <Divider />
              {predictResult.length > 0 && (
                <Table
                  columns={[
                    { title: "StudyEventOID", dataIndex: "StudyEventOID" },
                    { title: "ItemOID", dataIndex: "ItemOID" },
                    { title: "IMPACTVisitID", dataIndex: "IMPACTVisitID" }
                  ]}
                  dataSource={predictResult.map((r, i) => ({ key: i, ...r }))}
                  pagination={false}
                  style={{ marginTop: 32 }}
                />
              )}
              {error && <Alert type="error" message={error} style={{ marginTop: 20 }} />}
            </Card>
          )}

          {selectedMenu === 'validator' && (
            <Card
              title={<span style={{ fontSize: 25, fontWeight: 600 }}>Mapping Validator</span>}
              style={{ maxWidth: 950, margin: '32px auto' }}
            >
              <Space align="start" style={{ width: '100%' }}>
                <Upload {...userViewmapProps} accept=".xml">
                  <Button icon={<UploadOutlined />}>Upload ViewMapping</Button>
                </Upload>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={!userViewmapFile || !modelReady}
                  loading={loading}
                  onClick={handleValidate}
                >Start Validation</Button>
                <div style={{
                  border: "1px solid #e3e7ed",
                  borderRadius: 7,
                  padding: 18,
                  background: "#f5f8fa",
                  minWidth: 240
                }}>
                  <Text strong>Validation Criteria</Text>
                  <ul style={{ paddingLeft: 20, fontSize: 15 }}>
                    <li>Mapping consistency with trained model</li>
                    <li>XML structure validation</li>
                    <li>Attribute completeness check</li>
                    <li>Visit ID compatibility</li>
                  </ul>
                </div>
              </Space>
              <Divider />
              <Table
                columns={dummyColumns}
                dataSource={validationResult.map((r, i) => ({ ...r, key: i }))}
                pagination={false}
                style={{ marginTop: 24 }}
              />
              {error && <Alert type="error" message={error} style={{ marginTop: 20 }} />}
            </Card>
          )}

          {selectedMenu === 'knowledge' && (
            <Card title="Trained Knowledgebase (Coming Soon)" style={{ maxWidth: 750, margin: '36px auto' }}>
              <p>View details and analytics of your trained mapping models.</p>
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
