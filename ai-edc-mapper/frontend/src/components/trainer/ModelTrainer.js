import React from 'react';
import { Card, Steps, Space, Upload, Button, Typography, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ModelTrainer = ({ odmProps, viewProps, handleTrain, clearFiles, loading, statusMsg, error }) => {
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
          <Button type="primary" onClick={handleTrain} loading={loading} disabled={!odmProps.fileList.length || !viewProps.fileList.length}>Start Training</Button>
          <Button onClick={clearFiles}>Clear</Button>
        </Space>

        <Text type="secondary">Status: {statusMsg}</Text>
        {error && <Alert type="error" message={error} />}
      </Space>
    </Card>
  );
};

export default ModelTrainer;