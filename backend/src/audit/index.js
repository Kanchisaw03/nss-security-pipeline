import { v4 as uuidv4 } from 'uuid';

/**
 * Audit Layer
 * 
 * Comprehensive activity logging:
 * - User actions
 * - Dataset operations
 * - Consent lifecycle
 * - Access queries
 * - System events
 */

// Audit log storage
const auditLog = [];
const MAX_LOG_SIZE = 10000; // Keep last 10k entries

// Audit event types
export const AUDIT_EVENTS = {
  // Authentication events
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  
  // Dataset events
  DATASET_INGESTED: 'dataset_ingested',
  DATASET_CLASSIFIED: 'dataset_classified',
  DATASET_ANONYMIZED: 'dataset_anonymized',
  DATASET_RELEASED: 'dataset_released',
  DATASET_ACCESSED: 'dataset_accessed',
  
  // Consent events
  CONSENT_REQUESTED: 'consent_requested',
  CONSENT_APPROVED: 'consent_approved',
  CONSENT_REJECTED: 'consent_rejected',
  CONSENT_EXPIRED: 'consent_expired',
  
  // Access events
  QUERY_EXECUTED: 'query_executed',
  DATA_DOWNLOADED: 'data_downloaded',
  
  // System events
  ERROR_OCCURRED: 'error_occurred',
  CONFIG_CHANGED: 'config_changed'
};

/**
 * Audit service
 */
