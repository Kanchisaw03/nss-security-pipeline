import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Tamper-Proof Audit Chain
 * 
 * Implements a cryptographically linked audit log where each event
 * contains a hash of the previous event, creating a chain.
 * 
 * Formula: hash = SHA256(previousHash + JSON.stringify(event))
 * 
 * Features:
 * - Cryptographic integrity verification
 * - Chain validation
 * - Tamper detection
 * - Immutable history
 * - Export with verification
 */

// Audit event types
export const AUDIT_EVENTS = {
  // Authentication
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_BLOCKED: 'user_blocked',
  USER_UNBLOCKED: 'user_unblocked',
  AUTH_FAILED: 'auth_failed',
  
  // Dataset lifecycle
  DATASET_INGESTED: 'dataset_ingested',
  DATASET_CLASSIFIED: 'dataset_classified',
  DATASET_ANONYMIZED: 'dataset_anonymized',
  DATASET_RELEASED: 'dataset_released',
  DATASET_ACCESSED: 'dataset_accessed',
  
  // Consent lifecycle
  CONSENT_REQUESTED: 'consent_requested',
  CONSENT_APPROVED: 'consent_approved',
  CONSENT_REJECTED: 'consent_rejected',
  CONSENT_REVOKED: 'consent_revoked',
  CONSENT_EXPIRED: 'consent_expired',
  
  // Access control
  ACCESS_GRANTED: 'access_granted',
  ACCESS_DENIED: 'access_denied',
  
  // Query events
  QUERY_EXECUTED: 'query_executed',
  QUERY_BLOCKED: 'query_blocked',
  
  // Security events
  ATTACK_DETECTED: 'attack_detected',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  
  // Release events
  RELEASE_BOUND: 'release_bound',
  
  // System events
  ERROR_OCCURRED: 'error_occurred',
  CONFIG_CHANGED: 'config_changed'
};

// Audit chain configuration
const AUDIT_CONFIG = {
  HASH_ALGORITHM: 'sha256',
  MAX_CHAIN_LENGTH: 100000,  // Maximum events to keep in memory
  SNAPSHOT_INTERVAL: 1000,   // Create snapshot every N events
  PERSISTENCE_ENABLED: process.env.AUDIT_PERSISTENCE === 'true',
  PERSISTENCE_PATH: process.env.AUDIT_PATH || './audit-logs'
};

// In-memory audit chain storage
const auditChain = [];
let lastSnapshotIndex = -1;

/**
 * Calculate hash of an audit event
 * Formula: hash = SHA256(previousHash + JSON.stringify(event))
 * @param {Object} event - Audit event
 * @param {string} previousHash - Hash of previous event (genesis if first)
 * @returns {string} Event hash
 */
const calculateEventHash = (event, previousHash) => {
  const eventData = JSON.stringify(event, Object.keys(event).sort());
  const dataToHash = previousHash + eventData;
  
  return crypto.createHash(AUDIT_CONFIG.HASH_ALGORITHM)
    .update(dataToHash)
    .digest('hex');
};

/**
 * Create genesis hash (first event in chain)
 */
const createGenesisHash = () => {
  const genesis = {
    type: 'GENESIS',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'Safe Data Access Platform'
  };
  
  return crypto.createHash(AUDIT_CONFIG.HASH_ALGORITHM)
    .update(JSON.stringify(genesis))
    .digest('hex');
};

/**
 * Initialize audit chain
 */
const initializeChain = async () => {
  if (auditChain.length === 0) {
    // Create genesis event
    const genesisEvent = {
      id: 'genesis',
      timestamp: new Date().toISOString(),
      eventType: AUDIT_EVENTS.CONFIG_CHANGED,
      userId: 'system',
      details: { action: 'chain_initialized' },
      previousHash: '0'.repeat(64),
      eventHash: createGenesisHash()
    };
    
    auditChain.push(genesisEvent);
    
    // Try to load from persistence if enabled
    if (AUDIT_CONFIG.PERSISTENCE_ENABLED) {
      await loadChainFromDisk();
    }
  }
};

/**
 * Log an event to the audit chain
 */
const logEvent = async (eventType, userId, details = {}) => {
  await initializeChain();
  
  const previousEvent = auditChain[auditChain.length - 1];
  const previousHash = previousEvent ? previousEvent.eventHash : '0'.repeat(64);
  
  const event = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    eventType,
    userId: userId || 'system',
    details: sanitizeDetails(details),
    previousHash,
    eventHash: null  // Will be calculated
  };
  
  // Calculate event hash
  event.eventHash = calculateEventHash(event, previousHash);
  
  // Add to chain
  auditChain.push(event);
  
  // Trim chain if too long
  if (auditChain.length > AUDIT_CONFIG.MAX_CHAIN_LENGTH) {
    const eventsToRemove = auditChain.length - AUDIT_CONFIG.MAX_CHAIN_LENGTH;
    auditChain.splice(1, eventsToRemove);  // Keep genesis
  }
  
  // Persist if needed
  if (AUDIT_CONFIG.PERSISTENCE_ENABLED && 
      auditChain.length - lastSnapshotIndex >= AUDIT_CONFIG.SNAPSHOT_INTERVAL) {
    await persistChain();
  }
  
  return event;
};

