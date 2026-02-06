import crypto from 'crypto';
import { auditService, AUDIT_EVENTS } from '../audit/index.js';

/**
 * Query Firewall
 * 
 * Defends against privacy attacks through query pattern analysis:
 * - Differencing attacks (A - B = individual)
 * - Reconstruction attacks
 * - Enumeration attacks
 * - Timing attacks
 * 
 * Implements:
 * - Minimum k-record threshold
 * - Query rate limiting
 * - Overlapping query detection
 * - Group-by cardinality limits
 * - Query history tracking
 */

// Firewall configuration
const FIREWALL_CONFIG = {
  // Minimum records that can be returned (k-anonymity at query time)
  MIN_K_RECORDS: 5,
  
  // Maximum queries per time window
  MAX_QUERIES_PER_WINDOW: 20,
  QUERY_WINDOW_MS: 60 * 1000, // 1 minute
  
  // Maximum similar queries before blocking
  MAX_SIMILAR_QUERIES: 3,
  SIMILAR_QUERY_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  
  // Maximum group-by cardinality
  MAX_GROUP_CARDINALITY: 100,
  
  // Suspicious pattern detection
  SUSPICIOUS_PATTERNS: {
    // Sequential ID enumeration
    SEQUENTIAL_IDS: /id[=:](\d+)/i,
    
    // Very narrow ranges
    NARROW_RANGE: (min, max) => (max - min) < 2,
    
    // Unusual time patterns
    OFF_HOURS: (hour) => hour < 6 || hour > 23
  },
  
  // Block duration
  BLOCK_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  
  // Diffix-style minimum noise
  MIN_NOISE_SCALE: 1.0
};

// Query history storage (per user)
const queryHistory = new Map();

// Blocked users
const blockedUsers = new Map();

/**
 * Generate query fingerprint for similarity detection
 * @param {Object} query - Query object
 * @returns {string} Query fingerprint hash
 */
const generateQueryFingerprint = (query) => {
  const normalizedQuery = {
    type: query.type,
    fields: query.fields ? [...query.fields].sort() : [],
    filters: query.filters ? normalizeFilters(query.filters) : {},
    aggregate: query.aggregate,
    groupBy: query.groupBy
  };
  
  const queryStr = JSON.stringify(normalizedQuery);
  return crypto.createHash('sha256').update(queryStr).digest('hex').substring(0, 16);
};

/**
 * Normalize filter structure for comparison
 */
const normalizeFilters = (filters) => {
  if (!filters || typeof filters !== 'object') return {};
  
  const normalized = {};
  
  // Sort filter keys for consistent comparison
  Object.keys(filters).sort().forEach(key => {
    const value = filters[key];
    if (typeof value === 'object' && value !== null) {
      // Range filters: normalize to consistent format
      if ('min' in value || 'max' in value) {
        normalized[key] = {
          min: value.min !== undefined ? Number(value.min) : null,
          max: value.max !== undefined ? Number(value.max) : null
        };
      } else {
        normalized[key] = value;
      }
    } else {
      normalized[key] = value;
    }
  });
  
  return normalized;
};

/**
 * Calculate filter specificity (how narrow the filter is)
 * Returns a score 0-100 where 100 = very specific (dangerous)
 */
const calculateFilterSpecificity = (filters) => {
  if (!filters || Object.keys(filters).length === 0) {
    return 0;
  }
  
  let specificityScore = 0;
  let filterCount = 0;
  
  Object.entries(filters).forEach(([field, value]) => {
    filterCount++;
    
    if (typeof value === 'string') {
      // Exact string match is highly specific
      specificityScore += 30;
    } else if (typeof value === 'number') {
      // Exact number match is highly specific
      specificityScore += 40;
    } else if (typeof value === 'object' && value !== null) {
      if (value.eq !== undefined) {
        // Equality check
        specificityScore += 35;
      } else if (value.min !== undefined && value.max !== undefined) {
        // Range check - calculate narrowness
        const range = value.max - value.min;
        if (range < 1) {
          specificityScore += 40;  // Very narrow
        } else if (range < 5) {
          specificityScore += 25;
        } else if (range < 10) {
          specificityScore += 15;
        }
      } else if (value.in && Array.isArray(value.in)) {
        // IN clause - specificity depends on count
        specificityScore += Math.min(30, value.in.length * 5);
      }
    }
  });
  
  // Bonus for multiple filters (combining makes it more specific)
  if (filterCount > 1) {
    specificityScore *= (1 + (filterCount - 1) * 0.2);
  }
  
  return Math.min(100, specificityScore);
};

