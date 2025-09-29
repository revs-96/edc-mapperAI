import React from 'react';
import { Row, Col, Card, Statistic, Divider, List, Typography } from 'antd';

const { Title, Text } = Typography;

const Dashboard = ({ knowledgeStats, activityLog, setActivityLog }) => {
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
};

export default Dashboard;