/**
 * Generate unique event ID
 */
const generateEventId = () => {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Sanitize details to remove sensitive data
 */
const sanitizeDetails = (details) => {
  if (!details || typeof details !== 'object') return details;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card', 'authTag'];
  const sanitized = {};
  
  Object.entries(details).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
};

/**
 * Validate the integrity of the audit chain
 * Returns the first invalid event index, or -1 if valid
 */
const validateChain = () => {
  if (auditChain.length === 0) {
    return { valid: false, error: 'Chain is empty', firstInvalidIndex: -1 };
  }
  
  // Validate genesis
  const genesis = auditChain[0];
  if (genesis.previousHash !== '0'.repeat(64)) {
    return { 
      valid: false, 
      error: 'Genesis event has invalid previous hash',
      firstInvalidIndex: 0 
    };
  }
  
  // Validate each link in the chain
  for (let i = 1; i < auditChain.length; i++) {
    const current = auditChain[i];
    const previous = auditChain[i - 1];
    
    // Check previous hash matches
    if (current.previousHash !== previous.eventHash) {
      return {
        valid: false,
        error: `Broken chain at index ${i}: previous hash mismatch`,
        firstInvalidIndex: i,
        expectedHash: previous.eventHash,
        actualHash: current.previousHash
      };
    }
    
    // Recalculate and verify event hash
    const recalculatedHash = calculateEventHash(current, current.previousHash);
    if (recalculatedHash !== current.eventHash) {
      return {
        valid: false,
        error: `Tampered event at index ${i}: hash mismatch`,
        firstInvalidIndex: i,
        expectedHash: recalculatedHash,
        actualHash: current.eventHash
      };
    }
  }
  
  return {
    valid: true,
    chainLength: auditChain.length,
    lastEventHash: auditChain[auditChain.length - 1].eventHash
  };
};

/**
 * Get event by ID
 */
const getEventById = (eventId) => {
  return auditChain.find(e => e.id === eventId) || null;
};

/**
 * Get events by type
 */
const getEventsByType = (eventType, limit = 100) => {
  return auditChain
    .filter(e => e.eventType === eventType)
    .slice(-limit);
};

/**
 * Get events by user
 */
const getEventsByUser = (userId, options = {}) => {
  let events = auditChain.filter(e => e.userId === userId);
  
  if (options.from) {
    events = events.filter(e => new Date(e.timestamp) >= new Date(options.from));
  }
  
  if (options.to) {
    events = events.filter(e => new Date(e.timestamp) <= new Date(options.to));
  }
  
  if (options.eventType) {
    events = events.filter(e => e.eventType === options.eventType);
  }
  
  if (options.limit) {
    events = events.slice(-options.limit);
  }
  
  return events;
};

/**
 * Get events by dataset
 */
const getEventsByDataset = (datasetId, options = {}) => {
  let events = auditChain.filter(e => 
    e.details?.datasetId === datasetId ||
    e.details?.releaseId === datasetId
  );
  
  if (options.limit) {
    events = events.slice(-options.limit);
  }
  
  return events;
};

/**
 * Query events with filters
 */
const queryEvents = (filters = {}) => {
  let events = [...auditChain];
  
  if (filters.eventType) {
    events = events.filter(e => e.eventType === filters.eventType);
  }
  
  if (filters.userId) {
    events = events.filter(e => e.userId === filters.userId);
  }
  
  if (filters.from) {
    events = events.filter(e => new Date(e.timestamp) >= new Date(filters.from));
  }
  
  if (filters.to) {
    events = events.filter(e => new Date(e.timestamp) <= new Date(filters.to));
  }
  
  if (filters.datasetId) {
    events = events.filter(e => 
      e.details?.datasetId === filters.datasetId ||
      e.details?.releaseId === filters.datasetId
    );
  }
  
  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (filters.limit) {
    events = events.slice(0, filters.limit);
  }
  
  return events;
};

/**
 * Get chain statistics
 */
const getStatistics = () => {
  const validation = validateChain();
  
  const eventCounts = {};
  auditChain.forEach(e => {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
  });
  
  return {
    chainLength: auditChain.length,
    isValid: validation.valid,
    firstEvent: auditChain[0]?.timestamp,
    lastEvent: auditChain[auditChain.length - 1]?.timestamp,
    eventBreakdown: eventCounts,
    uniqueUsers: [...new Set(auditChain.map(e => e.userId))].length,
    genesisHash: auditChain[0]?.eventHash,
    lastHash: auditChain[auditChain.length - 1]?.eventHash
  };
};

/**
 * Export chain with integrity proof
 */
const exportChain = (format = 'json', options = {}) => {
  const validation = validateChain();
  
  if (!validation.valid && !options.includeInvalid) {
    throw new Error(`Cannot export invalid chain: ${validation.error}`);
  }
  
  let events = [...auditChain];
  
  if (options.fromIndex !== undefined) {
    events = events.slice(options.fromIndex);
  }
  
  if (options.toIndex !== undefined) {
    events = events.slice(0, options.toIndex + 1);
  }
  
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      chainValid: validation.valid,
      eventCount: events.length,
      firstHash: events[0]?.eventHash,
      lastHash: events[events.length - 1]?.eventHash
    },
    events
  };
  
  if (format === 'json') {
    return JSON.stringify(exportData, null, 2);
  }
  
  if (format === 'csv') {
    const headers = ['timestamp', 'eventType', 'userId', 'eventHash', 'previousHash', 'details'];
    const rows = events.map(e => [
      e.timestamp,
      e.eventType,
      e.userId,
      e.eventHash,
      e.previousHash,
      JSON.stringify(e.details)
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  
  throw new Error(`Unsupported export format: ${format}`);
};

/**
 * Persist chain to disk
 */
const persistChain = async () => {
  if (!AUDIT_CONFIG.PERSISTENCE_ENABLED) return;
  
  try {
    await fs.mkdir(AUDIT_CONFIG.PERSISTENCE_PATH, { recursive: true });
    
    const filePath = path.join(AUDIT_CONFIG.PERSISTENCE_PATH, `audit-chain-${Date.now()}.json`);
    const data = exportChain('json');
    
    await fs.writeFile(filePath, data, 'utf8');
    lastSnapshotIndex = auditChain.length - 1;
    
    // Clean up old snapshots (keep last 10)
    const files = await fs.readdir(AUDIT_CONFIG.PERSISTENCE_PATH);
    const snapshotFiles = files
      .filter(f => f.startsWith('audit-chain-'))
      .sort()
      .reverse();
    
    for (let i = 10; i < snapshotFiles.length; i++) {
      await fs.unlink(path.join(AUDIT_CONFIG.PERSISTENCE_PATH, snapshotFiles[i]));
    }
  } catch (error) {
    console.error('Failed to persist audit chain:', error);
  }
};

/**
 * Load chain from disk
 */
const loadChainFromDisk = async () => {
  try {
    const files = await fs.readdir(AUDIT_CONFIG.PERSISTENCE_PATH);
    const snapshotFiles = files
      .filter(f => f.startsWith('audit-chain-'))
      .sort()
      .reverse();
    
    if (snapshotFiles.length > 0) {
      const latestFile = path.join(AUDIT_CONFIG.PERSISTENCE_PATH, snapshotFiles[0]);
      const data = await fs.readFile(latestFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Restore chain
      auditChain.length = 0;
      auditChain.push(...parsed.events);
      
      // Validate loaded chain
      const validation = validateChain();
      if (!validation.valid) {
        console.error('Loaded chain is invalid:', validation.error);
      }
    }
  } catch (error) {
    console.error('Failed to load audit chain:', error);
  }
};

/**
 * Convenience methods for specific event types
 */
const logAuth = (eventType, userId, success, details = {}) => {
  return logEvent(eventType, userId, { success, ...details });
};

const logDataset = (eventType, userId, datasetId, details = {}) => {
  return logEvent(eventType, userId, { datasetId, ...details });
};

const logConsent = (eventType, userId, consentId, details = {}) => {
  return logEvent(eventType, userId, { consentId, ...details });
};

const logAccess = (userId, resourceId, action, details = {}) => {
  return logEvent(AUDIT_EVENTS.DATASET_ACCESSED, userId, { 
    resourceId, 
    action, 
    ...details 
  });
};

/**
 * Audit Chain interface
 */
export const auditChainService = {
  // Core logging
  log: logEvent,
  logAuth,
  logDataset,
  logConsent,
  logAccess,
  
  // Validation
  validateChain,
  
  // Retrieval
  getEventById,
  getEventsByType,
  getEventsByUser,
  getEventsByDataset,
  query: queryEvents,
  
  // Statistics
  getStatistics,
  
  // Export
  export: exportChain,
  
  // Persistence
  persist: persistChain,
  load: loadChainFromDisk,
  
  // Constants
  AUDIT_EVENTS,
  AUDIT_CONFIG
};

export {
  logEvent,
  logAuth,
  logDataset,
  logConsent,
  logAccess,
  validateChain,
  calculateEventHash,
  exportChain,
  queryEvents
};
