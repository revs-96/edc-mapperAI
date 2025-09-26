import React, { useEffect, useState, useRef } from 'react';
import {
  Layout, Menu, Upload, Button, Typography, Table, message, Card, Steps,
  Badge, Space, Divider, Alert, Drawer, Switch, Row, Col, Tooltip, Modal,
  Form, Input, Progress, Statistic, List, Tag
} from 'antd';
import {
  UploadOutlined, FileSearchOutlined, CheckCircleOutlined, DatabaseOutlined,
  SettingOutlined, HomeOutlined, SaveOutlined, CloudUploadOutlined, SearchOutlined,
  InfoCircleOutlined, ExportOutlined
} from '@ant-design/icons';
import './App.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: 'dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
  { key: 'trainer', icon: <SettingOutlined />, label: 'Model Trainer' },
  { key: 'predictor', icon: <FileSearchOutlined />, label: 'Mappings Predictor' },
  { key: 'validator', icon: <CheckCircleOutlined />, label: 'Mapping Validator' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: 'Trained Knowledgebase' }
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('knowledge');
  const [trainFiles, setTrainFiles] = useState({ odm: null, view: null });
  const [testFile, setTestFile] = useState(null);
  const [userViewmapFile, setUserViewmapFile] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('No model loaded');
  const [error, setError] = useState(null);
  const [predictResult, setPredictResult] = useState([]);
  const [validationResult, setValidationResult] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeDark, setThemeDark] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeMapping, setActiveMapping] = useState(null);
  const [editableMappings, setEditableMappings] = useState([]);
  const [currentOdmFileName, setCurrentOdmFileName] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [knowledgeStats, setKnowledgeStats] = useState({ models: 0, mappings: 0, accuracy: 0, last_updated: '—' });

  const apiBase = useRef('http://localhost:8000').current;

  useEffect(() => {
    let mounted = true;
    async function fetchModelStatus() {
      try {
        const res = await fetch(`${apiBase}/model_status/`);
        const data = await res.json();
        if (!mounted) return;
        setModelReady(Boolean(data.available));
        setStatusMsg(data.available ? 'Model ready' : 'No model available');
      } catch (err) {
        if (!mounted) return;
        setModelReady(false);
        setStatusMsg('Model status unavailable');
      }
    }
    fetchModelStatus();
    const t = setInterval(fetchModelStatus, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [apiBase]);

  // Upload props factory
  const makeUploadProps = (setter, fileState) => ({
    beforeUpload: (file) => { setter(file); return false; },
    fileList: fileState ? [fileState] : [],
    onRemove: () => setter(null)
  });

  const odmProps = makeUploadProps((f) => setTrainFiles(prev => ({ ...prev, odm: f })), trainFiles.odm);
  const viewProps = makeUploadProps((f) => setTrainFiles(prev => ({ ...prev, view: f })), trainFiles.view);
  const testProps = makeUploadProps(setTestFile, testFile);
  const userViewmapProps = makeUploadProps(setUserViewmapFile, userViewmapFile);

  // API handlers (same endpoints as your backend)
  const handleTrain = async () => {
    if (!trainFiles.odm || !trainFiles.view) return message.error('Upload both ODM and ViewMapping files');
    setLoading(true); setError(null); setStatusMsg('Training...');
    const form = new FormData();
    form.append('odm', trainFiles.odm);
    form.append('viewmap', trainFiles.view);
    try {
      const res = await fetch(`${apiBase}/train/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Training failed');
      setModelReady(true);
      setStatusMsg('Model trained successfully');
      setActivityLog(prev => [{ type: 'train', msg: `Model trained from ${trainFiles.odm.name}`, time: new Date().toLocaleString() }, ...prev]);
      // update knowledge stats locally
      setKnowledgeStats(s => ({ ...s, models: s.models + 1, last_updated: new Date().toLocaleString() }));
      message.success('Training complete');
    } catch (err) {
      setError(err.message);
      setModelReady(false);
      setStatusMsg('Training error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const handlePredict = async () => {
    if (!testFile) return message.error('Upload a test ODM file');
    setLoading(true); setError(null); setPredictResult([]);
    const form = new FormData(); form.append('testodm', testFile);
    try {
      const res = await fetch(`${apiBase}/predict/`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prediction failed');
      const mappings = data.mappings || [];
      setPredictResult(mappings);
      setEditableMappings(mappings.map((m, i) => ({ key: i, ...m })));
      setCurrentOdmFileName(testFile.name);
      setActivityLog(prev => [{ type: 'predict', msg: `Predicted mappings for ${testFile.name} (${mappings.length})`, time: new Date().toLocaleString() }, ...prev]);
      // update knowledge stats locally
      setKnowledgeStats(s => ({ ...s, mappings: s.mappings + mappings.length }));
      setStatusMsg('Predictions ready');
    } catch (err) {
      setError(err.message);
      setStatusMsg('Prediction error');
      message.error(err.message);
    }
    setLoading(false);
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
      setActivityLog(prev => [{ type: 'validate', msg: `Validated ${userViewmapFile.name} (${data.validation?.length ?? 0})`, time: new Date().toLocaleString() }, ...prev]);
      // compute a rough accuracy locally for demo
      const wrong = (data.validation || []).filter(r => r.wrongly_mapped).length;
      const total = (data.validation || []).length || 1;
      const acc = Math.max(0, Math.round(((total - wrong) / total) * 10000) / 100);
      setKnowledgeStats(s => ({ ...s, accuracy: Math.round(((s.accuracy + acc) / 2) * 100) / 100 }));
      setStatusMsg('Validation complete');
    } catch (err) {
      setError(err.message);
      setStatusMsg('Validation error');
      message.error(err.message);
    }
    setLoading(false);
  };

  const saveMappings = async () => {
    if (!currentOdmFileName) return message.error('No ODM file associated');
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${apiBase}/save_mappings/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: editableMappings, odm_filename: currentOdmFileName })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      setActivityLog(prev => [{ type: 'save', msg: `Saved mappings for ${currentOdmFileName}`, time: new Date().toLocaleString() }, ...prev]);
      message.success('Mappings saved');
    } catch (err) {
      setError(err.message); message.error(err.message);
    }
    setLoading(false);
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

  const openEditModal = (row) => { setActiveMapping(row); setModalVisible(true); };
  const applyEdit = (values) => {
    setEditableMappings(prev => prev.map(m => m.key === activeMapping.key ? { ...m, ...values } : m));
    setModalVisible(false); message.success('Mapping updated (local)');
  };

  // Table columns
  const predictorColumns = [
    { title: 'StudyEventOID', dataIndex: 'StudyEventOID', key: 'StudyEventOID' },
    { title: 'ItemOID', dataIndex: 'ItemOID', key: 'ItemOID' },
    { title: 'IMPACTVisitID', dataIndex: 'IMPACTVisitID', key: 'IMPACTVisitID' },
    { title: 'Actions', key: 'actions', render: (_, row) => (<Space><Button size="small" onClick={() => openEditModal(row)}>Edit</Button></Space>) }
  ];

  const validatorColumns = [
    { title: 'IMPACTVisitID', dataIndex: 'IMPACTVisitID' },
    { title: 'EDCVisitID', dataIndex: 'EDCVisitID' },
    { title: 'IMPACTAttributeID', dataIndex: 'IMPACTAttributeID' },
    { title: 'EDCAttributeID', dataIndex: 'EDCAttributeID' },
    { title: 'TrueMappings', dataIndex: 'TrueMappings', render: (truemaps) => (!truemaps || truemaps.length === 0) ? '-' : (
      <ul style={{ paddingLeft: 18, margin: 0 }}>{truemaps.map((t, i) => <li key={i}>{t.field} - {t.correct_options.join(', ')}</li>)}</ul>
    ) }
  ];

  // Row styling: highlight wrongly_mapped
  const validatorRowClass = (record) => record.wrongly_mapped ? 'row-error' : '';

  // Knowledge / analytics UI
  const KnowledgeHeader = () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>Trained Knowledgebase Repository</Title>
        <Text type="secondary">Explore and monitor trained models, mappings and end-to-end metrics</Text>
      </div>
      <Space>
        <Button icon={<ExportOutlined />} onClick={exportUpdatedXml}>Export Updated ODM</Button>
        <Button onClick={() => { setActivityLog([]); message.info('Cleared activity'); }}>Clear Activity</Button>
      </Space>
    </div>
  );

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return (
          <div>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card className="stat-card" bordered={false}>
                  <Statistic title="Trained Models" value={knowledgeStats.models} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="stat-card" bordered={false}>
                  <Statistic title="Total Mappings" value={knowledgeStats.mappings} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="stat-card" bordered={false}>
                  <Statistic title="Avg Accuracy" value={`${knowledgeStats.accuracy}%`} />
                </Card>
              </Col>
            </Row>

            <Divider />

            <Card title="Recent Activity" style={{ borderRadius: 12 }}>
              {activityLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <img src="/no_activity_illustration.png" alt="no activity" style={{ width: 120, opacity: 0.7 }} />
                  <Title level={4}>No recent activity</Title>
                  <Text type="secondary">Train a model to get started.</Text>
                </div>
              ) : (
                <List dataSource={activityLog} renderItem={item => (
                  <List.Item>
                    <List.Item.Meta title={<b>{item.msg}</b>} description={item.time} />
                  </List.Item>
                )} />
              )}
            </Card>

          </div>
        );

      case 'trainer':
        return (
          <Card title={<b>Model Trainer</b>} style={{ borderRadius: 12, maxWidth: 1100 }}>
            <Steps current={0} style={{ marginBottom: 18 }}>
              <Steps.Step title="Upload" />
              <Steps.Step title="Train" />
              <Steps.Step title="Complete" />
            </Steps>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Upload {...odmProps} accept=".xml"><Button icon={<UploadOutlined />}>Upload ODM</Button></Upload>
                <Upload {...viewProps} accept=".xml"><Button icon={<UploadOutlined />}>Upload ViewMapping</Button></Upload>
                <Button type="primary" onClick={handleTrain} loading={loading} disabled={!trainFiles.odm || !trainFiles.view}>Start Training</Button>
                <Button onClick={() => { setTrainFiles({ odm: null, view: null }); message.info('Cleared'); }}>Clear</Button>
              </Space>

              <Text type="secondary">Status: {statusMsg}</Text>
              {error && <Alert type="error" message={error} />}
            </Space>
          </Card>
        );

      case 'predictor':
        return (
          <Card title={<b>Mappings Predictor</b>} style={{ borderRadius: 12, maxWidth: 1200 }}>
            <Space style={{ marginBottom: 12 }}>
              <Upload {...testProps} accept=".xml"><Button icon={<UploadOutlined />}>Select ODM Test File</Button></Upload>
              <Button type="primary" icon={<SearchOutlined />} disabled={!testFile || !modelReady} onClick={handlePredict} loading={loading}>Predict Mappings</Button>
              <Tooltip title={modelReady ? 'Model available' : 'No model trained'}><Badge status={modelReady ? 'success' : 'error'} /></Tooltip>
              <Button icon={<SaveOutlined />} onClick={saveMappings} disabled={!editableMappings.length}>Save Mappings</Button>
            </Space>

            <Divider />

            {predictResult.length === 0 ? (
              <Text type="secondary">No predictions yet — upload a test ODM and click Predict.</Text>
            ) : (
              <Table
                columns={predictorColumns}
                dataSource={editableMappings}
                pagination={{ pageSize: 8 }}
                rowClassName={(r) => r.wrongly_mapped ? 'row-error' : ''}
                className="fancy-table"
              />
            )}
            {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
          </Card>
        );

      case 'validator':
        return (
          <div>
            <Card title={<b>Mapping Validator</b>} style={{ borderRadius: 12, maxWidth: 1200 }}>
              <Space style={{ marginBottom: 12 }}>
                <Upload {...userViewmapProps} accept=".xml"><Button icon={<UploadOutlined />}>Upload ViewMapping</Button></Upload>
                <Button type="primary" icon={<CheckCircleOutlined />} disabled={!userViewmapFile || !modelReady} loading={loading} onClick={handleValidate}>Start Validation</Button>
                <Button onClick={() => { setValidationResult([]); message.info('Cleared'); }}>Clear</Button>
                <Button onClick={() => exportUpdatedXml()}>Export Updated ODM</Button>
              </Space>

              <Divider />

              <Table
                columns={validatorColumns}
                dataSource={validationResult.map((r, i) => ({ ...r, key: i }))}
                pagination={{ pageSize: 10 }}
                rowClassName={validatorRowClass}
                className="fancy-table"
              />
              {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
            </Card>

            <Divider />

            <Card title="Validation Summary" style={{ borderRadius: 12, maxWidth: 1200 }}>
              <Row gutter={16}>
                <Col xs={24} md={8}><Statistic title="Total Rows" value={validationResult.length} /></Col>
                <Col xs={24} md={8}><Statistic title="Wrongly Mapped" value={validationResult.filter(r => r.wrongly_mapped).length} /></Col>
                <Col xs={24} md={8}><Statistic title="Correctly Mapped" value={validationResult.filter(r => !r.wrongly_mapped).length} /></Col>
              </Row>
            </Card>
          </div>
        );

      case 'knowledge':
        return (
          <div>
            <KnowledgeHeader />
            <Divider />
            <Row gutter={16} style={{ marginBottom: 18 }}>
              <Col xs={24} md={6}><Card className="analytics-card"><Statistic title="Trained Models" value={knowledgeStats.models} /></Card></Col>
              <Col xs={24} md={6}><Card className="analytics-card"><Statistic title="Total Mappings" value={knowledgeStats.mappings} /></Card></Col>
              <Col xs={24} md={6}><Card className="analytics-card"><Statistic title="Avg Accuracy" value={`${knowledgeStats.accuracy}%`} /></Card></Col>
              <Col xs={24} md={6}><Card className="analytics-card"><Statistic title="Last Updated" value={knowledgeStats.last_updated} /></Card></Col>
            </Row>

            <Card style={{ borderRadius: 12, marginBottom: 18 }}>
              <div style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa6b2' }}>
                {knowledgeStats.models === 0 ? (
                  <div style={{ textAlign: 'center' }}>
                    <img src="/mnt/data/WhatsApp Image 2025-09-24 at 00.23.53_cb6ba844.jpg" alt="no models" style={{ width: 120, opacity: 0.9 }} />
                    <Title level={4}>No Trained Models</Title>
                    <Text type="secondary">Train your first model using the Model Trainer to see knowledgebase entries here.</Text>
                  </div>
                ) : (
                  <div>/* future: graphs, timelines, model versions */</div>
                )}
              </div>
            </Card>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Card title="Model Versions" style={{ borderRadius: 12 }}>
                  <Text type="secondary">No versions yet.</Text>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card title="Usage & Performance" style={{ borderRadius: 12 }}>
                  <Text type="secondary">Analytics will appear here once models are trained and used.</Text>
                </Card>
              </Col>
            </Row>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout className={themeDark ? 'app-root dark' : 'app-root'} style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={260} style={{ background: themeDark ? '#071427' : '#fff' }}>
        <div className="logo" style={{ padding: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 26 }}>📘</div>
          {!collapsed && (<div><Title level={4} style={{ margin: 0, color: '#1e6fbe' }}>EDC Data Mapper</Title><Text type="secondary">Clinical Data Management</Text></div>) }
        </div>

        <Menu theme="light" mode="inline" selectedKeys={[selectedMenu]} onClick={(e) => setSelectedMenu(e.key)} items={NAV_ITEMS.map(i => ({ key: i.key, icon: i.icon, label: i.label }))} style={{ borderRight: 0 }} />

        <div style={{ padding: 16, marginTop: 'auto' }}>
          <Button block onClick={() => setDrawerOpen(true)}>App Settings</Button>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Theme</Text>
            <div><Switch checked={themeDark} onChange={setThemeDark} checkedChildren="Dark" unCheckedChildren="Light" /></div>
          </div>
        </div>
      </Sider>

      <Layout>
        <Header style={{ padding: '8px 20px', background: themeDark ? '#061226' : 'linear-gradient(90deg,#2173d7,#4fa3f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>{NAV_ITEMS.find(n => n.key === selectedMenu)?.label || 'EDC'}</Title>
            <Text style={{ color: '#fff' }}>{selectedMenu.toUpperCase()}</Text>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Badge status={modelReady ? 'success' : 'error'} />
            <Text style={{ color: '#fff' }}>{modelReady ? 'Model Ready' : 'No Model'}</Text>
            <Button onClick={() => { setSelectedMenu('knowledge'); message.info('Opened knowledgebase'); }}>Open Knowledge</Button>
          </div>
        </Header>

        <Content style={{ margin: '24px', overflow: 'auto' }}>
          {renderContent()}
        </Content>

        <Footer style={{ textAlign: 'center' }}>EDC Data Mapper • Built for Clinical Data Teams</Footer>
      </Layout>

      <Drawer title="App Settings" placement="right" onClose={() => setDrawerOpen(false)} open={drawerOpen} width={420}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>Model</Text>
          <Button onClick={() => { setModelReady(false); setStatusMsg('Model reset (local)'); message.info('Model reset (local)'); }}>Reset Model (local)</Button>

          <Divider />

          <Text strong>Appearance</Text>
          <div>
            <Text>Theme</Text>
            <div style={{ marginTop: 8 }}><Switch checked={themeDark} onChange={setThemeDark} checkedChildren="Dark" unCheckedChildren="Light" /></div>
          </div>

          <Divider />

          <Text strong>Advanced</Text>
          <div><Button onClick={() => { navigator.clipboard?.writeText(window.location.href); message.success('URL copied'); }}>Copy App URL</Button></div>
        </Space>
      </Drawer>

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
        ) : <Text>No mapping selected</Text>}
      </Modal>
    </Layout>
  );
}
