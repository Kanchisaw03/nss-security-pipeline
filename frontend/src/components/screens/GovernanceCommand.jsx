import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  Target, 
  Users, 
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Lock
} from 'lucide-react';
import { useSystem } from '../../contexts/SystemContext';
import { useNavigation, MODULES } from '../../contexts/NavigationContext';
import PrivacyUtilityChart from '../charts/PrivacyUtilityChart';

const MetricCard = ({ title, value, subtext, trend, icon: Icon, color = 'accent-primary', delay = 0 }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-privacy-safe';
    if (trend === 'down') return 'text-risk-warning';
    return 'text-gray-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-bg-panel border border-border-panel p-4 hover:border-accent-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 bg-${color}/10 border border-${color}/30`}>
          <Icon className={`w-4 h-4 text-${color}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
          </div>
        )}
      </div>
      <div className="text-2xl font-mono font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      {subtext && <div className="text-xs text-gray-600">{subtext}</div>}
    </motion.div>
  );
};

const SecurityLayerIndicator = ({ layer, status, delay }) => {
  const statusColors = {
    active: 'bg-privacy-safe border-privacy-safe/50',
    warning: 'bg-yellow-400 border-yellow-400/50',
    error: 'bg-risk-warning border-risk-warning/50',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 py-2 border-b border-border-panel/50 last:border-0"
    >
      <div className={`w-2 h-2 ${statusColors[status] || statusColors.active}`} />
      <span className="text-sm text-gray-400 flex-1">{layer}</span>
      <span className={`text-xs font-mono ${status === 'active' ? 'text-privacy-safe' : status === 'warning' ? 'text-yellow-400' : 'text-risk-warning'}`}>
        {status.toUpperCase()}
      </span>
    </motion.div>
  );
};

const GovernanceCommand = () => {
  const { 
    riskSummary, 
    attackStatus, 
    activeConsents, 
    dpBudget,
    systemStatus,
    isLoading,
    refreshAll 
  } = useSystem();
  const { navigateTo } = useNavigation();
  const [privacyCurveData, setPrivacyCurveData] = useState([]);

  // Generate privacy-utility curve data
  useEffect(() => {
    const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0];
    const data = epsilons.map(eps => ({
      epsilon: eps,
      privacy: 100 - (Math.log(eps + 1) * 20),
      utility: 30 + (Math.log(eps + 1) * 30),
    }));
    setPrivacyCurveData(data);
  }, []);

  const getRiskLevel = (score) => {
    if (score <= 30) return { label: 'LOW', color: 'text-privacy-safe' };
    if (score <= 60) return { label: 'MEDIUM', color: 'text-yellow-400' };
    return { label: 'HIGH', color: 'text-risk-warning' };
  };

  const riskInfo = getRiskLevel(riskSummary?.overallScore || 45);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Governance Command Center</h1>
          <p className="text-sm text-gray-500">
            Real-time privacy posture monitoring and system intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigateTo(MODULES.REPORTS)}
            className="btn-secondary"
          >
            View Reports
          </button>
          <button 
            onClick={() => navigateTo(MODULES.ATTACK_LAB)}
            className="btn-primary"
          >
            Run Security Check
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Privacy Score"
          value={riskSummary?.overallScore || 45}
          subtext={riskInfo.label + ' RISK'}
          trend={riskSummary?.trend === 'improving' ? 'up' : riskSummary?.trend === 'degrading' ? 'down' : null}
          icon={Shield}
          color={riskInfo.color.replace('text-', '')}
          delay={0}
        />
        <MetricCard
          title="Active Consents"
          value={activeConsents?.length || 0}
          subtext="Purpose-bound access grants"
          icon={Users}
          color="accent-primary"
          delay={0.1}
        />
        <MetricCard
          title="Attack Risk"
          value={`${attackStatus?.overallRisk || 12}%`}
          subtext="Re-identification probability"
          trend={attackStatus?.trend === 'increasing' ? 'down' : 'up'}
          icon={Target}
          color="risk-warning"
          delay={0.2}
        />
        <MetricCard
          title="DP Budget"
          value={`${((dpBudget?.consumed || 0) / (dpBudget?.total || 10) * 100).toFixed(1)}%`}
          subtext={`${((dpBudget?.total || 10) - (dpBudget?.consumed || 0)).toFixed(2)} ε remaining`}
          icon={Database}
          color="privacy-safe"
          delay={0.3}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Privacy-Utility Curve */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-2 bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Privacy-Utility Tradeoff Curve</h3>
              <p className="text-xs text-gray-500">Epsilon (ε) vs Privacy Strength vs Data Utility</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-accent-primary/50" />
                <span className="text-gray-400">Privacy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyber-purple-500/50" />
                <span className="text-gray-400">Utility</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <PrivacyUtilityChart data={privacyCurveData} />
          </div>
        </motion.div>

        {/* Security Layers Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Defense Layers</h3>
          <div className="space-y-1">
            <SecurityLayerIndicator layer="Cryptography (AES-256-GCM)" status="active" delay={0.6} />
            <SecurityLayerIndicator layer="Anonymization (k≥5, l≥2)" status="active" delay={0.65} />
            <SecurityLayerIndicator layer="Differential Privacy" status="active" delay={0.7} />
            <SecurityLayerIndicator layer="Risk Scoring Engine" status="active" delay={0.75} />
            <SecurityLayerIndicator layer="Zero Trust Access" status="active" delay={0.8} />
            <SecurityLayerIndicator layer="Purpose-Bound Consent" status={activeConsents?.length > 0 ? 'active' : 'warning'} delay={0.85} />
            <SecurityLayerIndicator layer="Query Firewall" status="active" delay={0.9} />
            <SecurityLayerIndicator layer="Audit Chain" status="active" delay={0.95} />
            <SecurityLayerIndicator layer="Release Pipeline" status="active" delay={1.0} />
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Attack Simulation Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-risk-warning" />
            <h3 className="text-lg font-semibold text-white">Attack Surface Analysis</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Linkage Attack Risk</span>
                <span className="font-mono text-risk-warning">{attackStatus?.linkageRisk || 8}%</span>
              </div>
              <div className="h-2 bg-bg-primary border border-border-panel">
                <div 
                  className="h-full bg-risk-warning transition-all duration-500"
                  style={{ width: `${attackStatus?.linkageRisk || 8}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Homogeneity Vulnerability</span>
                <span className="font-mono text-yellow-400">{attackStatus?.homogeneityRisk || 15}%</span>
              </div>
              <div className="h-2 bg-bg-primary border border-border-panel">
                <div 
                  className="h-full bg-yellow-400 transition-all duration-500"
                  style={{ width: `${attackStatus?.homogeneityRisk || 15}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Background Knowledge Exposure</span>
                <span className="font-mono text-cyber-purple-400">{attackStatus?.backgroundKnowledgeRisk || 5}%</span>
              </div>
              <div className="h-2 bg-bg-primary border border-border-panel">
                <div 
                  className="h-full bg-cyber-purple-400 transition-all duration-500"
                  style={{ width: `${attackStatus?.backgroundKnowledgeRisk || 5}%` }}
                />
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => navigateTo(MODULES.ATTACK_LAB)}
            className="w-full mt-4 py-2 bg-risk-warning/10 border border-risk-warning/30 text-risk-warning text-sm hover:bg-risk-warning/20 transition-colors"
          >
            Run Full Attack Simulation
          </button>
        </motion.div>

        {/* Active Consents Monitor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-privacy-safe" />
            <h3 className="text-lg font-semibold text-white">Active Consent Monitor</h3>
          </div>
          
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {(activeConsents || []).slice(0, 5).map((consent, idx) => (
              <div key={idx} className="p-3 bg-bg-primary border border-border-panel">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-white font-medium">{consent.purpose || 'Research'}</span>
                  <span className="text-xs font-mono text-accent-primary">ε{consent.epsilon || 1.0}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  <span>{consent.researcherId || 'Unknown'}</span>
                  <span className="mx-1">•</span>
                  <span>{consent.fields?.length || 0} fields</span>
                </div>
              </div>
            ))}
            {(activeConsents || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active consents</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          
          <div className="space-y-3">
            <button 
              onClick={() => navigateTo(MODULES.INGESTION)}
              className="w-full flex items-center gap-3 p-3 bg-bg-primary border border-border-panel hover:border-accent-primary/50 transition-colors text-left"
            >
              <div className="p-2 bg-accent-primary/10">
                <Activity className="w-4 h-4 text-accent-primary" />
              </div>
              <div>
                <div className="text-sm text-white">Ingest Dataset</div>
                <div className="text-xs text-gray-500">Upload and encrypt new data</div>
              </div>
            </button>
            
            <button 
              onClick={() => navigateTo(MODULES.RISK)}
              className="w-full flex items-center gap-3 p-3 bg-bg-primary border border-border-panel hover:border-accent-primary/50 transition-colors text-left"
            >
              <div className="p-2 bg-risk-warning/10">
                <Target className="w-4 h-4 text-risk-warning" />
              </div>
              <div>
                <div className="text-sm text-white">Assess Risk</div>
                <div className="text-xs text-gray-500">Analyze dataset privacy</div>
              </div>
            </button>
            
            <button 
              onClick={() => navigateTo(MODULES.COMPLIANCE)}
              className="w-full flex items-center gap-3 p-3 bg-bg-primary border border-border-panel hover:border-accent-primary/50 transition-colors text-left"
            >
              <div className="p-2 bg-privacy-safe/10">
                <CheckCircle className="w-4 h-4 text-privacy-safe" />
              </div>
              <div>
                <div className="text-sm text-white">Compliance Check</div>
                <div className="text-xs text-gray-500">DPDP Act verification</div>
              </div>
            </button>
            
            <button 
              onClick={() => navigateTo(MODULES.AUDIT)}
              className="w-full flex items-center gap-3 p-3 bg-bg-primary border border-border-panel hover:border-accent-primary/50 transition-colors text-left"
            >
              <div className="p-2 bg-cyber-purple-500/10">
                <Database className="w-4 h-4 text-cyber-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white">View Audit Chain</div>
                <div className="text-xs text-gray-500">Tamper-proof history</div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GovernanceCommand;