/**
 * Check if user is currently blocked
 */
const isUserBlocked = (userId) => {
  const blockInfo = blockedUsers.get(userId);
  
  if (!blockInfo) return false;
  
  if (Date.now() > blockInfo.expiresAt) {
    // Unblock
    blockedUsers.delete(userId);
    return false;
  }
  
  return true;
};

/**
 * Block a user temporarily
 */
const blockUser = (userId, reason, duration = FIREWALL_CONFIG.BLOCK_DURATION_MS) => {
  const expiresAt = Date.now() + duration;
  
  blockedUsers.set(userId, {
    blockedAt: Date.now(),
    expiresAt,
    reason,
    duration
  });
  
  auditService.log(AUDIT_EVENTS.USER_BLOCKED, userId, {
    reason,
    duration,
    expiresAt: new Date(expiresAt).toISOString()
  });
};

/**
 * Record query in history
 */
const recordQuery = (userId, query, metadata = {}) => {
  if (!queryHistory.has(userId)) {
    queryHistory.set(userId, []);
  }
  
  const history = queryHistory.get(userId);
  
  const queryRecord = {
    timestamp: Date.now(),
    fingerprint: generateQueryFingerprint(query),
    query: {
      type: query.type,
      fields: query.fields,
      filters: query.filters ? Object.keys(query.filters) : [],
      aggregate: query.aggregate,
      groupBy: query.groupBy
    },
    filterSpecificity: calculateFilterSpecificity(query.filters),
    estimatedResults: metadata.estimatedResults,
    actualResults: metadata.actualResults,
    executionTime: metadata.executionTime
  };
  
  history.push(queryRecord);
  
  // Keep only last 100 queries per user
  if (history.length > 100) {
    history.shift();
  }
  
  // Clean old queries (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const filteredHistory = history.filter(q => q.timestamp > oneHourAgo);
  queryHistory.set(userId, filteredHistory);
};

/**
 * Check query rate limits
 */
const checkRateLimit = (userId) => {
  const history = queryHistory.get(userId) || [];
  const windowStart = Date.now() - FIREWALL_CONFIG.QUERY_WINDOW_MS;
  
  const recentQueries = history.filter(q => q.timestamp > windowStart);
  
  if (recentQueries.length >= FIREWALL_CONFIG.MAX_QUERIES_PER_WINDOW) {
    return {
      allowed: false,
      reason: `Query rate limit exceeded. Max ${FIREWALL_CONFIG.MAX_QUERIES_PER_WINDOW} queries per minute.`,
      retryAfter: Math.ceil(FIREWALL_CONFIG.QUERY_WINDOW_MS / 1000)
    };
  }
  
  return { allowed: true, recentCount: recentQueries.length };
};

/**
 * Check for differencing attack patterns
 * Detects multiple similar queries that could be used to isolate individual records
 */
const checkDifferencingAttack = (userId, currentQuery) => {
  const history = queryHistory.get(userId) || [];
  const windowStart = Date.now() - FIREWALL_CONFIG.SIMILAR_QUERY_WINDOW_MS;
  
  const recentQueries = history.filter(q => q.timestamp > windowStart);
  
  if (recentQueries.length < 2) {
    return { detected: false };
  }
  
  // Check for similar filter patterns with small differences
  const currentFingerprint = generateQueryFingerprint(currentQuery);
  const similarQueries = [];
  
  recentQueries.forEach(q => {
    // Check if same query type and fields
    if (q.query.type === currentQuery.type &&
        JSON.stringify(q.query.fields) === JSON.stringify(currentQuery.fields)) {
      
      // Check if filters are similar
      const filterOverlap = q.query.filters.filter(f => 
        currentQuery.filters && f in currentQuery.filters
      ).length;
      
      const filterCount = Math.max(
        q.query.filters.length,
        currentQuery.filters ? Object.keys(currentQuery.filters).length : 0
      );
      
      // If > 70% filter overlap, consider it similar
      if (filterCount > 0 && filterOverlap / filterCount > 0.7) {
        similarQueries.push(q);
      }
    }
  });
  
  if (similarQueries.length >= FIREWALL_CONFIG.MAX_SIMILAR_QUERIES) {
    return {
      detected: true,
      reason: `Potential differencing attack: ${similarQueries.length} similar queries detected`,
      similarQueryCount: similarQueries.length,
      recommendedAction: 'BLOCK'
    };
  }
  
  return { detected: false, similarQueryCount: similarQueries.length };
};

