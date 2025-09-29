import React from 'react';
import { Card, Row, Col, Statistic, Divider, Typography, Button, Space } from 'antd';
import { ExportOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const KnowledgeHeader = ({ exportUpdatedXml, setActivityLog }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
    <div>
      <Title level={2} style={{ margin: 0 }}>Trained Knowledgebase Repository</Title>
      <Text type="secondary">Explore and monitor trained models, mappings and end-to-end metrics</Text>
    </div>
    <Space>
      <Button icon={<ExportOutlined />} onClick={exportUpdatedXml}>Export Updated ODM</Button>
      <Button onClick={() => { setActivityLog([]); }}>Clear Activity</Button>
    </Space>
  </div>
);

const Knowledgebase = ({ knowledgeStats, exportUpdatedXml, setActivityLog }) => {
  return (
    <div>
      <KnowledgeHeader exportUpdatedXml={exportUpdatedXml} setActivityLog={setActivityLog} />
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
};

export default Knowledgebase;