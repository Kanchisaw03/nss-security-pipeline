import React, { useState } from 'react';
import { Database, Upload, CheckCircle, AlertCircle, Loader2, FileText, Heart, CreditCard, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMockDatasetMetadata, loadAllMockDatasets, uploadMockDataset } from '../../services/mockData';
import { ingestionAPI } from '../../services/api';

const datasetIcons = {
  'Healthcare': Heart,
  'Financial': CreditCard,
  'Human Resources': Users,
};

const datasetColors = {
  'Healthcare': 'text-red-400 border-red-400/30 bg-red-400/5',
  'Financial': 'text-green-400 border-green-400/30 bg-green-400/5',
  'Human Resources': 'text-blue-400 border-blue-400/30 bg-blue-400/5',
};

const MockDataLoader = ({ onDatasetsLoaded, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedDatasets, setSelectedDatasets] = useState(new Set());
  const [loadProgress, setLoadProgress] = useState(0);

  const mockDatasets = getMockDatasetMetadata();

  const toggleDataset = (category) => {
    const newSelected = new Set(selectedDatasets);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedDatasets(newSelected);
  };

  const loadSelectedDatasets = async () => {
    setLoading(true);
    setResults(null);
    setLoadProgress(0);

    const results = [];
    const categories = Array.from(selectedDatasets);

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const dataset = mockDatasets.find(d => d.category === category);
      
      try {
        // Import the full dataset data
        const { getMockDatasetByCategory } = await import('../../services/mockData');
        const fullDataset = getMockDatasetByCategory(category);
        
        const result = await uploadMockDataset(ingestionAPI, fullDataset);
        results.push({
          success: true,
          name: dataset.name,
          category: dataset.category,
          datasetId: result.data.datasetId,
          recordCount: dataset.recordCount,
          expectedRiskLevel: dataset.expectedRiskLevel,
        });
      } catch (error) {
        results.push({
          success: false,
          name: dataset.name,
          category: dataset.category,
          error: error.response?.data?.error || error.message,
        });
      }

      setLoadProgress(((i + 1) / categories.length) * 100);
    }

    setResults(results);
    setLoading(false);

    if (onDatasetsLoaded) {
      const successfulLoads = results.filter(r => r.success);
      if (successfulLoads.length > 0) {
        onDatasetsLoaded(successfulLoads);
      }
    }
  };

  const loadAllDatasets = async () => {
    setLoading(true);
    setResults(null);
    setLoadProgress(0);

    try {
      const { loadAllMockDatasets } = await import('../../services/mockData');
      const loadResults = await loadAllMockDatasets(ingestionAPI);
      
      // Enrich results with category info
      const enrichedResults = loadResults.map((result, index) => ({
        ...result,
        category: mockDatasets[index]?.category,
        expectedRiskLevel: mockDatasets[index]?.expectedRiskLevel,
      }));

      setResults(enrichedResults);
      
      if (onDatasetsLoaded) {
        const successfulLoads = enrichedResults.filter(r => r.success);
        if (successfulLoads.length > 0) {
          onDatasetsLoaded(successfulLoads);
        }
      }
    } catch (error) {
      setResults([{ success: false, error: error.message }]);
    }

    setLoading(false);
  };

  const allSelected = selectedDatasets.size === mockDatasets.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
          <Database className="w-5 h-5 text-accent-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Mock Data Loader</h2>
          <p className="text-sm text-gray-500">Load sample datasets to demonstrate the full pipeline</p>
        </div>
      </div>

      {/* Dataset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockDatasets.map((dataset) => {
          const Icon = datasetIcons[dataset.category] || FileText;
          const isSelected = selectedDatasets.has(dataset.category);
          const colorClass = datasetColors[dataset.category] || 'text-gray-400 border-gray-400/30 bg-gray-400/5';

          return (
            <motion.div
              key={dataset.category}
              onClick={() => !loading && toggleDataset(dataset.category)}
              className={`
                relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${isSelected ? colorClass : 'border-border-panel bg-bg-panel hover:border-gray-600'}
              `}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {/* Selection indicator */}
              <div className={`
                absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                ${isSelected ? 'bg-accent-primary border-accent-primary' : 'border-gray-600'}
              `}>
                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className={`
                  w-10 h-10 rounded-lg border flex items-center justify-center
                  ${isSelected ? colorClass : 'border-border-panel bg-bg-primary'}
                `}>
                  <Icon className={`w-5 h-5 ${isSelected ? '' : 'text-gray-500'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">{dataset.name}</h3>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full border
                    ${colorClass}
                  `}>
                    {dataset.category}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                {dataset.description}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{dataset.recordCount.toLocaleString()} records</span>
                <span className={`
                  px-2 py-0.5 rounded border
                  ${dataset.expectedRiskLevel === 'High' ? 'text-red-400 border-red-400/30' :
                    dataset.expectedRiskLevel === 'Medium-High' ? 'text-orange-400 border-orange-400/30' :
                    'text-yellow-400 border-yellow-400/30'}
                `}>
                  {dataset.expectedRiskLevel} Risk
                </span>
              </div>

              {/* Sample Data Preview */}
              <div className="mt-3 pt-3 border-t border-border-panel">
                <p className="text-xs text-gray-500 mb-2">Fields: {dataset.headers.length}</p>
                <div className="flex flex-wrap gap-1">
                  {dataset.headers.slice(0, 5).map((header) => (
                    <span key={header} className="text-[10px] px-1.5 py-0.5 bg-bg-primary rounded text-gray-400">
                      {header}
                    </span>
                  ))}
                  {dataset.headers.length > 5 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-bg-primary rounded text-gray-500">
                      +{dataset.headers.length - 5}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Uploading datasets...</span>
            <span className="text-accent-primary">{Math.round(loadProgress)}%</span>
          </div>
          <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent-primary"
              initial={{ width: 0 }}
              animate={{ width: `${loadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {results.map((result, index) => (
              <div
                key={index}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border
                  ${result.success 
                    ? 'bg-privacy-safe/10 border-privacy-safe/30' 
                    : 'bg-risk-warning/10 border-risk-warning/30'}
                `}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-privacy-safe flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-risk-warning flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {result.success ? result.name : `Failed: ${result.name || 'Unknown'}`}
                  </p>
                  {result.success ? (
                    <p className="text-xs text-gray-400">
                      ID: {result.datasetId} • {result.recordCount.toLocaleString()} records
                    </p>
                  ) : (
                    <p className="text-xs text-risk-warning">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (allSelected) {
              setSelectedDatasets(new Set());
            } else {
              setSelectedDatasets(new Set(mockDatasets.map(d => d.category)));
            }
          }}
          disabled={loading}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        <div className="flex-1" />

        <button
          onClick={loadSelectedDatasets}
          disabled={loading || selectedDatasets.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/50 text-accent-primary rounded-lg hover:bg-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Load Selected ({selectedDatasets.size})
        </button>

        <button
          onClick={loadAllDatasets}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-panel text-white rounded-lg hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Database className="w-4 h-4" />
          Load All
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-bg-panel border border-border-panel rounded-lg">
        <h4 className="text-sm font-medium text-white mb-2">Pipeline Demo Guide</h4>
        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
          <li>Load one or more datasets using the buttons above</li>
          <li>Go to <strong className="text-accent-primary">Classification</strong> to identify sensitive fields</li>
          <li>Visit <strong className="text-accent-primary">Anonymization</strong> to apply privacy techniques</li>
          <li>Use <strong className="text-accent-primary">Release Pipeline</strong> to export protected data</li>
          <li>Test re-identification risk in <strong className="text-accent-primary">Attack Lab</strong></li>
        </ol>
      </div>
    </div>
  );
};

export default MockDataLoader;