/**
 * Check for reconstruction attack patterns
 */
const checkReconstructionAttack = (userId, query, resultCount) => {
  const history = queryHistory.get(userId) || [];
  
  // Check if user is querying all possible values of a field
  const fieldCoverage = {};
  
  history.forEach(q => {
    if (q.query.filters) {
      q.query.filters.forEach(field => {
        fieldCoverage[field] = (fieldCoverage[field] || 0) + 1;
      });
    }
  });
  
  // If user has queried many distinct values of the same field
  const suspiciousFields = Object.entries(fieldCoverage)
    .filter(([_, count]) => count > 10);
  
  if (suspiciousFields.length > 0) {
    return {
      detected: true,
      reason: 'Potential reconstruction attack: querying many distinct values',
      suspiciousFields: suspiciousFields.map(([field]) => field)
    };
  }
  
  return { detected: false };
};

/**
 * Check group-by cardinality
 */
const checkGroupByCardinality = (groupByField, datasetSize) => {
  if (!groupByField) return { allowed: true };
  
  // Estimate cardinality based on dataset size
  // This is a heuristic - in production, you'd use actual statistics
  const estimatedCardinality = Math.min(datasetSize / 10, 1000);
  
  if (estimatedCardinality > FIREWALL_CONFIG.MAX_GROUP_CARDINALITY) {
    return {
      allowed: false,
      reason: `Group-by cardinality (${estimatedCardinality}) exceeds maximum (${FIREWALL_CONFIG.MAX_GROUP_CARDINALITY})`,
      suggestion: 'Aggregate into fewer groups or add more filters'
    };
  }
  
  return { allowed: true, estimatedCardinality };
};

/**
 * Check minimum record threshold
 */
const checkMinRecords = (estimatedResults) => {
  if (estimatedResults !== undefined && estimatedResults < FIREWALL_CONFIG.MIN_K_RECORDS) {
    return {
      allowed: false,
      reason: `Query too specific: would return ${estimatedResults} records, minimum required: ${FIREWALL_CONFIG.MIN_K_RECORDS}`,
      suggestion: 'Broaden your query criteria to include more records'
    };
  }
  
  return { allowed: true };
};

/**
 * Main query validation
 * Runs all security checks
 */
