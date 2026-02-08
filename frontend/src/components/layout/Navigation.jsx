import React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Upload,
  Tag,
  Activity,
  Target,
  Fingerprint,
  GitBranch,
  Gauge,
  List,
  CheckCircle,
  FileText,
  Lock,
  Download,
} from 'lucide-react';
import { useNavigation, MODULES, MODULE_CONFIG } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';

const iconMap = {
  Shield,
  Upload,
  Tag,
  Activity,
  Target,
  Fingerprint,
  GitBranch,
  Gauge,
  List,
  CheckCircle,
  FileText,
  Lock,
};

const Navigation = () => {
  const { activeModule, navigateTo, MODULES } = useNavigation();
  const { hasRole } = useAuth();

  const modules = [
    MODULES.GOVERNANCE,
    MODULES.INGESTION,
    MODULES.CLASSIFICATION,
    MODULES.RISK,
    MODULES.ATTACK_LAB,
    MODULES.ANONYMIZATION,
    MODULES.RELEASE,
    MODULES.DP_MONITOR,
    MODULES.AUDIT,
    MODULES.COMPLIANCE,
    MODULES.REPORTS,
  ];

  const isAccessible = (module) => {
    const config = MODULE_CONFIG[module];
    return hasRole(config.requiredRole);
  };

  // Export Audit Log function
  const handleExportAudit = () => {
    const auditData = {
      exportedAt: new Date().toISOString(),
      exportedBy: 'admin@system',
      chainValid: true,
      events: [
        {
          id: 'BLK-001',
          timestamp: '2026-02-08T10:15:00Z',
          event: 'DATASET_INGESTED',
          user: 'admin@system',
          hash: 'a3f2c1b4e5d6',
          prevHash: '0000000000',
          data: { datasetId: 'demo-healthcare-001', recordCount: 200, encrypted: true }
        },
        {
          id: 'BLK-002',
          timestamp: '2026-02-08T10:16:30Z',
          event: 'CLASSIFICATION_COMPLETED',
          user: 'admin@system',
          hash: 'b4d3e2f1a0c9',
          prevHash: 'a3f2c1b4e5d6',
          data: { datasetId: 'demo-healthcare-001', directIdentifiers: 2, quasiIdentifiers: 3 }
        },
        {
          id: 'BLK-003',
          timestamp: '2026-02-08T10:17:45Z',
          event: 'CONSENT_APPROVED',
          user: 'reviewer@org',
          hash: 'c5e4f3a2b1d0',
          prevHash: 'b4d3e2f1a0c9',
          data: { consentId: 'CNS-2026-001', researcherId: 'researcher@uni', purpose: 'research' }
        },
        {
          id: 'BLK-004',
          timestamp: '2026-02-08T10:20:00Z',
          event: 'RISK_ASSESSMENT',
          user: 'admin@system',
          hash: 'd6f5a4b3c2e1',
          prevHash: 'c5e4f3a2b1d0',
          data: { riskScore: 47, riskLevel: 'Medium' }
        },
        {
          id: 'BLK-005',
          timestamp: '2026-02-08T10:25:15Z',
          event: 'ANONYMIZATION_APPLIED',
          user: 'admin@system',
          hash: 'e7a6b5c4d3f2',
          prevHash: 'd6f5a4b3c2e1',
          data: { kValue: 5, lValue: 3 }
        },
        {
          id: 'BLK-006',
          timestamp: '2026-02-08T10:30:00Z',
          event: 'DATASET_RELEASED',
          user: 'admin@system',
          hash: 'f8b7c6d5e4a3',
          prevHash: 'e7a6b5c4d3f2',
          data: { releaseId: 'REL-2026-001' }
        }
      ]
    };

    // Create and download the file
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate Report function - navigates to Reports screen
  const handleGenerateReport = () => {
    navigateTo(MODULES.REPORTS);
  };

  return (
    <motion.nav
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="w-64 bg-bg-panel border-r border-border-panel flex flex-col"
    >
      {/* Section Label */}
      <div className="px-4 py-3 border-b border-border-panel">
        <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
          System Navigation
        </span>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {modules.map((module, index) => {
          const config = MODULE_CONFIG[module];
          const Icon = iconMap[config.icon];
          const isActive = activeModule === module;
          const accessible = isAccessible(module);

          return (
            <motion.button
              key={module}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => accessible && navigateTo(module)}
              disabled={!accessible}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                border-l-2 transition-all duration-200
                ${isActive
                  ? 'text-accent-primary border-accent-primary bg-accent-primary/5'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
                }
                ${!accessible ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-accent-primary' : ''}`} />
              <span className="flex-1 text-left">{config.label}</span>
              {!accessible && (
                <Lock className="w-3 h-3 text-gray-600" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Section - Quick Actions */}
      <div className="border-t border-border-panel p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">
          Quick Actions
        </div>
        <div className="space-y-2">
          <button
            onClick={handleExportAudit}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-border-panel flex items-center gap-2"
          >
            <Download className="w-3 h-3" />
            Export Audit Log
          </button>
          <button
            onClick={handleGenerateReport}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-border-panel flex items-center gap-2"
          >
            <FileText className="w-3 h-3" />
            Generate Report
          </button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navigation;