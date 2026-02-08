import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Lock,
  CheckCircle,
  AlertTriangle,
  Database,
  Shield,
  Eye,
  RefreshCw,
  Sparkles,
  X,
  Table
} from 'lucide-react';
import { ingestionAPI } from '../../services/api';
import MockDataLoader from '../mockData/MockDataLoader';
import DataPreviewTable from './DataPreviewTable';

const IngestionScreen = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [showMockLoader, setShowMockLoader] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const response = await ingestionAPI.getDatasets();
      if (response.data && response.data.datasets) {
        setDatasets(response.data.datasets);
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const parseCSVToJSON = (csvContent) => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const record = {};

      headers.forEach((header, index) => {
        let value = values[index]?.trim() || '';

        // Try to convert to number
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && isFinite(numValue) && value !== '') {
          record[header] = numValue;
        } else {
          record[header] = value;
        }
      });

      // Add unique ID if not present
      if (!record.id) {
        record.id = `row-${i}`;
      }

      data.push(record);
    }

    return data;
  };

  const clearDatasets = async () => {
    try {
      await ingestionAPI.clearAllDatasets();
      setDatasets([]);
      setSelectedDataset(null);
    } catch (error) {
      console.error('Failed to clear datasets:', error);
    }
  };

  const handleFile = async (file) => {
    setUploading(true);
    setUploadStatus(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;

        // Parse CSV to get basic info
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const rowCount = lines.length - 1;

        const info = {
          name: file.name,
          size: (file.size / 1024).toFixed(2) + ' KB',
          rows: rowCount,
          columns: headers.length,
          fields: headers,
          encrypted: false,
        };

        setDatasetInfo(info);

        try {
          // Parse CSV to JSON array
          const dataset = parseCSVToJSON(content);

          // Upload to backend
          const response = await ingestionAPI.uploadDataset({
            dataset: dataset,
            metadata: {
              filename: file.name,
              originalFormat: 'csv',
              fileSize: file.size,
            }
          });

          setUploadStatus({
            success: true,
            message: 'Dataset ingested and encrypted successfully',
            datasetId: response.data.datasetId,
          });
        } catch (error) {
          setUploadStatus({
            success: false,
            message: error.response?.data?.error || error.message || 'Upload failed',
          });
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadStatus({
          success: false,
          message: 'Failed to read file',
        });
        setUploading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      setUploadStatus({
        success: false,
        message: error.message || 'Upload failed',
      });
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Data Ingestion</h1>
        <p className="text-sm text-gray-500">
          Secure dataset intake with automatic encryption and classification
        </p>
      </div>

      {/* Main Upload Area */}
      <div className="grid grid-cols-2 gap-6">
        {/* Upload Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Upload Dataset</h3>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed p-8 text-center transition-all duration-200
              ${dragActive
                ? 'border-accent-primary bg-accent-primary/5'
                : 'border-border-panel hover:border-gray-500'
              }
            `}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-accent-primary' : 'text-gray-600'}`} />
            <p className="text-sm text-gray-400 mb-2">
              Drag and drop your dataset here
            </p>
            <p className="text-xs text-gray-600 mb-4">or</p>
            <label className="btn-primary cursor-pointer inline-block">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              Browse Files
            </label>
            <p className="text-xs text-gray-600 mt-4">
              Supported formats: CSV, JSON
            </p>
          </div>

          {/* Encryption Status */}
          {uploading && (
            <div className="mt-4 p-4 bg-bg-primary border border-border-panel">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                <span className="text-sm text-gray-300">Encrypting dataset...</span>
              </div>
              <div className="mt-2 h-1 bg-bg-panel">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2 }}
                  className="h-full bg-accent-primary"
                />
              </div>
            </div>
          )}

          {uploadStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-4 border ${uploadStatus.success
                ? 'bg-privacy-safe/5 border-privacy-safe/30'
                : 'bg-risk-warning/5 border-risk-warning/30'
                }`}
            >
              <div className="flex items-start gap-3">
                {uploadStatus.success ? (
                  <CheckCircle className="w-5 h-5 text-privacy-safe flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-risk-warning flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm ${uploadStatus.success ? 'text-privacy-safe' : 'text-risk-warning'}`}>
                    {uploadStatus.message}
                  </p>
                  {uploadStatus.datasetId && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      Dataset ID: {uploadStatus.datasetId}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Dataset Preview / Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Dataset Information</h3>

          {datasetInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-bg-primary border border-border-panel">
                  <div className="text-xs text-gray-500 mb-1">File Name</div>
                  <div className="text-sm text-white font-mono truncate">{datasetInfo.name}</div>
                </div>
                <div className="p-3 bg-bg-primary border border-border-panel">
                  <div className="text-xs text-gray-500 mb-1">Size</div>
                  <div className="text-sm text-white font-mono">{datasetInfo.size}</div>
                </div>
                <div className="p-3 bg-bg-primary border border-border-panel">
                  <div className="text-xs text-gray-500 mb-1">Records</div>
                  <div className="text-sm text-white font-mono">{datasetInfo.rows.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-bg-primary border border-border-panel">
                  <div className="text-xs text-gray-500 mb-1">Fields</div>
                  <div className="text-sm text-white font-mono">{datasetInfo.columns}</div>
                </div>
              </div>

              {/* Encryption Status */}
              <div className="p-3 bg-bg-primary border border-border-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-privacy-safe" />
                    <span className="text-sm text-gray-300">Encryption Status</span>
                  </div>
                  <span className="text-xs font-mono text-privacy-safe">AES-256-GCM</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  DEK: ****-****-****-**** (Encrypted with KEK)
                </div>
              </div>

              {/* Field Preview */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Detected Fields</div>
                <div className="flex flex-wrap gap-2">
                  {datasetInfo.fields.slice(0, 8).map((field, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs bg-bg-primary border border-border-panel text-gray-400"
                    >
                      {field}
                    </span>
                  ))}
                  {datasetInfo.fields.length > 8 && (
                    <span className="px-2 py-1 text-xs text-gray-500">
                      +{datasetInfo.fields.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Upload a dataset to see details</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Pipeline Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-bg-panel border border-border-panel p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Ingestion Pipeline Status</h3>

        <div className="flex items-center justify-between">
          {[
            { label: 'Upload', icon: Upload, status: datasetInfo ? 'complete' : 'pending' },
            { label: 'Validate', icon: FileText, status: datasetInfo ? 'complete' : 'pending' },
            { label: 'Encrypt', icon: Lock, status: uploadStatus?.success ? 'complete' : datasetInfo ? 'processing' : 'pending' },
            { label: 'Classify', icon: Eye, status: uploadStatus?.success ? 'complete' : 'pending' },
            { label: 'Store', icon: Database, status: uploadStatus?.success ? 'complete' : 'pending' },
          ].map((step, idx, arr) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 flex items-center justify-center border-2
                  ${step.status === 'complete' ? 'bg-privacy-safe/10 border-privacy-safe text-privacy-safe' :
                    step.status === 'processing' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' :
                      'bg-bg-primary border-border-panel text-gray-600'
                  }
                `}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className={`
                  text-xs mt-2 font-mono
                  ${step.status === 'complete' ? 'text-privacy-safe' :
                    step.status === 'processing' ? 'text-accent-primary' :
                      'text-gray-600'
                  }
                `}>
                  {step.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-4
                  ${step.status === 'complete' ? 'bg-privacy-safe/30' : 'bg-border-panel'}
                `} />
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.div>

      {/* Mock Data Quick Load */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-bg-panel border border-border-panel p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Quick Start with Mock Data</h3>
              <p className="text-sm text-gray-500">Load sample datasets to demonstrate the full pipeline</p>
            </div>
          </div>
          <button
            onClick={() => setShowMockLoader(!showMockLoader)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/20 transition-colors"
          >
            {showMockLoader ? (
              <>
                <X className="w-4 h-4" />
                Close
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Load Mock Datasets
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showMockLoader && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <MockDataLoader
                onDatasetsLoaded={(loadedDatasets) => {
                  fetchDatasets();
                  setShowMockLoader(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!showMockLoader && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[
              { name: 'Healthcare Patient Records', records: 150, icon: 'Heart', color: 'red', desc: 'PII, medical diagnoses, insurance claims' },
              { name: 'Financial Transactions', records: 200, icon: 'CreditCard', color: 'green', desc: 'Transaction amounts, merchants, patterns' },
              { name: 'Employee HR Data', records: 120, icon: 'Users', color: 'blue', desc: 'Salaries, performance, demographics' },
            ].map((dataset) => (
              <div key={dataset.name} className="p-4 bg-bg-primary border border-border-panel">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary">
                    {dataset.records} records
                  </span>
                </div>
                <p className="text-sm font-medium text-white mb-1">{dataset.name}</p>
                <p className="text-xs text-gray-500">{dataset.desc}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Ingested Datasets List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-bg-panel border border-border-panel p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Ingested Datasets</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={clearDatasets}
              disabled={datasets.length === 0}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-risk-warning/50 text-risk-warning hover:bg-risk-warning/10 transition-colors disabled:opacity-50"
            >
              Clear All
            </button>
            <button
              onClick={fetchDatasets}
              disabled={loadingDatasets}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-border-panel hover:bg-bg-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDatasets ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loadingDatasets ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No datasets ingested yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                onClick={() => setSelectedDataset(selectedDataset?.id === dataset.id ? null : dataset)}
                className={`p-4 border cursor-pointer transition-all ${selectedDataset?.id === dataset.id
                  ? 'border-accent-primary bg-accent-primary/5'
                  : 'border-border-panel hover:border-gray-500 bg-bg-primary'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-accent-primary" />
                    <div>
                      <p className="text-sm font-medium text-white">{dataset.id}</p>
                      <p className="text-xs text-gray-500">
                        {dataset.recordCount || dataset.metadata?.recordCount || 0} records • {dataset.fieldCount || dataset.metadata?.fieldCount || 0} fields
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(dataset.storedAt || dataset.ingestedAt || dataset.metadata?.storedAt || dataset.metadata?.ingestedAt).toLocaleDateString()}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded ${dataset.status === 'released' ? 'bg-privacy-safe/20 text-privacy-safe' :
                      dataset.status === 'anonymized' ? 'bg-accent-primary/20 text-accent-primary' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                      {dataset.status || 'raw'}
                    </span>
                  </div>
                </div>

                {selectedDataset?.id === dataset.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-border-panel"
                  >
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Filename:</span>
                        <span className="ml-2 text-white">{dataset.filename || dataset.metadata?.filename || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Original Format:</span>
                        <span className="ml-2 text-white">{dataset.originalFormat || dataset.metadata?.originalFormat || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Encrypted:</span>
                        <span className="ml-2 text-white">{(dataset.encrypted !== undefined ? dataset.encrypted : dataset.metadata?.encrypted) ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Classification:</span>
                        <span className="ml-2 text-white">{dataset.classificationStatus || 'pending'}</span>
                      </div>
                    </div>
                    {(dataset.fields || dataset.metadata?.fields) && (
                      <div className="mt-3">
                        <span className="text-xs text-gray-500">Fields:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(dataset.fields || dataset.metadata.fields).slice(0, 10).map((field, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-bg-panel border border-border-panel text-gray-400">
                              {field}
                            </span>
                          ))}
                          {(dataset.fields || dataset.metadata.fields).length > 10 && (
                            <span className="text-xs text-gray-500">+{(dataset.fields || dataset.metadata.fields).length - 10} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Data Preview Toggle */}
                    <div className="mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDataPreview(showDataPreview === dataset.id ? null : dataset.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-primary/10 border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/20 transition-colors"
                      >
                        <Table className="w-4 h-4" />
                        {showDataPreview === dataset.id ? 'Hide Data' : 'View Data'}
                      </button>
                    </div>

                    {/* Data Preview Table */}
                    <AnimatePresence>
                      {showDataPreview === dataset.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <DataPreviewTable datasetId={dataset.id} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default IngestionScreen;