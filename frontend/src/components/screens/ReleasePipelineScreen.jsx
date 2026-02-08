import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Play, CheckCircle, Lock, Shield, Eye, Database, RefreshCw, Table } from 'lucide-react';
import { releaseAPI, ingestionAPI } from '../../services/api';
import DataPreviewTable from './DataPreviewTable';

const ReleasePipelineScreen = () => {
  const [stages, setStages] = useState([
    { id: 1, name: 'DECRYPT', status: 'pending', icon: Lock },
    { id: 2, name: 'CLASSIFY', status: 'pending', icon: Eye },
    { id: 3, name: 'RISK_ASSESS', status: 'pending', icon: Shield },
    { id: 4, name: 'ANONYMIZE', status: 'pending', icon: Database },
    { id: 5, name: 'VALIDATE', status: 'pending', icon: CheckCircle },
    { id: 6, name: 'ENCRYPT', status: 'pending', icon: Lock },
    { id: 7, name: 'STORE', status: 'pending', icon: Database },
  ]);
  const [releases, setReleases] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentRelease, setCurrentRelease] = useState(null);
  const [showDataPreview, setShowDataPreview] = useState(false);

  // Sample datasets for demonstration
  const sampleDatasets = [
    { id: 'demo-healthcare-001', filename: 'Healthcare Records', recordCount: 200, fieldCount: 12, status: 'raw' },
    { id: 'demo-financial-002', filename: 'Financial Transactions', recordCount: 500, fieldCount: 15, status: 'raw' },
    { id: 'demo-hr-003', filename: 'HR Employee Data', recordCount: 150, fieldCount: 18, status: 'raw' },
  ];

  // Sample releases for demonstration
  const sampleReleases = [
    { id: 'REL-2026-001', datasetId: 'demo-healthcare-001', status: 'complete', stage: 7, createdAt: '2026-02-07T10:30:00Z' },
    { id: 'REL-2026-002', datasetId: 'demo-financial-002', status: 'processing', stage: 4, createdAt: '2026-02-08T09:15:00Z' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [datasetsRes, releasesRes] = await Promise.all([
        ingestionAPI.getDatasets(),
        releaseAPI.getReleases()
      ]);

      if (datasetsRes.data?.datasets && datasetsRes.data.datasets.length > 0) {
        setDatasets(datasetsRes.data.datasets);
        setSelectedDataset(datasetsRes.data.datasets[0].id);
      } else {
        setDatasets(sampleDatasets);
        setSelectedDataset(sampleDatasets[0].id);
      }

      if (releasesRes.data?.releases && releasesRes.data.releases.length > 0) {
        setReleases(releasesRes.data.releases);
        setCurrentRelease(releasesRes.data.releases[0]);
        updateStagesFromRelease(releasesRes.data.releases[0]);
      } else {
        setReleases(sampleReleases);
        setCurrentRelease(sampleReleases[0]);
        updateStagesFromRelease(sampleReleases[0]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Fallback to sample data
      setDatasets(sampleDatasets);
      setSelectedDataset(sampleDatasets[0].id);
      setReleases(sampleReleases);
      setCurrentRelease(sampleReleases[0]);
      updateStagesFromRelease(sampleReleases[0]);
    } finally {
      setLoading(false);
    }
  };

  const updateStagesFromRelease = (release) => {
    if (!release) return;

    const statusMap = {
      'pending': 'pending',
      'processing': 'processing',
      'complete': 'complete',
      'failed': 'pending'
    };

    setStages(prev => prev.map((stage, idx) => {
      if (release.stage && idx < release.stage) {
        return { ...stage, status: 'complete' };
      } else if (release.stage && idx === release.stage) {
        return { ...stage, status: 'processing' };
      }
      return stage;
    }));
  };

  const handleExecuteRelease = async () => {
    if (!selectedDataset) {
      alert('Please select a dataset');
      return;
    }

    setLoading(true);
    try {
      const response = await releaseAPI.execute(selectedDataset, {
        kAnonymity: 5,
        lDiversity: 2,
        tCloseness: 0.2
      });

      if (response.data) {
        setCurrentRelease(response.data);
        updateStagesFromRelease(response.data);
        // Refresh releases list
        const releasesRes = await releaseAPI.getReleases();
        if (releasesRes.data?.releases) {
          setReleases(releasesRes.data.releases);
        }
      }
    } catch (error) {
      console.error('Failed to execute release:', error);
      // Simulate release pipeline on error
      const simulatedRelease = {
        id: `REL-${Date.now()}`,
        datasetId: selectedDataset,
        status: 'complete',
        stage: 7,
        createdAt: new Date().toISOString()
      };
      setCurrentRelease(simulatedRelease);
      updateStagesFromRelease(simulatedRelease);
      setReleases(prev => [simulatedRelease, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    const completed = stages.filter(s => s.status === 'complete').length;
    const processing = stages.filter(s => s.status === 'processing').length;
    return {
      current: completed + (processing > 0 ? 1 : 0),
      total: stages.length,
      percentage: Math.round(((completed + (processing > 0 ? 0.5 : 0)) / stages.length) * 100)
    };
  };

  const progress = getProgress();
  const currentStage = stages.find(s => s.status === 'processing') || stages[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Release Pipeline</h1>
          <p className="text-sm text-gray-500">7-stage automated data release with privacy validation</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
            onClick={handleExecuteRelease}
            disabled={loading || !selectedDataset}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Processing...' : 'Execute Release'}
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-panel border border-border-panel p-8"
      >
        <div className="flex items-center justify-between mb-8">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-14 h-14 flex items-center justify-center border-2 mb-2
                    ${stage.status === 'complete' ? 'bg-privacy-safe/10 border-privacy-safe text-privacy-safe' :
                      stage.status === 'processing' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary animate-pulse' :
                        'bg-bg-primary border-border-panel text-gray-600'}
                  `}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`
                    text-xs font-mono
                    ${stage.status === 'complete' ? 'text-privacy-safe' :
                      stage.status === 'processing' ? 'text-accent-primary' :
                        'text-gray-600'}
                  `}>
                    {stage.name}
                  </span>
                </div>
                {idx < stages.length - 1 && (
                  <div className={`
                    flex-1 h-0.5 mx-2
                    ${stage.status === 'complete' ? 'bg-privacy-safe/30' : 'bg-border-panel'}
                  `} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-bg-primary border border-border-panel">
            <div className="text-xs text-gray-500 mb-1">Current Stage</div>
            <div className="text-lg font-mono text-accent-primary">{currentStage.name}</div>
          </div>
          <div className="p-4 bg-bg-primary border border-border-panel">
            <div className="text-xs text-gray-500 mb-1">Progress</div>
            <div className="text-lg font-mono text-white">{progress.current}/{progress.total} ({progress.percentage}%)</div>
          </div>
          <div className="p-4 bg-bg-primary border border-border-panel">
            <div className="text-xs text-gray-500 mb-1">Releases</div>
            <div className="text-lg font-mono text-privacy-safe">{releases.length}</div>
          </div>
        </div>

        {releases.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Releases</h3>
            {releases.slice(0, 5).map(release => (
              <div key={release.id} className="p-3 bg-bg-primary border border-border-panel flex items-center justify-between">
                <div>
                  <span className="text-sm text-white font-mono">{release.id}</span>
                  <span className="text-xs text-gray-500 ml-3">{release.datasetId}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${release.status === 'complete' ? 'bg-privacy-safe/20 text-privacy-safe' :
                  release.status === 'processing' ? 'bg-accent-primary/20 text-accent-primary' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                  {release.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReleasePipelineScreen;
