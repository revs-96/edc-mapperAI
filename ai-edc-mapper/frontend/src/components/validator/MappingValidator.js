import React from 'react';
import { Card, Space, Upload, Button, Typography, Table, Divider, Alert, Statistic, Row, Col } from 'antd';
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

const MappingValidator = ({
  userViewmapProps, handleValidate, modelReady, loading, validationResult, clearValidation, exportUpdatedXml, error
}) => {
  const validatorColumns = [
    { title: 'IMPACTVisitID', dataIndex: 'IMPACTVisitID' },
    { title: 'EDCVisitID', dataIndex: 'EDCVisitID' },
    { title: 'IMPACTAttributeID', dataIndex: 'IMPACTAttributeID' },
    { title: 'EDCAttributeID', dataIndex: 'EDCAttributeID' },
    { title: 'TrueMappings', dataIndex: 'TrueMappings', render: (truemaps) => (!truemaps || truemaps.length === 0) ? '-' : (
      <ul style={{ paddingLeft: 18, margin: 0 }}>{truemaps.map((t, i) => <li key={i}>{t.field} - {t.correct_options.join(', ')}</li>)}</ul>
    ) }
  ];

  const validatorRowClass = (record) => record.wrongly_mapped ? 'row-error' : '';

  return (
    <div>
      <Card title={<b>Mapping Validator</b>} style={{ borderRadius: 12, maxWidth: 1200 }}>
        <Space style={{ marginBottom: 12 }}>
          <Upload {...userViewmapProps}><Button icon={<UploadOutlined />}>Upload ViewMapping</Button></Upload>
          <Button type="primary" icon={<CheckCircleOutlined />} disabled={!userViewmapProps.fileList.length || !modelReady} loading={loading} onClick={handleValidate}>Start Validation</Button>
          <Button onClick={clearValidation}>Clear</Button>
          <Button onClick={exportUpdatedXml}>Export Updated ODM</Button>
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
};

export default MappingValidator;