export const auditService = {
  /**
   * Log an audit event
   */
  log: (eventType, userId, details = {}) => {
    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      eventType,
      userId: userId || 'system',
      details: sanitizeDetails(details),
      ip: details.ip || null,
      userAgent: details.userAgent || null
    };
    
    auditLog.push(entry);
    
    // Maintain max log size
    if (auditLog.length > MAX_LOG_SIZE) {
      auditLog.shift();
    }
    
    // Console log for development
    console.log(`[AUDIT] ${eventType} | User: ${userId} | ${JSON.stringify(details)}`);
    
    return entry;
  },
  
  /**
   * Log authentication event
   */
  logAuth: (eventType, userId, success, details = {}) => {
    return auditService.log(eventType, userId, {
      success,
      ...details
    });
  },
  
  /**
   * Log dataset operation
   */
  logDataset: (eventType, userId, datasetId, details = {}) => {
    return auditService.log(eventType, userId, {
      datasetId,
      ...details
    });
  },
  
  /**
   * Log consent operation
   */
  logConsent: (eventType, userId, consentId, details = {}) => {
    return auditService.log(eventType, userId, {
      consentId,
      ...details
    });
  },
  
  /**
   * Log access/query operation
   */
  logAccess: (userId, releaseId, query, resultCount, details = {}) => {
    return auditService.log(AUDIT_EVENTS.QUERY_EXECUTED, userId, {
      releaseId,
      query: sanitizeQuery(query),
      resultCount,
      ...details
    });
  },
  
  /**
   * Log error
   */
  logError: (error, userId, details = {}) => {
    return auditService.log(AUDIT_EVENTS.ERROR_OCCURRED, userId, {
      errorMessage: error.message,
      errorStack: error.stack,
      ...details
    });
  },
  
  /**
   * Query audit log
   */
  query: (filters = {}) => {
    let results = [...auditLog];
    
    if (filters.eventType) {
      results = results.filter(e => e.eventType === filters.eventType);
    }
    
    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    
    if (filters.datasetId) {
      results = results.filter(e => e.details?.datasetId === filters.datasetId);
    }
    
    if (filters.consentId) {
      results = results.filter(e => e.details?.consentId === filters.consentId);
    }
    
    if (filters.fromDate) {
      results = results.filter(e => new Date(e.timestamp) >= new Date(filters.fromDate));
    }
    
    if (filters.toDate) {
      results = results.filter(e => new Date(e.timestamp) <= new Date(filters.toDate));
    }
    
    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  },
  
  /**
   * Get user activity summary
   */
  getUserActivity: (userId, fromDate = null, toDate = null) => {
    let events = auditLog.filter(e => e.userId === userId);
    
    if (fromDate) {
      events = events.filter(e => new Date(e.timestamp) >= new Date(fromDate));
    }
    
    if (toDate) {
      events = events.filter(e => new Date(e.timestamp) <= new Date(toDate));
    }
    
    // Count by event type
    const summary = {};
    events.forEach(e => {
      summary[e.eventType] = (summary[e.eventType] || 0) + 1;
    });
    
    return {
      userId,
      totalEvents: events.length,
      eventSummary: summary,
      recentEvents: events.slice(0, 10)
    };
  },
  
  /**
   * Get dataset activity summary
   */
  getDatasetActivity: (datasetId) => {
    const events = auditLog.filter(e => 
      e.details?.datasetId === datasetId ||
      e.details?.originalDatasetId === datasetId
    );
    
    const summary = {
      ingested: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_INGESTED).length,
      classified: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_CLASSIFIED).length,
      anonymized: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_ANONYMIZED).length,
      released: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_RELEASED).length,
      accessed: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_ACCESSED).length
    };
    
    return {
      datasetId,
      totalEvents: events.length,
      lifecycle: summary,
      events: events.slice(0, 20)
    };
  },
  
  /**
   * Get consent lifecycle
   */
  getConsentLifecycle: (consentId) => {
    return auditLog
      .filter(e => e.details?.consentId === consentId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },
  
  /**
   * Generate compliance report
   */
  generateComplianceReport: (fromDate, toDate) => {
    let events = [...auditLog];
    
    if (fromDate) {
      events = events.filter(e => new Date(e.timestamp) >= new Date(fromDate));
    }
    
    if (toDate) {
      events = events.filter(e => new Date(e.timestamp) <= new Date(toDate));
    }
    
    return {
      period: { from: fromDate, to: toDate },
      totalEvents: events.length,
      eventBreakdown: events.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
      }, {}),
      uniqueUsers: [...new Set(events.map(e => e.userId))].length,
      consentApprovals: events.filter(e => e.eventType === AUDIT_EVENTS.CONSENT_APPROVED).length,
      consentRejections: events.filter(e => e.eventType === AUDIT_EVENTS.CONSENT_REJECTED).length,
      dataReleases: events.filter(e => e.eventType === AUDIT_EVENTS.DATASET_RELEASED).length,
      accessQueries: events.filter(e => e.eventType === AUDIT_EVENTS.QUERY_EXECUTED).length,
      errors: events.filter(e => e.eventType === AUDIT_EVENTS.ERROR_OCCURRED).length
    };
  },
  
  /**
   * Export audit log
   */
  export: (format = 'json') => {
    if (format === 'json') {
      return JSON.stringify(auditLog, null, 2);
    }
    
    if (format === 'csv') {
      const headers = ['timestamp', 'eventType', 'userId', 'details'];
      const rows = auditLog.map(e => [
        e.timestamp,
        e.eventType,
        e.userId,
        JSON.stringify(e.details)
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  },
  
  /**
   * Get all audit events (admin only)
   */
  getAllEvents: () => {
    return [...auditLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

/**
 * Sanitize details for logging (remove sensitive data)
 */
const sanitizeDetails = (details) => {
  if (!details || typeof details !== 'object') return details;
  
  const sanitized = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card'];
  
  Object.entries(details).forEach(([key, value]) => {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
};

/**
 * Sanitize query for logging
 */
const sanitizeQuery = (query) => {
  if (!query) return null;
  
  // Remove any PII from query values
  return {
    type: query.type || 'select',
    fields: query.fields,
    hasFilters: !!query.filters,
    hasAggregation: !!query.aggregate,
    limit: query.limit
  };
};

export { auditLog };
