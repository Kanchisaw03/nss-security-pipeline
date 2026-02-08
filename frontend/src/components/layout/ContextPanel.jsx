import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Users,
  Database,
  Lock,
  Eye
} from 'lucide-react';
import { useSystem } from '../../contexts/SystemContext';
import { useNavigation } from '../../contexts/NavigationContext';

const ContextPanel = () => {
  const { 
    riskSummary, 
    activeConsents, 
    dpBudget, 
    attackStatus,
    systemStatus,
    isLoading 
  } = useSystem();
  const { contextPanelOpen } = useNavigation();

  if (!contextPanelOpen) return null;

  const getRiskLevel = (score) => {
    if (score <= 30) return { label: 'LOW', color: 'text-privacy-safe', bg: 'bg-privacy-safe/10', border: 'border-privacy-safe/30' };
    if (score <= 60) return { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
    return { label: 'HIGH', color: 'text-risk-warning', bg: 'bg-risk-warning/10', border: 'border-risk-warning/30' };
  };

  const riskInfo = getRiskLevel(riskSummary?.overallScore || 0);

  return (
    <motion.aside
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="w-72 bg-bg-panel border-l border-border-panel flex flex-col overflow-y-auto"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-border-panel">
        <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
          Live Metrics
        </span>
      </div>

      {/* System Privacy Score */}
      <div className="p-4 border-b border-border-panel">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent-primary" />
          <span className="text-xs font-medium text-gray-400">Privacy Posture</span>
        </div>
        
        {isLoading('risk') ? (
          <div className="h-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-mono font-bold ${riskInfo.color}`}>
                {riskSummary?.overallScore || 0}
              </span>
              <span className="text-sm text-gray-500 mb-1">/100</span>
            </div>
            
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 border ${riskInfo.bg} ${riskInfo.border} ${riskInfo.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${riskInfo.color.replace('text-', 'bg-')}`} />
              <span className="text-xs font-mono">{riskInfo.label} RISK</span>
            </div>

            {riskSummary?.trend && (
              <div className="flex items-center gap-1 text-xs">
                <Activity className="w-3 h-3" />
                <span className={
                  riskSummary.trend === 'improving' ? 'text-privacy-safe' :
                  riskSummary.trend === 'degrading' ? 'text-risk-warning' : 'text-gray-500'
                }>
                  {riskSummary.trend.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attack Threat Level */}
      <div className="p-4 border-b border-border-panel">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-risk-warning" />
          <span className="text-xs font-medium text-gray-400">Attack Surface</span>
        </div>
        
        {isLoading('attack') ? (
          <div className="h-12 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-risk-warning/30 border-t-risk-warning rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Linkage Risk</span>
              <span className="font-mono text-risk-warning">{attackStatus?.linkageRisk || 0}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Homogeneity</span>
              <span className="font-mono text-yellow-400">{attackStatus?.homogeneityRisk || 0}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Background Knowledge</span>
              <span className="font-mono text-cyber-purple-400">{attackStatus?.backgroundKnowledgeRisk || 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Active Consents */}
      <div className="p-4 border-b border-border-panel">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-privacy-safe" />
            <span className="text-xs font-medium text-gray-400">Active Consents</span>
          </div>
          <span className="text-xs font-mono text-privacy-safe">
            {activeConsents?.length || 0}
          </span>
        </div>
        
        {isLoading('consents') ? (
          <div className="h-12 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-privacy-safe/30 border-t-privacy-safe rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {(activeConsents || []).slice(0, 3).map((consent, idx) => (
              <div key={idx} className="text-xs p-2 bg-bg-primary border border-border-panel">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-300">{consent.purpose || 'Research'}</span>
                  <span className="font-mono text-accent-primary">ε{consent.epsilon || 1.0}</span>
                </div>
                <div className="text-gray-500 text-2xs">
                  {consent.fields?.length || 0} fields • {consent.researcherId || 'Unknown'}
                </div>
              </div>
            ))}
            {(activeConsents || []).length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">No active consents</div>
            )}
          </div>
        )}
      </div>

      {/* DP Budget */}
      <div className="p-4 border-b border-border-panel">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-accent-primary" />
          <span className="text-xs font-medium text-gray-400">DP Budget</span>
        </div>
        
        {isLoading('dpBudget') ? (
          <div className="h-16 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Consumed</span>
                <span className="font-mono text-accent-primary">
                  {dpBudget?.consumed || 0} / {dpBudget?.total || 10} ε
                </span>
              </div>
              <div className="h-1.5 bg-bg-primary border border-border-panel">
                <div 
                  className="h-full bg-accent-primary transition-all duration-500"
                  style={{ width: `${((dpBudget?.consumed || 0) / (dpBudget?.total || 10)) * 100}%` }}
                />
              </div>
            </div>
            
            <div className="flex justify-between text-2xs">
              <span className="text-gray-500">Remaining</span>
              <span className="font-mono text-privacy-safe">
                {((dpBudget?.total || 10) - (dpBudget?.consumed || 0)).toFixed(2)} ε
              </span>
            </div>
          </div>
        )}
      </div>

      {/* System Metrics */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">System Metrics</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-bg-primary border border-border-panel">
            <div className="text-2xs text-gray-500 mb-1">Datasets</div>
            <div className="text-lg font-mono text-white">{systemStatus?.storage?.datasets || 0}</div>
          </div>
          <div className="p-2 bg-bg-primary border border-border-panel">
            <div className="text-2xs text-gray-500 mb-1">Queries</div>
            <div className="text-lg font-mono text-white">{systemStatus?.storage?.queries || 0}</div>
          </div>
          <div className="p-2 bg-bg-primary border border-border-panel">
            <div className="text-2xs text-gray-500 mb-1">Releases</div>
            <div className="text-lg font-mono text-white">{systemStatus?.storage?.releases || 0}</div>
          </div>
          <div className="p-2 bg-bg-primary border border-border-panel">
            <div className="text-2xs text-gray-500 mb-1">Users</div>
            <div className="text-lg font-mono text-white">{systemStatus?.storage?.users || 0}</div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default ContextPanel;