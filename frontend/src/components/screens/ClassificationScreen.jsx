import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Search,
  AlertCircle,
  CheckCircle,
  Shield,
  User,
  MapPin,
  DollarSign,
  Activity,
  Hash,
  RefreshCw,
  Database,
  Table
} from 'lucide-react';
import { classificationAPI, ingestionAPI } from '../../services/api';
import DataPreviewTable from './DataPreviewTable';

// Field type definitions with icons and colors
const FIELD_TYPES = {
  DIRECT_IDENTIFIER: {
    label: 'Direct Identifier',
    color: 'text-risk-warning',
    bg: 'bg-risk-warning/10',
    border: 'border-risk-warning/30',
    icon: User,
    description: 'Uniquely identifies individuals (e.g., email, SSN)',
  },
  QUASI_IDENTIFIER: {
    label: 'Quasi Identifier',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    icon: MapPin,
    description: 'Can be combined to identify (e.g., age, ZIP)',
  },
  SENSITIVE: {
    label: 'Sensitive',
    color: 'text-cyber-purple-400',
    bg: 'bg-cyber-purple-500/10',
    border: 'border-cyber-purple-500/30',
    icon: Activity,
    description: 'Private information (e.g., health, income)',
  },
  SAFE: {
    label: 'Safe',
    color: 'text-privacy-safe',
    bg: 'bg-privacy-safe/10',
    border: 'border-privacy-safe/30',
    icon: Shield,
    description: 'Non-identifying information',
  },
};

// Sample datasets for demonstration
const sampleDatasets = [
  { id: 'demo-healthcare-001', filename: 'Healthcare Records', recordCount: 200, fieldCount: 12, status: 'raw' },
  { id: 'demo-financial-002', filename: 'Financial Transactions', recordCount: 500, fieldCount: 15, status: 'raw' },
  { id: 'demo-hr-003', filename: 'HR Employee Data', recordCount: 150, fieldCount: 18, status: 'raw' },
];

// Sample fields for demonstration
const sampleFieldsData = {
  'demo-healthcare-001': [
    { name: 'patient_id', type: 'DIRECT_IDENTIFIER', confidence: 0.98 },
    { name: 'email', type: 'DIRECT_IDENTIFIER', confidence: 0.95 },
    { name: 'age', type: 'QUASI_IDENTIFIER', confidence: 0.88 },
    { name: 'zip_code', type: 'QUASI_IDENTIFIER', confidence: 0.85 },
    { name: 'gender', type: 'QUASI_IDENTIFIER', confidence: 0.82 },
    { name: 'diagnosis', type: 'SENSITIVE', confidence: 0.92 },
    { name: 'treatment', type: 'SENSITIVE', confidence: 0.89 },
    { name: 'admission_date', type: 'SAFE', confidence: 0.78 },
    { name: 'hospital_name', type: 'SAFE', confidence: 0.85 },
    { name: 'doctor_notes', type: 'SENSITIVE', confidence: 0.91 },
    { name: 'insurance_type', type: 'SAFE', confidence: 0.75 },
    { name: 'room_number', type: 'SAFE', confidence: 0.80 },
  ],
  'demo-financial-002': [
    { name: 'account_number', type: 'DIRECT_IDENTIFIER', confidence: 0.99 },
    { name: 'ssn', type: 'DIRECT_IDENTIFIER', confidence: 0.99 },
    { name: 'transaction_amount', type: 'SENSITIVE', confidence: 0.85 },
    { name: 'merchant_category', type: 'SAFE', confidence: 0.78 },
    { name: 'transaction_date', type: 'SAFE', confidence: 0.80 },
    { name: 'city', type: 'QUASI_IDENTIFIER', confidence: 0.82 },
  ],
  'demo-hr-003': [
    { name: 'employee_id', type: 'DIRECT_IDENTIFIER', confidence: 0.97 },
    { name: 'full_name', type: 'DIRECT_IDENTIFIER', confidence: 0.96 },
    { name: 'salary', type: 'SENSITIVE', confidence: 0.94 },
    { name: 'department', type: 'QUASI_IDENTIFIER', confidence: 0.80 },
    { name: 'job_title', type: 'QUASI_IDENTIFIER', confidence: 0.78 },
    { name: 'hire_date', type: 'SAFE', confidence: 0.75 },
  ],
};

