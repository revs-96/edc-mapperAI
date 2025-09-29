import React from 'react';
import { Layout, Menu, Button, Typography, Switch, Drawer, Badge, Space, Divider, message } from 'antd';
import {
  HomeOutlined, SettingOutlined, FileSearchOutlined, CheckCircleOutlined, DatabaseOutlined
} from '@ant-design/icons';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: 'dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
  { key: 'trainer', icon: <SettingOutlined />, label: 'Model Trainer' },
  { key: 'predictor', icon: <FileSearchOutlined />, label: 'Mappings Predictor' },
  { key: 'validator', icon: <CheckCircleOutlined />, label: 'Mapping Validator' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: 'Trained Knowledgebase' }
];

const AppLayout = ({
  collapsed, setCollapsed, selectedMenu, setSelectedMenu, themeDark, setThemeDark,
  drawerOpen, setDrawerOpen, modelReady, setModelReady, statusMsg, setStatusMsg, children
}) => {
  return (
    <Layout className={themeDark ? 'app-root dark' : 'app-root'} style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={260} style={{ background: themeDark ? '#071427' : '#fff' }}>
        <div className="logo" style={{ padding: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 26 }}>📘</div>
          {!collapsed && (
            <div>
              <Title level={4} style={{ margin: 0, color: '#1e6fbe' }}>EDC Data Mapper</Title>
              <Text type="secondary">Clinical Data Management</Text>
            </div>
          )}
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
          {children}
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
    </Layout>
  );
};

export default AppLayout;