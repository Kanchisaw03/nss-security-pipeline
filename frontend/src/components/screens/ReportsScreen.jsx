import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, TrendingDown, TrendingUp, Shield, Activity, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { reportAPI, ingestionAPI } from '../../services/api';

const ChartWrapper = ({ children, minHeight = '192px', fallback = null }) => {
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

const ReportsScreen = () => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetchDatasets();
    fetchReports();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await ingestionAPI.getDatasets();
      if (response.data && response.data.datasets) {
        setDatasets(response.data.datasets);
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
    }
  };

  // Sample reports for demonstration
  const sampleReports = [
    {
      id: 'RPT-2026-001',
      name: 'Privacy Analysis - Healthcare Dataset',
      date: '2026-02-08',
      type: 'Privacy-Utility',
      dataset: 'demo-healthcare-001',
      riskScore: 47,
      kAnonymity: 5,
      lDiversity: 3,
      recordCount: 200,
      metrics: { uniqueness: 38, kViolations: 3, rareValues: 41, quasiCount: 55 }
    },
    {
      id: 'RPT-2026-002',
      name: 'Benchmark Report - Financial Data',
      date: '2026-02-07',
      type: 'Benchmark',
      dataset: 'demo-financial-002',
      riskScore: 32,
      kAnonymity: 7,
      lDiversity: 4,
      recordCount: 500,
      metrics: { uniqueness: 25, kViolations: 1, rareValues: 28, quasiCount: 42 }
    }
  ];

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Fetch reports for each dataset
      const reportPromises = datasets.map(async (dataset) => {
        try {
          const response = await reportAPI.getBenchmark(dataset.id);
          return {
            id: `RPT-${dataset.id}`,
            name: `Benchmark Report - ${dataset.id}`,
            date: new Date().toISOString().split('T')[0],
            type: 'Benchmark',
            dataset: dataset.id,
            ...response.data
          };
        } catch (err) {
          return null;
        }
      });

      const fetchedReports = (await Promise.all(reportPromises)).filter(Boolean);
      if (fetchedReports.length > 0) {
        setReports(fetchedReports);
      } else {
        // Use sample reports if no real reports
        setReports(sampleReports);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      // Fallback to sample reports
      setReports(sampleReports);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (datasets.length === 0) {
      alert('No datasets available. Please ingest a dataset first.');
      return;
    }

    setLoading(true);
    try {
      // Generate reports for the first available dataset
      const dataset = datasets[0];
      const response = await reportAPI.getBenchmark(dataset.id);

      const newReport = {
        id: `RPT-${Date.now()}`,
        name: `Privacy Analysis - ${dataset.id}`,
        date: new Date().toISOString().split('T')[0],
        type: 'Privacy-Utility',
        dataset: dataset.id,
        ...response.data
      };

      setReports([newReport, ...reports]);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Privacy-Utility Reports</h1>
          <p className="text-sm text-gray-500">
            Comprehensive analysis and governance documentation
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Generate New Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Report List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Available Reports</h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No reports generated yet</p>
              <p className="text-xs mt-2">Click "Generate New Report" to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report, idx) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => setSelectedReport(report)}
                  className={`
                    p-3 border cursor-pointer transition-all duration-200
                    ${selectedReport?.id === report.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-panel hover:border-gray-500'}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-accent-primary">{report.id}</span>
                    <span className="text-xs text-gray-500">{report.date}</span>
                  </div>
                  <div className="text-sm text-white mb-1">{report.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{report.type}</span>
                    <span>•</span>
                    <span>{report.dataset}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Report Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 bg-bg-panel border border-border-panel p-6"
        >
          {selectedReport ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedReport.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedReport.type} • {selectedReport.dataset} • Generated {selectedReport.date}
                  </p>
                </div>
                <button className="btn-secondary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4">
                {selectedReport.riskScore !== undefined && (
                  <div className="p-4 bg-bg-primary border border-border-panel">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-risk-warning" />
                      <span className="text-xs text-gray-500">Risk Score</span>
                    </div>
                    <div className="text-2xl font-mono text-risk-warning">{selectedReport.riskScore}</div>
                  </div>
                )}
                {selectedReport.kAnonymity !== undefined && (
                  <div className="p-4 bg-bg-primary border border-border-panel">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-privacy-safe" />
                      <span className="text-xs text-gray-500">K-Anonymity</span>
                    </div>
                    <div className="text-2xl font-mono text-privacy-safe">{selectedReport.kAnonymity}</div>
                  </div>
                )}
                {selectedReport.lDiversity !== undefined && (
                  <div className="p-4 bg-bg-primary border border-border-panel">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-privacy-safe" />
                      <span className="text-xs text-gray-500">L-Diversity</span>
                    </div>
                    <div className="text-2xl font-mono text-privacy-safe">{selectedReport.lDiversity}</div>
                  </div>
                )}
                {selectedReport.recordCount !== undefined && (
                  <div className="p-4 bg-bg-primary border border-border-panel">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-accent-primary" />
                      <span className="text-xs text-gray-500">Records</span>
                    </div>
                    <div className="text-2xl font-mono text-accent-primary">{selectedReport.recordCount}</div>
                  </div>
                )}
              </div>

              {/* Report Data */}
              {selectedReport.metrics && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-4">Privacy Metrics</h4>
                  <ChartWrapper minHeight="192px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(selectedReport.metrics).map(([key, value]) => ({ metric: key, value }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                        <XAxis type="number" stroke="#627D98" tick={{ fill: '#627D98', fontSize: 11 }} />
                        <YAxis dataKey="metric" type="category" stroke="#627D98" tick={{ fill: '#627D98', fontSize: 11 }} width={100} />
                        <Tooltip contentStyle={{ backgroundColor: '#121A2B', border: '1px solid #1F2A44' }} />
                        <Bar dataKey="value" fill="#00FFAA" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartWrapper>
                </div>
              )}
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-gray-600">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select a report to view details</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ReportsScreen;