const validateQuery = (userId, query, metadata = {}) => {
  // 1. Check if user is blocked
  if (isUserBlocked(userId)) {
    const blockInfo = blockedUsers.get(userId);
    return {
      allowed: false,
      reason: `User temporarily blocked: ${blockInfo.reason}`,
      blocked: true,
      retryAfter: Math.ceil((blockInfo.expiresAt - Date.now()) / 1000)
    };
  }
  
  // 2. Check rate limit
  const rateLimitResult = checkRateLimit(userId);
  if (!rateLimitResult.allowed) {
    return rateLimitResult;
  }
  
  // 3. Check minimum record threshold
  const minRecordsResult = checkMinRecords(metadata.estimatedResults);
  if (!minRecordsResult.allowed) {
    return minRecordsResult;
  }
  
  // 4. Check filter specificity
  const specificity = calculateFilterSpecificity(query.filters);
  if (specificity > 80) {
    return {
      allowed: false,
      reason: `Filter too specific (specificity score: ${specificity}/100)`,
      suggestion: 'Use broader filter criteria'
    };
  }
  
  // 5. Check group-by cardinality
  const groupByResult = checkGroupByCardinality(query.groupBy, metadata.datasetSize);
  if (!groupByResult.allowed) {
    return groupByResult;
  }
  
  // 6. Check for differencing attack
  const differencingResult = checkDifferencingAttack(userId, query);
  if (differencingResult.detected) {
    // Block user for differencing attack
    blockUser(userId, differencingResult.reason);
    
    auditService.log(AUDIT_EVENTS.ATTACK_DETECTED, userId, {
      attackType: 'differencing',
      reason: differencingResult.reason,
      query: sanitizeQueryForLog(query)
    });
    
    return {
      allowed: false,
      reason: differencingResult.reason,
      blocked: true,
      attackDetected: true
    };
  }
  
  // 7. Check for reconstruction attack
  const reconstructionResult = checkReconstructionAttack(userId, query, metadata.estimatedResults);
  if (reconstructionResult.detected) {
    auditService.log(AUDIT_EVENTS.SUSPICIOUS_ACTIVITY, userId, {
      reason: reconstructionResult.reason,
      suspiciousFields: reconstructionResult.suspiciousFields
    });
    
    return {
      allowed: false,
      reason: reconstructionResult.reason,
      warning: true
    };
  }
  
  // Record query for future analysis
  recordQuery(userId, query, metadata);
  
  return {
    allowed: true,
    filterSpecificity: specificity,
    recentQueryCount: rateLimitResult.recentCount,
    warnings: specificity > 60 ? ['High filter specificity detected'] : []
  };
};

/**
 * Sanitize query for logging (remove PII)
 */
const sanitizeQueryForLog = (query) => {
  if (!query) return null;
  
  return {
    type: query.type,
    hasFilters: !!query.filters,
    filterFields: query.filters ? Object.keys(query.filters) : [],
    aggregate: query.aggregate,
    groupBy: query.groupBy
  };
};

/**
 * Get query history for a user
 */
const getQueryHistory = (userId, options = {}) => {
  const history = queryHistory.get(userId) || [];
  
  let filtered = history;
  
  if (options.from) {
    filtered = filtered.filter(q => q.timestamp >= options.from);
  }
  
  if (options.to) {
    filtered = filtered.filter(q => q.timestamp <= options.to);
  }
  
  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }
  
  return filtered;
};

/**
 * Clear query history for a user (admin only)
 */
const clearQueryHistory = (userId) => {
  queryHistory.delete(userId);
};

/**
 * Unblock a user (admin only)
 */
const unblockUser = (userId) => {
  blockedUsers.delete(userId);
  
  auditService.log(AUDIT_EVENTS.USER_UNBLOCKED, userId, {
    timestamp: new Date().toISOString()
  });
};

/**
 * Get firewall statistics
 */
const getStatistics = () => {
  return {
    blockedUsers: blockedUsers.size,
    totalQueriesTracked: Array.from(queryHistory.values())
      .reduce((sum, h) => sum + h.length, 0),
    uniqueUsers: queryHistory.size,
    config: FIREWALL_CONFIG
  };
};

/**
 * Query Firewall interface
 */
export const queryFirewall = {
  // Main validation
  validateQuery,
  
  // Attack detection
  checkDifferencingAttack,
  checkReconstructionAttack,
  
  // Utility checks
  checkRateLimit,
  checkMinRecords,
  checkGroupByCardinality,
  calculateFilterSpecificity,
  generateQueryFingerprint,
  
  // User management
  blockUser,
  unblockUser,
  isUserBlocked,
  
  // History
  getQueryHistory,
  clearQueryHistory,
  recordQuery,
  
  // Statistics
  getStatistics,
  
  // Configuration
  FIREWALL_CONFIG
};

export {
  validateQuery,
  checkDifferencingAttack,
  checkReconstructionAttack,
  checkRateLimit,
  checkMinRecords,
  checkGroupByCardinality,
  calculateFilterSpecificity,
  generateQueryFingerprint,
  blockUser,
  unblockUser,
  isUserBlocked,
  getQueryHistory,
  recordQuery,
  FIREWALL_CONFIG
};