const ClassificationScreen = () => {
  const [selectedField, setSelectedField] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);

  useEffect(() => {
    // Always use sample datasets to keep demo data separate from ingested data
    setDatasets(sampleDatasets);
    if (sampleDatasets.length > 0) {
      const firstDatasetId = sampleDatasets[0].id;
      setSelectedDataset(firstDatasetId);
      setFields(sampleFieldsData[firstDatasetId] || []);
    }
  }, []);

  const handleDatasetChange = async (datasetId) => {
    setSelectedDataset(datasetId);
    // Use sample fields data for the selected dataset
    setFields(sampleFieldsData[datasetId] || []);
  };

  const handleRunClassification = async () => {
    if (!selectedDataset) {
      alert('Please select a dataset');
      return;
    }

    setClassifying(true);
    try {
      const response = await classificationAPI.classifyDataset(selectedDataset);
      if (response.data && response.data.classifications) {
        // Transform classification response to fields format
        const classifiedFields = Object.entries(response.data.classifications).map(([name, data]) => ({
          name,
          type: data.type || 'SAFE',
          confidence: data.confidence || 0.75
        }));
        setFields(classifiedFields);
      }
    } catch (error) {
      console.error('Failed to classify dataset:', error);
      alert('Failed to classify: ' + (error.response?.data?.error || error.message));
    } finally {
      setClassifying(false);
    }
  };

  const filteredFields = fields.filter(field => {
    const matchesSearch = field.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'ALL' || field.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getTypeStats = () => {
    const stats = { DIRECT_IDENTIFIER: 0, QUASI_IDENTIFIER: 0, SENSITIVE: 0, SAFE: 0 };
    fields.forEach(field => {
      stats[field.type] = (stats[field.type] || 0) + 1;
    });
    return stats;
  };

  const stats = getTypeStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Classification Visualizer</h1>
          <p className="text-sm text-gray-500">
            Automated field sensitivity detection and mapping
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
            onClick={handleRunClassification}
            disabled={classifying || !selectedDataset}
            className="btn-primary"
          >
            {classifying ? 'Classifying...' : 'Run Classification'}
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

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(FIELD_TYPES).map(([type, config], idx) => {
          const Icon = config.icon;
          const count = stats[type] || 0;
          const percentage = fields.length > 0 ? ((count / fields.length) * 100).toFixed(0) : 0;

          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 border ${config.bg} ${config.border}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${config.color}`} />
                <span className={`text-2xl font-mono font-bold ${config.color}`}>{count}</span>
              </div>
              <div className="text-xs text-gray-400">{config.label}</div>
              <div className="text-xs text-gray-600 mt-1">{percentage}% of fields</div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Field Graph */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-2 bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Field Classification Graph</h3>
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-bg-primary border border-border-panel pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary w-48"
                />
              </div>

              {/* Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-bg-primary border border-border-panel px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-primary"
              >
                <option value="ALL">All Types</option>
                {Object.entries(FIELD_TYPES).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {fields.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-500">
              <Database className="w-12 h-12 mb-3 opacity-30" />
              <p>No fields available</p>
              <p className="text-xs mt-2">Select a dataset and run classification</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filteredFields.map((field, idx) => {
                const typeConfig = FIELD_TYPES[field.type] || FIELD_TYPES.SAFE;
                const Icon = typeConfig.icon;
                const isSelected = selectedField?.name === field.name;

                return (
                  <motion.button
                    key={field.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                    onClick={() => setSelectedField(field)}
                    className={`
                      p-3 border text-left transition-all duration-200
                      ${typeConfig.bg} ${typeConfig.border}
                      ${isSelected ? 'ring-1 ring-white' : ''}
                      hover:brightness-110
                    `}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${typeConfig.color}`} />
                      <span className="text-xs font-mono text-gray-400">
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-sm text-white font-medium truncate">
                      {field.name}
                    </div>
                    <div className={`text-xs ${typeConfig.color} mt-1`}>
                      {typeConfig.label}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {filteredFields.length === 0 && fields.length > 0 && (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No fields match your search criteria
            </div>
          )}
        </motion.div>

        {/* Field Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Field Details</h3>

          {selectedField ? (
            <div className="space-y-4">
              <div className="p-4 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Field Name</div>
                <div className="text-lg font-mono text-white">{selectedField.name}</div>
              </div>

              <div className="p-4 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-2">Classification</div>
                {(() => {
                  const config = FIELD_TYPES[selectedField.type] || FIELD_TYPES.SAFE;
                  const Icon = config.icon;
                  return (
                    <div className={`flex items-center gap-2 ${config.color}`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{config.label}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Confidence Score</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-bg-panel">
                    <div
                      className="h-full bg-accent-primary transition-all duration-500"
                      style={{ width: `${selectedField.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-accent-primary">
                    {(selectedField.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="p-4 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <p className="text-sm text-gray-400">
                  {(FIELD_TYPES[selectedField.type] || FIELD_TYPES.SAFE).description}
                </p>
              </div>

              <div className="p-4 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-2">Recommended Actions</div>
                <ul className="space-y-2">
                  {selectedField.type === 'DIRECT_IDENTIFIER' && (
                    <>
                      <li className="text-xs text-risk-warning flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Tokenize or remove before release
                      </li>
                      <li className="text-xs text-gray-400 flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-privacy-safe" />
                        Use HMAC-SHA256 for linkability
                      </li>
                    </>
                  )}
                  {selectedField.type === 'QUASI_IDENTIFIER' && (
                    <>
                      <li className="text-xs text-yellow-400 flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Apply generalization hierarchy
                      </li>
                      <li className="text-xs text-gray-400 flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-privacy-safe" />
                        Check k-anonymity constraints
                      </li>
                    </>
                  )}
                  {selectedField.type === 'SENSITIVE' && (
                    <>
                      <li className="text-xs text-cyber-purple-400 flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Ensure l-diversity compliance
                      </li>
                      <li className="text-xs text-gray-400 flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-privacy-safe" />
                        Apply differential privacy
                      </li>
                    </>
                  )}
                  {(selectedField.type === 'SAFE' || !selectedField.type) && (
                    <li className="text-xs text-privacy-safe flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      No privacy actions required
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600">
              <Tag className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Select a field to view details</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ClassificationScreen;
