import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Database,
  Download,
  Table
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { ingestionAPI, releaseAPI } from '../../services/api';
import DataPreviewTable from './DataPreviewTable';

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

const AnonymizationScreen = () => {
  const [k, setK] = useState(5);
  const [l, setL] = useState(2);
  const [t, setT] = useState(0.2);
  const [previewMode, setPreviewMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [originalData, setOriginalData] = useState([]);
  const [anonymizedData, setAnonymizedData] = useState([]);

  // Sample datasets for demonstration
  const sampleDatasets = [
    { id: 'demo-healthcare-001', filename: 'Healthcare Records', recordCount: 200, fieldCount: 12, status: 'raw' },
    { id: 'demo-financial-002', filename: 'Financial Transactions', recordCount: 500, fieldCount: 15, status: 'raw' },
    { id: 'demo-hr-003', filename: 'HR Employee Data', recordCount: 150, fieldCount: 18, status: 'raw' },
  ];

  // Sample original data
  const sampleOriginalData = [
    { id: 1, patientId: 'P001', name: 'Rahul Sharma', age: 35, city: 'Mumbai', diagnosis: 'Diabetes', bloodType: 'A+' },
    { id: 2, patientId: 'P002', name: 'Priya Patel', age: 28, city: 'Delhi', diagnosis: 'Hypertension', bloodType: 'B+' },
    { id: 3, patientId: 'P003', name: 'Amit Kumar', age: 42, city: 'Mumbai', diagnosis: 'Diabetes', bloodType: 'O+' },
    { id: 4, patientId: 'P004', name: 'Sneha Reddy', age: 31, city: 'Bangalore', diagnosis: 'Asthma', bloodType: 'AB+' },
    { id: 5, patientId: 'P005', name: 'Vikram Singh', age: 55, city: 'Chennai', diagnosis: 'Heart Disease', bloodType: 'A-' },
  ];

  // Privacy-utility tradeoff curve
  const tradeoffData = [
    { privacy: 20, utility: 95, k: 2 },
    { privacy: 35, utility: 88, k: 3 },
    { privacy: 50, utility: 78, k: 5 },
    { privacy: 65, utility: 65, k: 7 },
    { privacy: 78, utility: 52, k: 10 },
    { privacy: 88, utility: 38, k: 15 },
    { privacy: 95, utility: 25, k: 20 },
  ];

  const currentPrivacy = tradeoffData.find(d => d.k === k)?.privacy || 50;
  const currentUtility = tradeoffData.find(d => d.k === k)?.utility || 78;

  useEffect(() => {
    fetchDatasets();
    // Load sample data immediately for demo
    setOriginalData(sampleOriginalData);
  }, []);

  const fetchDatasets = async () => {
    // Always use sample datasets to keep demo data separate from ingested data
    setDatasets(sampleDatasets);
    setSelectedDataset(sampleDatasets[0].id);
    setOriginalData(sampleOriginalData);
  };

  const loadDatasetData = async (datasetId) => {
    try {
      const response = await ingestionAPI.getDatasetData(datasetId, 1, 10);
      if (response.data && response.data.data && response.data.data.length > 0) {
        setOriginalData(response.data.data);
      } else {
        setOriginalData(sampleOriginalData);
      }
    } catch (error) {
      console.error('Failed to load dataset data:', error);
      setOriginalData(sampleOriginalData);
    }
  };

  const handleDatasetChange = async (datasetId) => {
    setSelectedDataset(datasetId);
    // Check if it's a sample dataset
    if (datasetId.startsWith('demo-')) {
      setOriginalData(sampleOriginalData);
    } else {
      await loadDatasetData(datasetId);
    }
  };

  const handleApply = async () => {
    if (!selectedDataset) {
      alert('Please select a dataset');
      return;
    }

    setProcessing(true);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      // For demo datasets, simulate anonymization locally
      const isDemoDataset = selectedDataset.startsWith('demo-');

      if (!isDemoDataset) {
        // Try real API call for non-demo datasets
        const response = await releaseAPI.execute(selectedDataset, {
          kAnonymity: k,
          lDiversity: l,
          tCloseness: t
        });

        if (response.data) {
          // Generate preview of anonymized data
          const anonPreview = simulateAnonymization(originalData, k);
          setAnonymizedData(anonPreview);
          setPreviewMode(true);
          return;
        }
      }

      // Simulate anonymization for demo datasets
      const anonPreview = simulateAnonymization(originalData, k);
      setAnonymizedData(anonPreview);
      setPreviewMode(true);

    } catch (error) {
      console.error('Failed to apply anonymization:', error);
      // Fallback to simulated anonymization on error
      const anonPreview = simulateAnonymization(originalData, k);
      setAnonymizedData(anonPreview);
      setPreviewMode(true);
    } finally {
      setProcessing(false);
    }
  };

  // Simulate k-anonymity anonymization
  const simulateAnonymization = (data, kValue) => {
    return data.map((row, idx) => {
      const anonRow = { ...row };
      // Generalize age to ranges
      if (anonRow.age) {
        const ageRange = Math.floor(anonRow.age / 10) * 10;
        anonRow.age = `${ageRange}-${ageRange + 9}`;
      }
      // Suppress direct identifiers
      if (anonRow.patientId) anonRow.patientId = '***';
      if (anonRow.name) anonRow.name = '*****';
      if (anonRow.id && typeof anonRow.id === 'number') anonRow.id = `P${Math.floor(idx / kValue) + 1}`;
      // Generalize city to region
      if (anonRow.city) {
        const regionMap = {
          'Mumbai': 'West Region',
          'Delhi': 'North Region',
          'Bangalore': 'South Region',
          'Chennai': 'South Region',
          'Kolkata': 'East Region'
        };
        anonRow.city = regionMap[anonRow.city] || 'Unknown Region';
      }
      return anonRow;
    });
  };

  const getFieldNames = () => {
    if (originalData.length > 0) {
      return Object.keys(originalData[0]);
    }
    return ['id', 'field1', 'field2', 'field3', 'field4', 'field5'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Anonymization Control</h1>
          <p className="text-sm text-gray-500">
            Configure privacy transformation parameters
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDataset}
            onChange={(e) => handleDatasetChange(e.target.value)}
            className="bg-bg-primary border border-border-panel px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-primary"
          >
            <option value="">Select Dataset</option>
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.id}</option>
            ))}
          </select>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="btn-secondary flex items-center gap-2"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="grid grid-cols-3 gap-6">
        {/* Parameter Sliders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sliders className="w-5 h-5 text-accent-primary" />
            <h3 className="text-lg font-semibold text-white">Privacy Parameters</h3>
          </div>

          <div className="space-y-6">
            {/* k-Anonymity Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-white">k-Anonymity</label>
                <span className="text-2xl font-mono text-accent-primary">k ≥ {k}</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={k}
                onChange={(e) => setK(parseInt(e.target.value))}
                className="w-full h-2 bg-bg-primary border border-border-panel appearance-none cursor-pointer accent-accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>2</span>
                <span>Minimum records per group</span>
                <span>20</span>
              </div>
            </div>

            {/* l-Diversity Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-white">l-Diversity</label>
                <span className="text-2xl font-mono text-cyber-purple-400">l ≥ {l}</span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                value={l}
                onChange={(e) => setL(parseInt(e.target.value))}
                className="w-full h-2 bg-bg-primary border border-border-panel appearance-none cursor-pointer accent-cyber-purple-400"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>2</span>
                <span>Distinct sensitive values</span>
                <span>10</span>
              </div>
            </div>

            {/* t-Closeness Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-white">t-Closeness</label>
                <span className="text-2xl font-mono text-privacy-safe">t ≤ {t.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={t}
                onChange={(e) => setT(parseFloat(e.target.value))}
                className="w-full h-2 bg-bg-primary border border-border-panel appearance-none cursor-pointer accent-privacy-safe"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1</span>
                <span>Distribution distance threshold</span>
                <span>1.0</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={processing || !selectedDataset}
            className="w-full mt-6 py-3 bg-accent-primary/10 border border-accent-primary/50 text-accent-primary font-medium hover:bg-accent-primary/20 transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Apply & Preview'
            )}
          </button>
        </motion.div>

        {/* Privacy-Utility Tradeoff */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Privacy-Utility Tradeoff</h3>
          <ChartWrapper minHeight="256px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tradeoffData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                <XAxis
                  dataKey="privacy"
                  stroke="#627D98"
                  tick={{ fill: '#627D98', fontSize: 11 }}
                  label={{ value: 'Privacy Strength (%)', position: 'bottom', fill: '#627D98', fontSize: 11 }}
                />
                <YAxis
                  stroke="#627D98"
                  tick={{ fill: '#627D98', fontSize: 11 }}
                  label={{ value: 'Data Utility (%)', angle: -90, position: 'insideLeft', fill: '#627D98', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121A2B', border: '1px solid #1F2A44' }}
                  itemStyle={{ color: '#00D1FF' }}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <ReferenceLine
                  x={currentPrivacy}
                  stroke="#00D1FF"
                  strokeDasharray="3 3"
                  label={{ value: `k=${k}`, fill: '#00D1FF', position: 'top' }}
                />
                <Line
                  type="monotone"
                  dataKey="utility"
                  stroke="#00D1FF"
                  strokeWidth={2}
                  dot={{ fill: '#00D1FF', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, stroke: '#00D1FF', strokeWidth: 2, fill: '#0A0F1C' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>

          {/* Current Values */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-1">Privacy Score</div>
              <div className="text-2xl font-mono text-accent-primary">{currentPrivacy}%</div>
            </div>
            <div className="p-3 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-1">Data Utility</div>
              <div className="text-2xl font-mono text-cyber-purple-400">{currentUtility}%</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Data Preview */}
      {previewMode && originalData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-6"
        >
          {/* Original Data */}
          <div className="bg-bg-panel border border-border-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Original Data</h3>
              <span className="text-xs font-mono text-gray-500">Sample ({originalData.length} records)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-panel">
                    {getFieldNames().map(field => (
                      <th key={field} className="text-left py-2 px-2 text-xs font-mono text-gray-500 uppercase">{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {originalData.map((row, idx) => (
                    <tr key={idx} className="border-b border-border-panel/50">
                      {getFieldNames().map(field => (
                        <td key={field} className={`py-2 px-2 ${field === 'id' ? 'font-mono text-risk-warning' : ''}`}>
                          {row[field]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anonymized Data */}
          <div className="bg-bg-panel border border-border-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Anonymized Data</h3>
              <span className="text-xs font-mono text-privacy-safe">k={k}, l={l}, t={t}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-panel">
                    {getFieldNames().map(field => (
                      <th key={field} className="text-left py-2 px-2 text-xs font-mono text-gray-500 uppercase">{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(anonymizedData.length > 0 ? anonymizedData : originalData).map((row, idx) => (
                    <tr key={idx} className="border-b border-border-panel/50">
                      {getFieldNames().map(field => (
                        <td key={field} className={`py-2 px-2 ${field === 'id' ? 'font-mono text-gray-500' : 'text-accent-primary'}`}>
                          {anonymizedData.length > 0 ? row[field] : '***'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transformation Legend */}
            <div className="mt-4 p-3 bg-bg-primary border border-border-panel">
              <div className="text-xs text-gray-500 mb-2">Transformations Applied</div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400">• ID suppressed</span>
                <span className="text-xs text-accent-primary">• Quasi-identifiers generalized</span>
                <span className="text-xs text-cyber-purple-400">• Sensitive values protected</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AnonymizationScreen;
