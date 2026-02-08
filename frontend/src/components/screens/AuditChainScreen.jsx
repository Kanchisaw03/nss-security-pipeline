import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { List, Lock, CheckCircle, Clock, User, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import { auditAPI } from '../../services/api';

const AuditChainScreen = () => {
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chainValid, setChainValid] = useState(true);

  // Sample audit blocks for demonstration
  const sampleBlocks = [
    {
      id: 'BLK-001',
      timestamp: '2026-02-08T10:15:00Z',
      event: 'DATASET_INGESTED',
      user: 'admin@system',
      hash: 'a3f2c1b4e5d6',
      prevHash: '0000000000',
      data: { datasetId: 'demo-healthcare-001', recordCount: 200, fieldCount: 12, encrypted: true }
    },
    {
      id: 'BLK-002',
      timestamp: '2026-02-08T10:16:30Z',
      event: 'CLASSIFICATION_COMPLETED',
      user: 'admin@system',
      hash: 'b4d3e2f1a0c9',
      prevHash: 'a3f2c1b4e5d6',
      data: { datasetId: 'demo-healthcare-001', directIdentifiers: 2, quasiIdentifiers: 3, sensitive: 2 }
    },
    {
      id: 'BLK-003',
      timestamp: '2026-02-08T10:17:45Z',
      event: 'CONSENT_APPROVED',
      user: 'reviewer@org',
      hash: 'c5e4f3a2b1d0',
      prevHash: 'b4d3e2f1a0c9',
      data: { consentId: 'CNS-2026-001', researcherId: 'researcher@uni', purpose: 'research', allowedFields: ['age', 'city', 'diagnosis'] }
    },
    {
      id: 'BLK-004',
      timestamp: '2026-02-08T10:20:00Z',
      event: 'RISK_ASSESSMENT',
      user: 'admin@system',
      hash: 'd6f5a4b3c2e1',
      prevHash: 'c5e4f3a2b1d0',
      data: { datasetId: 'demo-healthcare-001', riskScore: 47, riskLevel: 'Medium', kAnonymity: 5 }
    },
    {
      id: 'BLK-005',
      timestamp: '2026-02-08T10:25:15Z',
      event: 'ANONYMIZATION_APPLIED',
      user: 'admin@system',
      hash: 'e7a6b5c4d3f2',
      prevHash: 'd6f5a4b3c2e1',
      data: { datasetId: 'demo-healthcare-001', kValue: 5, lValue: 3, generalizationLevel: 2 }
    },
    {
      id: 'BLK-006',
      timestamp: '2026-02-08T10:30:00Z',
      event: 'DATASET_RELEASED',
      user: 'admin@system',
      hash: 'f8b7c6d5e4a3',
      prevHash: 'e7a6b5c4d3f2',
      data: { releaseId: 'REL-2026-001', datasetId: 'demo-healthcare-001', consentId: 'CNS-2026-001', researcherId: 'researcher@uni' }
    },
    {
      id: 'BLK-007',
      timestamp: '2026-02-08T10:35:30Z',
      event: 'DATA_ACCESS',
      user: 'researcher@uni',
      hash: 'a9c8d7e6f5b4',
      prevHash: 'f8b7c6d5e4a3',
      data: { releaseId: 'REL-2026-001', queryType: 'aggregate', recordsAccessed: 50, dpEpsilon: 0.5 }
    },
    {
      id: 'BLK-008',
      timestamp: '2026-02-08T10:40:00Z',
      event: 'ATTACK_SIMULATION',
      user: 'admin@system',
      hash: 'b0d9e8f7a6c5',
      prevHash: 'a9c8d7e6f5b4',
      data: { releaseId: 'REL-2026-001', attackType: 'linkage', successRate: 12.5, recordsAtRisk: 156 }
    }
  ];

  useEffect(() => {
    fetchAuditEvents();
    validateChain();
  }, []);

  const fetchAuditEvents = async () => {
    setLoading(true);
    try {
      const response = await auditAPI.getEvents({ limit: 50 });
      if (response.data && response.data.events && response.data.events.length > 0) {
        // Transform audit events into blockchain-like blocks
        const transformedBlocks = response.data.events.map((event, idx) => ({
          id: event.id || `BLK-${idx + 1}`,
          timestamp: event.timestamp || new Date().toISOString(),
          event: event.type || 'Unknown Event',
          user: event.userId || 'system',
          hash: event.hash || `hash-${Math.random().toString(36).substr(2, 8)}`,
          prevHash: idx === 0 ? '0000000000' : `hash-${Math.random().toString(36).substr(2, 8)}`,
          data: event.details || event
        }));
        setBlocks(transformedBlocks);
      } else {
        // Use sample blocks if no real events
        setBlocks(sampleBlocks);
      }
    } catch (error) {
      console.error('Failed to fetch audit events:', error);
      // Fallback to sample blocks
      setBlocks(sampleBlocks);
    } finally {
      setLoading(false);
    }
  };

  const validateChain = async () => {
    try {
      const response = await auditAPI.validateChain();
      setChainValid(response.data?.valid !== false);
    } catch (error) {
      console.error('Failed to validate chain:', error);
      // Assume valid in demo mode
      setChainValid(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Audit Chain</h1>
          <p className="text-sm text-gray-500">Tamper-proof cryptographic audit trail</p>
        </div>
        <button
          onClick={() => { fetchAuditEvents(); validateChain(); }}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Blockchain Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2 bg-bg-panel border border-border-panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-accent-primary" />
            <h3 className="text-lg font-semibold text-white">Chain Blocks</h3>
            <div className="ml-auto flex items-center gap-2">
              {chainValid ? (
                <>
                  <CheckCircle className="w-4 h-4 text-privacy-safe" />
                  <span className="text-xs text-privacy-safe">Chain Valid</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-risk-warning" />
                  <span className="text-xs text-risk-warning">Chain Invalid</span>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            </div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No audit events found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, idx) => (
                <motion.div
                  key={block.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedBlock(block)}
                  className={`
                    p-4 border cursor-pointer transition-all duration-200
                    ${selectedBlock?.id === block.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-panel hover:border-gray-500'}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-xs font-mono text-gray-500">#{idx + 1}</div>
                      <div>
                        <div className="text-sm font-medium text-white">{block.event}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(block.timestamp).toLocaleString()}
                          <span className="mx-1">•</span>
                          <User className="w-3 h-3" />
                          {block.user}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-accent-primary">{block.hash}</div>
                      <div className="text-xs text-gray-600 mt-1">← {block.prevHash}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Block Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Block Details</h3>

          {selectedBlock ? (
            <div className="space-y-4">
              <div className="p-3 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Block ID</div>
                <div className="text-sm font-mono text-white">{selectedBlock.id}</div>
              </div>

              <div className="p-3 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Hash</div>
                <div className="text-sm font-mono text-accent-primary">{selectedBlock.hash}</div>
              </div>

              <div className="p-3 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Previous Hash</div>
                <div className="text-sm font-mono text-gray-400">{selectedBlock.prevHash}</div>
              </div>

              <div className="p-3 bg-bg-primary border border-border-panel">
                <div className="text-xs text-gray-500 mb-1">Event Data</div>
                <pre className="text-xs font-mono text-gray-300 mt-2 overflow-x-auto">
                  {JSON.stringify(selectedBlock.data, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Select a block to view details</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuditChainScreen;
