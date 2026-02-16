import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Play,
  AlertTriangle,
  Shield,
  User,
  Database,
  Activity,
  Eye,
  Lock,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from 'recharts';
import { attackAPI, ingestionAPI, releaseAPI } from '../../services/api';

const ChartWrapper = ({ children, minHeight = '256px', fallback = null }) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true); // Set to true immediately

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

const AttackLabScreen = () => {
  const [running, setRunning] = useState(false);
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState('');
  const [attackResults, setAttackResults] = useState({});

  // Sample releases for demonstration
  const sampleReleases = [
    { id: 'REL-2026-001', datasetId: 'demo-healthcare-001', status: 'complete', createdAt: '2026-02-07T10:30:00Z' },
    { id: 'REL-2026-002', datasetId: 'demo-financial-002', status: 'complete', createdAt: '2026-02-08T09:15:00Z' },
  ];

  // Sample attack results for demonstration
  const sampleAttackResults = {
    linkage: {
      successRate: 12.5,
      recordsAtRisk: 156,
      avgConfidence: 0.73,
      details: [
        { cluster: 'Age 30-35, Mumbai', atRisk: 45, confidence: 0.82 },
        { cluster: 'Age 25-30, Delhi', atRisk: 38, confidence: 0.71 },
        { cluster: 'Age 40-50, Bangalore', atRisk: 32, confidence: 0.68 },
        { cluster: 'Age 55+, Chennai', atRisk: 28, confidence: 0.65 },
      ]
    },
    homogeneity: {
      successRate: 8.2,
      vulnerableGroups: 23,
      avgGroupSize: 4.2,
      details: [
        { sensitiveValue: 'Diabetes', groups: 8, exposure: 0.91 },
        { sensitiveValue: 'Hypertension', groups: 7, exposure: 0.87 },
        { sensitiveValue: 'Heart Disease', groups: 5, exposure: 0.79 },
        { sensitiveValue: 'Asthma', groups: 3, exposure: 0.72 },
      ]
    },
    background: {
      successRate: 5.8,
      externalMatches: 89,
      avgMatchConfidence: 0.68,
      details: [
        { source: 'Social Media Profile', matches: 34, confidence: 0.72 },
        { source: 'Public Records', matches: 28, confidence: 0.65 },
        { source: 'Employment Database', matches: 18, confidence: 0.61 },
        { source: 'Census Data', matches: 9, confidence: 0.54 },
      ]
    }
  };

  const attackTypes = [
    {
      id: 'linkage',
      name: 'Linkage Attack',
      icon: User,
      description: 'Record re-identification via quasi-identifiers',
      color: 'text-risk-warning',
      bg: 'bg-risk-warning/10',
      border: 'border-risk-warning/30',
    },
    {
      id: 'homogeneity',
      name: 'Homogeneity Attack',
      icon: Database,
      description: 'Sensitive value inference from uniform groups',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/30',
    },
    {
      id: 'background',
      name: 'Background Knowledge',
      icon: Eye,
      description: 'External data exploitation for re-identification',
      color: 'text-cyber-purple-400',
      bg: 'bg-cyber-purple-500/10',
      border: 'border-cyber-purple-500/30',
    },
  ];

  useEffect(() => {
    fetchDatasetsAndReleases();
  }, []);

  const fetchDatasetsAndReleases = async () => {
    // Always use sample releases to keep demo data separate from ingested data
    setReleases(sampleReleases);
    setSelectedRelease(sampleReleases[0].id);
  };

  const handleRunSimulation = async () => {
    if (!selectedRelease) {
      alert('Please select a release to attack');
      return;
    }

    setRunning(true);
    setSimulationComplete(false);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const response = await attackAPI.runSimulation(selectedRelease, {
        attackTypes: ['linkage', 'homogeneity', 'background']
      });

      if (response.data) {
        // Transform API response to display format
        setAttackResults({
          linkage: {
            successRate: response.data.linkageSuccess || sampleAttackResults.linkage.successRate,
            recordsAtRisk: response.data.recordsAtRisk || sampleAttackResults.linkage.recordsAtRisk,
            avgConfidence: response.data.avgConfidence || sampleAttackResults.linkage.avgConfidence,
            details: response.data.linkageDetails || sampleAttackResults.linkage.details
          },
          homogeneity: {
            successRate: response.data.homogeneitySuccess || sampleAttackResults.homogeneity.successRate,
            vulnerableGroups: response.data.vulnerableGroups || sampleAttackResults.homogeneity.vulnerableGroups,
            avgGroupSize: response.data.avgGroupSize || sampleAttackResults.homogeneity.avgGroupSize,
            details: response.data.homogeneityDetails || sampleAttackResults.homogeneity.details
          },
          background: {
            successRate: response.data.backgroundSuccess || sampleAttackResults.background.successRate,
            externalMatches: response.data.externalMatches || sampleAttackResults.background.externalMatches,
            avgMatchConfidence: response.data.avgMatchConfidence || sampleAttackResults.background.avgMatchConfidence,
            details: response.data.backgroundDetails || sampleAttackResults.background.details
          }
        });
      } else {
        setAttackResults(sampleAttackResults);
      }
      setSimulationComplete(true);
      setSelectedAttack('linkage');
    } catch (error) {
      console.error('Failed to run simulation:', error);
      // Use sample attack results on error
      setAttackResults(sampleAttackResults);
      setSimulationComplete(true);
      setSelectedAttack('linkage');
    } finally {
      setRunning(false);
    }
  };

  // Heatmap data for attack success
  const heatmapData = [
    { x: 'Low', y: 'Low', z: 5 },
    { x: 'Low', y: 'Medium', z: 12 },
    { x: 'Low', y: 'High', z: 28 },
    { x: 'Medium', y: 'Low', z: 8 },
    { x: 'Medium', y: 'Medium', z: 18 },
    { x: 'Medium', y: 'High', z: 35 },
    { x: 'High', y: 'Low', z: 15 },
    { x: 'High', y: 'Medium', z: 25 },
    { x: 'High', y: 'High', z: 42 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Attack Lab</h1>
          <p className="text-sm text-gray-500">
            Re-identification attack simulation and vulnerability assessment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRelease}
            onChange={(e) => setSelectedRelease(e.target.value)}
            className="bg-bg-primary border border-border-panel px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-primary"
          >
            <option value="">Select Release</option>
            {releases.map(rel => (
              <option key={rel.id} value={rel.id}>{rel.id}</option>
            ))}
          </select>
          <button
            onClick={handleRunSimulation}
            disabled={running || !selectedRelease}
            className="btn-primary flex items-center gap-2"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Attack Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attack Type Cards */}
      <div className="grid grid-cols-3 gap-4">
        {attackTypes.map((attack, idx) => {
          const Icon = attack.icon;
          const result = attackResults[attack.id];

          return (
            <motion.div
              key={attack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => simulationComplete && setSelectedAttack(attack.id)}
              className={`
                p-6 border cursor-pointer transition-all duration-200
                ${attack.bg} ${attack.border}
                ${selectedAttack === attack.id ? 'ring-1 ring-white' : ''}
                ${!simulationComplete ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <Icon className={`w-8 h-8 ${attack.color}`} />
                {simulationComplete && result && (
                  <div className={`text-2xl font-mono font-bold ${attack.color}`}>
                    {result.successRate}%
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">{attack.name}</h3>
              <p className="text-xs text-gray-400 mb-4">{attack.description}</p>

              {simulationComplete && result && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Success Rate</span>
                    <span className={`font-mono ${attack.color}`}>{result.successRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-mono text-gray-300">
                      {((result.avgConfidence || result.avgMatchConfidence) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Main Analysis Area */}
      {simulationComplete && selectedAttack && attackResults[selectedAttack] && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-6"
        >
          {/* Attack Details */}
          <div className="bg-bg-panel border border-border-panel p-6">
            <div className="flex items-center gap-3 mb-4">
              {(() => {
                const attack = attackTypes.find(a => a.id === selectedAttack);
                const Icon = attack.icon;
                return (
                  <>
                    <Icon className={`w-6 h-6 ${attack.color}`} />
                    <h3 className="text-lg font-semibold text-white">{attack.name} Results</h3>
                  </>
                );
              })()}
            </div>

            <div className="space-y-4">
              {selectedAttack === 'linkage' && attackResults.linkage?.details?.map((cluster, idx) => (
                <div key={idx} className="p-3 bg-bg-primary border border-border-panel">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-white">{cluster.cluster}</span>
                    <span className="text-xs font-mono text-risk-warning">{cluster.atRisk} at risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-panel">
                      <div
                        className="h-full bg-risk-warning"
                        style={{ width: `${cluster.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {(cluster.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                </div>
              ))}

              {selectedAttack === 'homogeneity' && attackResults.homogeneity?.details?.map((item, idx) => (
                <div key={idx} className="p-3 bg-bg-primary border border-border-panel">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-white">{item.sensitiveValue}</span>
                    <span className="text-xs font-mono text-yellow-400">{item.groups} groups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-panel">
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${item.exposure * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {(item.exposure * 100).toFixed(0)}% exposure
                    </span>
                  </div>
                </div>
              ))}

              {selectedAttack === 'background' && attackResults.background?.details?.map((source, idx) => (
                <div key={idx} className="p-3 bg-bg-primary border border-border-panel">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-white">{source.source}</span>
                    <span className="text-xs font-mono text-cyber-purple-400">{source.matches} matches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-panel">
                      <div
                        className="h-full bg-cyber-purple-400"
                        style={{ width: `${source.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {(source.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vulnerability Heatmap */}
          <div className="bg-bg-panel border border-border-panel p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Vulnerability Heatmap</h3>
            <ChartWrapper minHeight="256px">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                  <XAxis
                    type="category"
                    dataKey="x"
                    name="Distinctiveness"
                    stroke="#627D98"
                    tick={{ fill: '#627D98', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="y"
                    name="External Data"
                    stroke="#627D98"
                    tick={{ fill: '#627D98', fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[100, 1000]} name="Risk Score" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-bg-panel border border-border-panel p-2">
                            <p className="text-xs text-gray-400">Risk Level: {payload[0].payload.z}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter name="Risk" data={heatmapData} fill="#FF4D4D">
                    {heatmapData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`rgba(255, 77, 77, ${entry.z / 50})`}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </ChartWrapper>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
              <span>Low Risk</span>
              <div className="w-24 h-2 bg-gradient-to-r from-risk-warning/20 to-risk-warning" />
              <span>High Risk</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Defense Recommendations */}
      {simulationComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-privacy-safe" />
            <h3 className="text-lg font-semibold text-white">Defense Recommendations</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-2">IMMEDIATE</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Increase k-anonymity threshold</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Review high-risk record groups</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-2">SHORT-TERM</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Implement l-diversity checks</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Add differential privacy noise</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-2">LONG-TERM</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Deploy adversarial training</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Implement continuous monitoring</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AttackLabScreen;
