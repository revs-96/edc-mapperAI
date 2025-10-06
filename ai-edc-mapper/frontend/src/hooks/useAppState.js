import { useState, useRef, useEffect } from 'react';
import { message } from 'antd';

export const useAppState = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('knowledge');
  const [selectedSponsor, setSelectedSponsor] = useState('Sponsor A');
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('No model loaded');
  const [error, setError] = useState(null);
  const [themeDark, setThemeDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [knowledgeStats, setKnowledgeStats] = useState({ sponsors: [], models: 0, mappings: 0, accuracy: 0, last_updated: '—' });
  const apiBase = useRef('http://localhost:8000').current;

  useEffect(() => {
    let mounted = true;
    async function fetchModelStatus() {
      try {
        const res = await fetch(`${apiBase}/model_status/`);
        const data = await res.json();
        if (!mounted) return;
        const available = data.available_sponsors || [];
        setKnowledgeStats(prev => ({ ...prev, sponsors: available }));
        const isReady = available.includes(selectedSponsor);
        setModelReady(isReady);
        setStatusMsg(isReady ? `${selectedSponsor} model ready` : `${selectedSponsor} model not available`);
      } catch (err) {
        if (!mounted) return;
        setModelReady(false);
        setStatusMsg('Model status unavailable');
      }
    }
    fetchModelStatus();
    const t = setInterval(fetchModelStatus, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [apiBase, selectedSponsor]);

  const addActivity = (type, msg) => {
    setActivityLog(prev => [{ type, msg, time: new Date().toLocaleString() }, ...prev]);
  };

  const updateKnowledgeStats = (updates) => {
    setKnowledgeStats(prev => ({ ...prev, ...updates }));
  };

  return {
    collapsed, setCollapsed,
    selectedMenu, setSelectedMenu,
    selectedSponsor, setSelectedSponsor,
    modelReady, setModelReady,
    loading, setLoading,
    statusMsg, setStatusMsg,
    error, setError,
    themeDark, setThemeDark,
    drawerOpen, setDrawerOpen,
    activityLog, setActivityLog,
    knowledgeStats, setKnowledgeStats,
    apiBase,
    addActivity,
    updateKnowledgeStats
  };
};