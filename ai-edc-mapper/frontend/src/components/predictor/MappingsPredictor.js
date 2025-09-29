import React from 'react';
import { Card, Space, Upload, Button, Typography, Table, Divider, Alert, Tooltip, Badge, Select, Input } from 'antd';
import { UploadOutlined, SearchOutlined, SaveOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MappingsPredictor = ({
  testProps, handlePredict, modelReady, loading, saveMappings, editableMappings,
  groupedUnmapped, mappedResult, handleUnmappedEdit, handleActionChange, error
}) => {

  // Table columns for mapped ODM's
  const predictorColumns = [
    { title: 'StudyEventOID', dataIndex: 'StudyEventOID', key: 'StudyEventOID' },
    { title: 'ItemOID', dataIndex: 'ItemOID', key: 'ItemOID' },
    { title: 'IMPACTVisitID', dataIndex: 'IMPACTVisitID', key: 'IMPACTVisitID' },
    {
      title: 'Actions', key: 'actions',
      render: (_, row) => (<Space><Button size="small" onClick={() => { /* your modal edit logic */ }}>Edit</Button></Space>)
    }
  ];

  // Table columns for unmapped ODM's
  const unmappedColumns = [
    {
      title: 'StudyEventOID',
      dataIndex: 'StudyEventOID',
      key: 'StudyEventOID',
    },
    {
      title: 'ItemOID',
      dataIndex: 'itemEdit',
      key: 'ItemOID',
      render: (val, row) => (
        <Select
          showSearch
          allowClear
          value={val || undefined}
          style={{ width: 160 }}
          disabled={!row.editMode}
          onChange={v => handleUnmappedEdit(row.key, "itemEdit", v)}
          options={row.itemOptions.map(io => ({ value: io, label: io }))}
          filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
          placeholder="Select ItemOID"
        />
      ),
    },
    {
      title: 'IMPACTVisitID',
      dataIndex: 'impactEdit',
      key: "IMPACTVisitID",
      render: (val, row) => (
        <Input
          disabled={!row.editMode}
          value={val}
          onChange={e => handleUnmappedEdit(row.key, "impactEdit", e.target.value)}
          placeholder="Enter IMPACTVisitID"
        />
      ),
    },
    {
      title: 'Actions',
      dataIndex: 'actions',
      key: 'actions',
      render: (_, row) => (
        <Select
          value={row.isIgnored ? "Ignore" : "Edit"}
          style={{ width: 100 }}
          onChange={val => handleActionChange(row.key, val)}
          options={[
            { value: "Ignore", label: "Ignore" },
            { value: "Edit", label: "Edit" }
          ]}
        />
      ),
    },
  ];

  return (
    <Card title={<b>Mappings Predictor</b>} style={{ borderRadius: 12, maxWidth: 1200 }}>
      <Space style={{ marginBottom: 12 }}>
        <Upload {...testProps}><Button icon={<UploadOutlined />}>Select ODM Test File</Button></Upload>
        <Button type="primary" icon={<SearchOutlined />} disabled={!testProps.fileList.length || !modelReady} onClick={handlePredict} loading={loading}>Predict Mappings</Button>
        <Tooltip title={modelReady ? 'Model available' : 'No model trained'}>
          <Badge status={modelReady ? 'success' : 'error'} />
        </Tooltip>
        <Button icon={<SaveOutlined />} onClick={saveMappings} disabled={!editableMappings.length && !groupedUnmapped.filter(r => !r.isIgnored && r.impactEdit && r.itemEdit).length}>Save Mappings</Button>
      </Space>
      <Divider />
      <Title level={5}>Mapped ODM's</Title>
      <Table
        columns={predictorColumns}
        dataSource={editableMappings}
        pagination={{ pageSize: 8 }}
        rowClassName={(r) => r.wrongly_mapped ? 'row-error' : ''}
        className="fancy-table"
      />
      <Divider />
      <Title level={5}>Unmapped ODM's</Title>
      <Table
        columns={unmappedColumns}
        dataSource={groupedUnmapped}
        pagination={false}
        rowClassName={r => r.isIgnored ? 'row-error' : ''}
        className="fancy-table"
      />
      {error && <Alert style={{ marginTop: 12 }} type="error" message={error} />}
    </Card>
  );
};

export default MappingsPredictor;
