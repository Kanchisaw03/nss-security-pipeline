import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  systemAPI, 
  riskAPI, 
  consentAPI, 
  dpAPI, 
  attackAPI,
  auditAPI 
} from '../services/api';

const SystemContext = createContext(null);

export const SystemProvider = ({ children }) => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [activeConsents, setActiveConsents] = useState([]);
  const [dpBudget, setDpBudget] = useState(null);
  const [attackStatus, setAttackStatus] = useState(null);
  const [auditChain, setAuditChain] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const setLoadingState = (key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  // Fetch system status
  const fetchSystemStatus = useCallback(async () => {
    try {
      setLoadingState('status', true);
      const response = await systemAPI.getStatus();
      setSystemStatus(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    } finally {
      setLoadingState('status', false);
    }
  }, []);

  // Fetch risk summary
  const fetchRiskSummary = useCallback(async () => {
    try {
      setLoadingState('risk', true);
      const response = await riskAPI.getSummary();
      setRiskSummary(response.data);
    } catch (err) {
      console.error('Failed to fetch risk summary:', err);
    } finally {
      setLoadingState('risk', false);
    }
  }, []);

  // Fetch active consents
  const fetchActiveConsents = useCallback(async () => {
    try {
      setLoadingState('consents', true);
      const response = await consentAPI.getActive();
      setActiveConsents(response.data || []);
    } catch (err) {
      console.error('Failed to fetch active consents:', err);
    } finally {
      setLoadingState('consents', false);
    }
  }, []);

  // Fetch DP budget
  const fetchDPBudget = useCallback(async () => {
    try {
      setLoadingState('dpBudget', true);
      const response = await dpAPI.getBudget();
      setDpBudget(response.data);
    } catch (err) {
      console.error('Failed to fetch DP budget:', err);
    } finally {
      setLoadingState('dpBudget', false);
    }
  }, []);

  // Fetch attack status
  const fetchAttackStatus = useCallback(async () => {
    try {
      setLoadingState('attack', true);
      const response = await attackAPI.getStatus();
      setAttackStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch attack status:', err);
    } finally {
      setLoadingState('attack', false);
    }
  }, []);

  // Fetch audit chain
  const fetchAuditChain = useCallback(async () => {
    try {
      setLoadingState('audit', true);
      const response = await auditAPI.validateChain();
      setAuditChain(response.data);
    } catch (err) {
      console.error('Failed to fetch audit chain:', err);
    } finally {
      setLoadingState('audit', false);
    }
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchSystemStatus(),
      fetchRiskSummary(),
      fetchActiveConsents(),
      fetchDPBudget(),
      fetchAttackStatus(),
      fetchAuditChain(),
    ]);
  }, [
    fetchSystemStatus,
    fetchRiskSummary,
    fetchActiveConsents,
    fetchDPBudget,
    fetchAttackStatus,
    fetchAuditChain,
  ]);

  // Initial load and periodic refresh
  useEffect(() => {
    refreshAll();
    
    // Refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    
    return () => clearInterval(interval);
  }, [refreshAll]);

  const value = {
    // Data
    systemStatus,
    riskSummary,
    activeConsents,
    dpBudget,
    attackStatus,
    auditChain,
    lastUpdate,
    
    // Loading states
    loading,
    
    // Error
    error,
    
    // Actions
    refreshAll,
    fetchSystemStatus,
    fetchRiskSummary,
    fetchActiveConsents,
    fetchDPBudget,
    fetchAttackStatus,
    fetchAuditChain,
    
    // Helpers
    isLoading: (key) => loading[key] || false,
  };

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};

export default SystemContext;