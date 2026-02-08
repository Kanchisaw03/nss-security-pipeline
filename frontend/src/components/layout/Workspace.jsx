import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigation, MODULES } from '../../contexts/NavigationContext';
import { MODULE_CONFIG } from '../../contexts/NavigationContext';

// Import all screen components
import GovernanceCommand from '../screens/GovernanceCommand';
import IngestionScreen from '../screens/IngestionScreen';
import ClassificationScreen from '../screens/ClassificationScreen';
import RiskEngineScreen from '../screens/RiskEngineScreen';
import AttackLabScreen from '../screens/AttackLabScreen';
import AnonymizationScreen from '../screens/AnonymizationScreen';
import ReleasePipelineScreen from '../screens/ReleasePipelineScreen';
import DPMonitorScreen from '../screens/DPMonitorScreen';
import AuditChainScreen from '../screens/AuditChainScreen';
import ComplianceScreen from '../screens/ComplianceScreen';
import ReportsScreen from '../screens/ReportsScreen';

const screenComponents = {
  [MODULES.GOVERNANCE]: GovernanceCommand,
  [MODULES.INGESTION]: IngestionScreen,
  [MODULES.CLASSIFICATION]: ClassificationScreen,
  [MODULES.RISK]: RiskEngineScreen,
  [MODULES.ATTACK_LAB]: AttackLabScreen,
  [MODULES.ANONYMIZATION]: AnonymizationScreen,
  [MODULES.RELEASE]: ReleasePipelineScreen,
  [MODULES.DP_MONITOR]: DPMonitorScreen,
  [MODULES.AUDIT]: AuditChainScreen,
  [MODULES.COMPLIANCE]: ComplianceScreen,
  [MODULES.REPORTS]: ReportsScreen,
};

const Workspace = () => {
  const { activeModule, breadcrumbs } = useNavigation();
  
  const ActiveScreen = screenComponents[activeModule] || GovernanceCommand;
  const moduleConfig = MODULE_CONFIG[activeModule];

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Breadcrumb Header */}
      <div className="h-12 border-b border-border-panel flex items-center px-6 bg-bg-panel">
        <nav className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span className="text-gray-600">/</span>
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-white font-medium">{crumb.label}</span>
              ) : (
                <button 
                  onClick={() => crumb.path && navigateTo(crumb.path)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
        
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-gray-500">{moduleConfig.description}</span>
        </div>
      </div>

      {/* Screen Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ActiveScreen />
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
};

export default Workspace;