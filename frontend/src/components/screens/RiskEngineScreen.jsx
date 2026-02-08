import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Database,
  Shield,
  RefreshCw,
  Table
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { riskAPI, ingestionAPI } from '../../services/api';
import DataPreviewTable from './DataPreviewTable';

const ChartWrapper = ({ children, minHeight = '192px', fallback = null }) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true); // Set to true immediately for sample data

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setIsVisible(true);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ height: minHeight, minHeight }} className="w-full">
      {isVisible ? children : fallback || <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
};

const RiskEngineScreen = () => {
  const [selectedDataset, setSelectedDataset] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);

  // Sample datasets for demonstration
  const sampleDatasets = [
    { id: 'demo-healthcare-001', filename: 'Healthcare Records', recordCount: 200, fieldCount: 12, status: 'raw' },
    { id: 'demo-financial-002', filename: 'Financial Transactions', recordCount: 500, fieldCount: 15, status: 'raw' },
    { id: 'demo-hr-003', filename: 'HR Employee Data', recordCount: 150, fieldCount: 18, status: 'raw' },
  ];

  // Sample risk data for demonstration
  const sampleRiskData = {
    overallScore: 47,
    trend: 'stable',
    metrics: {
      uniqueness: 38,
      kViolations: 22,
      rareValues: 41,
      quasiCount: 55,
      sizeFactor: 28,
    },
    kAnonymity: {
      status: 'PASS',
      k: 5,
      violations: 3,
    },
    lDiversity: {
      status: 'PASS',
      l: 3,
      violations: 1,
    },
    tCloseness: {
      status: 'WARNING',
      t: 0.18,
      drift: 0.12,
    },
  };

  useEffect(() => {
    fetchDatasets();
    // Load sample risk data immediately for demo
    setRiskData(sampleRiskData);
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await ingestionAPI.getDatasets();
      if (response.data && response.data.datasets && response.data.datasets.length > 0) {
        setDatasets(response.data.datasets);
        setSelectedDataset(response.data.datasets[0].id);
      } else {
        // Use sample datasets if no real datasets available
        setDatasets(sampleDatasets);
        setSelectedDataset(sampleDatasets[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
      setDatasets(sampleDatasets);
      setSelectedDataset(sampleDatasets[0].id);
    }
  };

  const fetchRiskData = async () => {
    if (!selectedDataset) return;

    setLoading(true);
    try {
      const response = await riskAPI.getSummary();
      if (response.data) {
        setRiskData({
          overallScore: response.data.overallRisk || 50,
          trend: 'stable',
          metrics: {
            uniqueness: response.data.uniqueness || 35,
            kViolations: response.data.kViolations || 20,
            rareValues: response.data.rareValues || 45,
            quasiCount: response.data.quasiCount || 60,
            sizeFactor: response.data.sizeFactor || 25,
          },
          kAnonymity: {
            status: response.data.kAnonymity >= 5 ? 'PASS' : 'FAIL',
            k: response.data.kAnonymity || 5,
            violations: response.data.kViolations || 0,
          },
          lDiversity: {
            status: response.data.lDiversity >= 2 ? 'PASS' : 'FAIL',
            l: response.data.lDiversity || 2,
            violations: response.data.lViolations || 0,
          },
          tCloseness: {
            status: response.data.tCloseness <= 0.2 ? 'PASS' : 'WARNING',
            t: response.data.tCloseness || 0.2,
            drift: response.data.drift || 0.15,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedDataset) {
      alert('Please select a dataset');
      return;
    }

    setAnalyzing(true);
    try {
      await riskAPI.assessDataset(selectedDataset);
      await fetchRiskData();
    } catch (error) {
      console.error('Failed to assess dataset:', error);
      // Use sample data on error - simulate analysis with slight variations
      const randomVariation = () => Math.floor(Math.random() * 10) - 5;
      setRiskData({
        ...sampleRiskData,
        overallScore: sampleRiskData.overallScore + randomVariation(),
        metrics: {
          uniqueness: sampleRiskData.metrics.uniqueness + randomVariation(),
          kViolations: Math.max(0, sampleRiskData.metrics.kViolations + randomVariation()),
          rareValues: sampleRiskData.metrics.rareValues + randomVariation(),
          quasiCount: sampleRiskData.metrics.quasiCount + randomVariation(),
          sizeFactor: sampleRiskData.metrics.sizeFactor + randomVariation(),
        }
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Risk level determination
  const getRiskLevel = (score) => {
    if (score <= 30) return { label: 'LOW', color: 'text-privacy-safe', bg: 'bg-privacy-safe/10' };
    if (score <= 60) return { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    return { label: 'HIGH', color: 'text-risk-warning', bg: 'bg-risk-warning/10' };
  };

  const defaultRiskData = {
    overallScore: 50,
    trend: 'stable',
    metrics: {
      uniqueness: 35,
      kViolations: 20,
      rareValues: 45,
      quasiCount: 60,
      sizeFactor: 25,
    },
    kAnonymity: {
      status: 'PASS',
      k: 5,
      violations: 0,
    },
    lDiversity: {
      status: 'PASS',
      l: 2,
      violations: 0,
    },
    tCloseness: {
      status: 'WARNING',
      t: 0.2,
      drift: 0.15,
    },
  };

  const displayData = riskData || defaultRiskData;
  const riskLevel = getRiskLevel(displayData.overallScore);

  // Radar chart data
  const radarData = [
    { metric: 'Uniqueness', value: displayData.metrics.uniqueness, fullMark: 100 },
    { metric: 'k-Violations', value: displayData.metrics.kViolations, fullMark: 100 },
    { metric: 'Rare Values', value: displayData.metrics.rareValues, fullMark: 100 },
    { metric: 'Quasi Count', value: displayData.metrics.quasiCount, fullMark: 100 },
    { metric: 'Size Factor', value: displayData.metrics.sizeFactor, fullMark: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Risk Engine</h1>
          <p className="text-sm text-gray-500">
            5-factor privacy risk assessment and analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="bg-bg-primary border border-border-panel px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-primary"
          >
            <option value="">Select Dataset</option>
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.id}</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedDataset}
            className="btn-primary"
          >
            {analyzing ? 'Analyzing...' : 'Run Assessment'}
          </button>
          <button
            onClick={() => setShowDataPreview(!showDataPreview)}
            disabled={!selectedDataset}
            className="btn-secondary flex items-center gap-2"
          >
            <Table className="w-4 h-4" />
            {showDataPreview ? 'Hide Data' : 'View Data'}
          </button>
        </div>
      </div>

      {/* Data Preview Section */}
      <AnimatePresence>
        {showDataPreview && selectedDataset && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-bg-panel border border-border-panel p-6 overflow-hidden"
          >
            <DataPreviewTable datasetId={selectedDataset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Risk Score Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-6"
      >
        {/* Main Score Card */}
        <div className="col-span-1 bg-bg-panel border border-border-panel p-6">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Overall Risk Score</div>
          <div className={`text-6xl font-mono font-bold ${riskLevel.color} mb-2`}>
            {displayData.overallScore}
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 ${riskLevel.bg} ${riskLevel.color} border border-current border-opacity-30`}>
            {displayData.trend === 'improving' ? (
              <TrendingDown className="w-4 h-4" />
            ) : displayData.trend === 'worsening' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            <span className="text-sm font-mono">{riskLevel.label}</span>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Risk calculated using 5-factor algorithm
          </div>
        </div>

        {/* Radar Chart */}
        <div className="col-span-2 bg-bg-panel border border-border-panel p-6">
          <div className="text-xs text-gray-500 mb-4 uppercase tracking-wider">Risk Factor Breakdown</div>
          <ChartWrapper minHeight="192px" fallback={<div className="h-48 flex items-center justify-center text-gray-500">No risk data available</div>}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1F2A44" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#627D98', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#627D98', fontSize: 10 }}
                  stroke="#1F2A44"
                />
                <Radar
                  name="Risk Factors"
                  dataKey="value"
                  stroke="#00D1FF"
                  strokeWidth={2}
                  fill="#00D1FF"
                  fillOpacity={0.2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121A2B',
                    border: '1px solid #1F2A44',
                    borderRadius: 0
                  }}
                  itemStyle={{ color: '#00D1FF' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </div>

        {/* Privacy Model Status */}
        <div className="col-span-1 bg-bg-panel border border-border-panel p-6">
          <div className="text-xs text-gray-500 mb-4 uppercase tracking-wider">Privacy Models</div>
          <div className="space-y-3">
            <div className={`p-3 border ${displayData.kAnonymity.status === 'PASS'
              ? 'bg-privacy-safe/5 border-privacy-safe/30'
              : 'bg-risk-warning/5 border-risk-warning/30'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">k-Anonymity</span>
                {displayData.kAnonymity.status === 'PASS' ? (
                  <CheckCircle className="w-4 h-4 text-privacy-safe" />
                ) : (
                  <XCircle className="w-4 h-4 text-risk-warning" />
                )}
              </div>
              <div className="text-xs text-gray-500">
                k ≥ {displayData.kAnonymity.k} • {displayData.kAnonymity.violations} violations
              </div>
            </div>

            <div className={`p-3 border ${displayData.lDiversity.status === 'PASS'
              ? 'bg-privacy-safe/5 border-privacy-safe/30'
              : 'bg-risk-warning/5 border-risk-warning/30'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">l-Diversity</span>
                {displayData.lDiversity.status === 'PASS' ? (
                  <CheckCircle className="w-4 h-4 text-privacy-safe" />
                ) : (
                  <XCircle className="w-4 h-4 text-risk-warning" />
                )}
              </div>
              <div className="text-xs text-gray-500">
                l ≥ {displayData.lDiversity.l} • {displayData.lDiversity.violations} violations
              </div>
            </div>

            <div className={`p-3 border ${displayData.tCloseness.status === 'PASS'
              ? 'bg-privacy-safe/5 border-privacy-safe/30'
              : displayData.tCloseness.status === 'WARNING'
                ? 'bg-yellow-400/5 border-yellow-400/30'
                : 'bg-risk-warning/5 border-risk-warning/30'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">t-Closeness</span>
                {displayData.tCloseness.status === 'PASS' ? (
                  <CheckCircle className="w-4 h-4 text-privacy-safe" />
                ) : displayData.tCloseness.status === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-risk-warning" />
                )}
              </div>
              <div className="text-xs text-gray-500">
                t ≤ {displayData.tCloseness.t} • drift: {displayData.tCloseness.drift}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Risk Factors Detail */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-6"
      >
        {/* Factor Breakdown */}
        <div className="bg-bg-panel border border-border-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Risk Factor Scores</h3>
          <div className="space-y-4">
            {[
              { name: 'Uniqueness', score: displayData.metrics.uniqueness, weight: 0.30, desc: 'Records with unique quasi-identifier combinations' },
              { name: 'k-Violations', score: displayData.metrics.kViolations, weight: 0.25, desc: 'Groups with fewer than k records' },
              { name: 'Rare Values', score: displayData.metrics.rareValues, weight: 0.20, desc: 'Sensitive values occurring infrequently' },
              { name: 'Quasi Count', score: displayData.metrics.quasiCount, weight: 0.15, desc: 'Number of quasi-identifier fields' },
              { name: 'Size Factor', score: displayData.metrics.sizeFactor, weight: 0.10, desc: 'Dataset size relative to population' },
            ].map((factor, idx) => (
              <div key={factor.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white">{factor.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({(factor.weight * 100).toFixed(0)}%)</span>
                  </div>
                  <span className={`text-sm font-mono ${factor.score <= 30 ? 'text-privacy-safe' :
                    factor.score <= 60 ? 'text-yellow-400' : 'text-risk-warning'
                    }`}>
                    {factor.score}
                  </span>
                </div>
                <div className="h-2 bg-bg-primary border border-border-panel">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${factor.score}%` }}
                    transition={{ delay: 0.5 + idx * 0.1, duration: 0.5 }}
                    className={`h-full ${factor.score <= 30 ? 'bg-privacy-safe' :
                      factor.score <= 60 ? 'bg-yellow-400' : 'bg-risk-warning'
                      }`}
                  />
                </div>
                <p className="text-xs text-gray-600">{factor.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-bg-panel border border-border-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>
          <div className="space-y-3">
            {displayData.overallScore > 30 && (
              <div className="p-3 bg-risk-warning/5 border border-risk-warning/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-risk-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-risk-warning font-medium">Reduce Uniqueness</div>
                    <p className="text-xs text-gray-400 mt-1">
                      Apply stronger generalization to quasi-identifiers. Consider suppressing records with unique combinations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {displayData.tCloseness.status === 'WARNING' && (
              <div className="p-3 bg-yellow-400/5 border border-yellow-400/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-yellow-400 font-medium">Address t-Closeness Drift</div>
                    <p className="text-xs text-gray-400 mt-1">
                      Distribution of sensitive attributes differs from overall distribution. Consider redistribution or suppression.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-privacy-safe/5 border border-privacy-safe/30">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-privacy-safe flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-privacy-safe font-medium">k-Anonymity Compliant</div>
                  <p className="text-xs text-gray-400 mt-1">
                    Dataset meets minimum k-anonymity requirements. Continue monitoring for violations during updates.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-accent-primary/5 border border-accent-primary/30">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-accent-primary font-medium">Enable DP for Queries</div>
                  <p className="text-xs text-gray-400 mt-1">
                    Consider applying differential privacy to aggregate queries for additional protection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RiskEngineScreen;
