import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext(null);

export const MODULES = {
  GOVERNANCE: 'governance',
  INGESTION: 'ingestion',
  CLASSIFICATION: 'classification',
  RISK: 'risk',
  ATTACK_LAB: 'attack-lab',
  ANONYMIZATION: 'anonymization',
  RELEASE: 'release',
  DP_MONITOR: 'dp-monitor',
  AUDIT: 'audit',
  COMPLIANCE: 'compliance',
  REPORTS: 'reports',
};

export const MODULE_CONFIG = {
  [MODULES.GOVERNANCE]: {
    label: 'Governance Command',
    icon: 'Shield',
    description: 'System overview and command center',
    requiredRole: 'researcher',
  },
  [MODULES.INGESTION]: {
    label: 'Ingestion',
    icon: 'Upload',
    description: 'Raw dataset intake',
    requiredRole: 'admin',
  },
  [MODULES.CLASSIFICATION]: {
    label: 'Classification',
    icon: 'Tag',
    description: 'Field sensitivity mapping',
    requiredRole: 'reviewer',
  },
  [MODULES.RISK]: {
    label: 'Risk Engine',
    icon: 'Activity',
    description: 'Privacy risk analysis',
    requiredRole: 'reviewer',
  },
  [MODULES.ATTACK_LAB]: {
    label: 'Attack Lab',
    icon: 'Target',
    description: 'Re-identification simulation',
    requiredRole: 'admin',
  },
  [MODULES.ANONYMIZATION]: {
    label: 'Anonymization Control',
    icon: 'Fingerprint',
    description: 'Privacy transformation tuning',
    requiredRole: 'admin',
  },
  [MODULES.RELEASE]: {
    label: 'Release Pipeline',
    icon: 'GitBranch',
    description: 'Secure release execution',
    requiredRole: 'admin',
  },
  [MODULES.DP_MONITOR]: {
    label: 'DP Monitor',
    icon: 'Gauge',
    description: 'Differential privacy usage',
    requiredRole: 'reviewer',
  },
  [MODULES.AUDIT]: {
    label: 'Audit Chain',
    icon: 'List',
    description: 'Tamper-proof history',
    requiredRole: 'auditor',
  },
  [MODULES.COMPLIANCE]: {
    label: 'Compliance',
    icon: 'CheckCircle',
    description: 'DPDP Act mapping',
    requiredRole: 'auditor',
  },
  [MODULES.REPORTS]: {
    label: 'Reports',
    icon: 'FileText',
    description: 'Privacy-Utility reports',
    requiredRole: 'reviewer',
  },
};

export const NavigationProvider = ({ children }) => {
  const [activeModule, setActiveModule] = useState(MODULES.GOVERNANCE);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);

  const navigateTo = (module, params = {}) => {
    setActiveModule(module);
    
    // Build breadcrumbs
    const moduleConfig = MODULE_CONFIG[module];
    const newBreadcrumbs = [
      { label: 'System', path: MODULES.GOVERNANCE },
      { label: moduleConfig.label, path: module },
    ];
    
    if (params.submodule) {
      newBreadcrumbs.push({ label: params.submodule, path: null });
    }
    
    setBreadcrumbs(newBreadcrumbs);
  };

  const toggleContextPanel = () => {
    setContextPanelOpen(prev => !prev);
  };

  const value = {
    activeModule,
    breadcrumbs,
    contextPanelOpen,
    navigateTo,
    toggleContextPanel,
    MODULES,
    MODULE_CONFIG,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export default NavigationContext;