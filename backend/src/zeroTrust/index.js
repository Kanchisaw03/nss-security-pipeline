import jwt from 'jsonwebtoken';
import { auditService, AUDIT_EVENTS } from '../audit/index.js';
import { consentService } from '../consent/index.js';
import { riskEngine } from '../riskEngine/index.js';

/**
 * Zero Trust Middleware
 * 
 * Implements "never trust, always verify" security model.
 * Every request must pass multiple validation layers:
 * 1. JWT verification
 * 2. Role check
 * 3. Consent validation
 * 4. Purpose match
 * 5. Risk threshold check
 * 6. Query safety check
 * 7. Rate limit
 * 8. IP + device logging
 */

// JWT configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: 'safe-data-access-platform'
};

// Roles
export const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  REVIEWER: 'reviewer',
  AUDITOR: 'auditor'
};

// Role hierarchy (for permission checking)
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.REVIEWER]: 3,
  [ROLES.RESEARCHER]: 2,
  [ROLES.AUDITOR]: 1
};

// Request tracking for rate limiting and anomaly detection
const requestTracker = new Map();
const MAX_REQUESTS_PER_WINDOW = 100;
const REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour block

/**
 * Extract client information from request
 */
const extractClientInfo = (req) => {
  return {
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    deviceId: req.get('x-device-id') || 'unknown',
    sessionId: req.get('x-session-id') || 'unknown'
  };
};

/**
 * Check if request is rate limited
 */
const checkRateLimit = (userId, clientInfo) => {
  const key = `${userId}:${clientInfo.ip}`;
  const now = Date.now();
  
  if (!requestTracker.has(key)) {
    requestTracker.set(key, {
      count: 1,
      windowStart: now,
      blocked: false,
      blockExpires: null
    });
    return { allowed: true };
  }
  
  const tracker = requestTracker.get(key);
  
  // Check if currently blocked
  if (tracker.blocked) {
    if (now < tracker.blockExpires) {
      return {
        allowed: false,
        reason: 'IP blocked due to excessive requests',
        retryAfter: Math.ceil((tracker.blockExpires - now) / 1000)
      };
    } else {
      // Unblock
      tracker.blocked = false;
      tracker.blockExpires = null;
      tracker.count = 1;
      tracker.windowStart = now;
    }
  }
  
  // Check if window expired
  if (now - tracker.windowStart > REQUEST_WINDOW_MS) {
    tracker.count = 1;
    tracker.windowStart = now;
    return { allowed: true };
  }
  
  // Increment count
  tracker.count++;
  
  // Check if over limit
  if (tracker.count > MAX_REQUESTS_PER_WINDOW) {
    tracker.blocked = true;
    tracker.blockExpires = now + BLOCK_DURATION_MS;
    
    auditService.log(AUDIT_EVENTS.RATE_LIMIT_EXCEEDED, userId, {
      ip: clientInfo.ip,
      requestCount: tracker.count,
      blockedFor: '1 hour'
    });
    
    return {
      allowed: false,
      reason: 'Rate limit exceeded',
      retryAfter: BLOCK_DURATION_MS / 1000
    };
  }
  
  return { allowed: true };
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer
    });
    return { valid: true, decoded };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message,
      expired: error.name === 'TokenExpiredError'
    };
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, role, additionalClaims = {}) => {
  return jwt.sign(
    {
      userId,
      role,
      ...additionalClaims
    },
    JWT_CONFIG.secret,
    {
      expiresIn: JWT_CONFIG.expiresIn,
      issuer: JWT_CONFIG.issuer
    }
  );
};

/**
 * Check if user has required role
 */
const checkRole = (userRole, requiredRoles) => {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }
  
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  
  for (const requiredRole of requiredRoles) {
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    // Admin can do everything
    if (userRole === ROLES.ADMIN) {
      return { allowed: true };
    }
    
    // User has exact role or higher
    if (userLevel >= requiredLevel) {
      return { allowed: true };
    }
  }
  
  return {
    allowed: false,
    reason: `Insufficient privileges. Required: ${requiredRoles.join(' or ')}, Current: ${userRole}`
  };
};

/**
 * Validate consent for access
 */
const validateConsent = (consentId, requestedFields = null) => {
  try {
    const consent = consentService.getConsent(consentId);
    
    if (!consent) {
      return { valid: false, reason: 'Consent not found' };
    }
    
    // Check if consent is approved
    if (consent.status !== 'approved') {
      return { 
        valid: false, 
        reason: `Consent status is ${consent.status}, must be approved` 
      };
    }
    
    // Check expiry
    const now = new Date();
    const expiry = new Date(consent.expiryDate);
    if (now > expiry) {
      return { valid: false, reason: 'Consent has expired' };
    }
    
    // Check field authorization if fields requested
    if (requestedFields && requestedFields.length > 0) {
      const unauthorizedFields = requestedFields.filter(
        field => !consent.allowedFields.includes(field)
      );
      
      if (unauthorizedFields.length > 0) {
        return {
          valid: false,
          reason: `Unauthorized fields: ${unauthorizedFields.join(', ')}`
        };
      }
    }
    
    return { 
      valid: true, 
      consent,
      allowedFields: consent.allowedFields,
      purpose: consent.purpose
    };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
};

/**
 * Verify purpose binding
 */
const verifyPurpose = (requestedPurpose, consentPurpose) => {
  if (!requestedPurpose || !consentPurpose) {
    return { valid: false, reason: 'Purpose not specified' };
  }
  
  // Exact match required
  if (requestedPurpose !== consentPurpose) {
    return {
      valid: false,
      reason: `Purpose mismatch. Requested: ${requestedPurpose}, Allowed: ${consentPurpose}`
    };
  }
  
  return { valid: true };
};

/**
 * Check risk threshold
 */
const checkRiskThreshold = (riskScore, maxRiskLevel = 'Medium') => {
  const levels = { 'Low': 1, 'Medium': 2, 'High': 3 };
  const currentLevel = levels[riskScore.riskLevel] || 3;
  const maxLevel = levels[maxRiskLevel] || 2;
  
  if (currentLevel > maxLevel) {
    return {
      allowed: false,
      reason: `Risk level ${riskScore.riskLevel} exceeds maximum allowed ${maxRiskLevel}`,
      riskScore: riskScore.overallRisk
    };
  }
  
  return { allowed: true };
};

/**
 * Validate query safety
 * Prevents queries that could be used for re-identification
 */
const validateQuerySafety = (query, datasetSize) => {
  if (!query) {
    return { safe: true };
  }
  
  // Check for overly specific filters
  if (query.filters) {
    // If filters would narrow results to < k records, reject
    const k = 5;
    if (query.estimatedResults !== undefined && query.estimatedResults < k) {
      return {
        safe: false,
        reason: `Query too specific: would return < ${k} records`,
        suggestion: 'Broaden your query criteria'
      };
    }
  }
  
  // Check for suspicious query patterns (differencing attacks)
  if (query.previousQueries && query.previousQueries.length > 0) {
    const recentSimilarQueries = query.previousQueries.filter(q => 
      q.time > Date.now() - 5 * 60 * 1000 &&  // Within 5 minutes
      q.type === query.type &&
      JSON.stringify(q.filters) !== JSON.stringify(query.filters)
    );
    
    if (recentSimilarQueries.length >= 3) {
      return {
        safe: false,
        reason: 'Potential differencing attack detected: multiple similar queries',
        suggestion: 'Please wait before making similar queries'
      };
    }
  }
  
  // Check group-by cardinality
  if (query.groupBy) {
    const maxCardinality = Math.sqrt(datasetSize);  // Heuristic
    if (query.groupByCardinality > maxCardinality) {
      return {
        safe: false,
        reason: 'Group-by cardinality too high',
        suggestion: 'Reduce number of groups or aggregate further'
      };
    }
  }
  
  return { safe: true };
};

/**
 * Main Zero Trust verification middleware
 * Chains all security checks
 */
const verifyZeroTrust = (options = {}) => {
  return async (req, res, next) => {
    const clientInfo = extractClientInfo(req);
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 1. JWT Verification
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        auditService.log(AUDIT_EVENTS.AUTH_FAILED, null, {
          reason: 'Missing or invalid authorization header',
          ip: clientInfo.ip
        });
        return res.status(401).json({
          error: 'Authentication required',
          requestId
        });
      }
      
      const token = authHeader.substring(7);
      const tokenResult = verifyToken(token);
      
      if (!tokenResult.valid) {
        auditService.log(AUDIT_EVENTS.AUTH_FAILED, null, {
          reason: tokenResult.error,
          ip: clientInfo.ip
        });
        return res.status(401).json({
          error: 'Invalid or expired token',
          expired: tokenResult.expired,
          requestId
        });
      }
      
      req.user = tokenResult.decoded;
      
      // 2. Rate Limit Check
      const rateLimitResult = checkRateLimit(req.user.userId, clientInfo);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
          requestId
        });
      }
      
      // 3. Role Check
      if (options.requiredRoles) {
        const roleResult = checkRole(req.user.role, options.requiredRoles);
        if (!roleResult.allowed) {
          auditService.log(AUDIT_EVENTS.ACCESS_DENIED, req.user.userId, {
            reason: roleResult.reason,
            path: req.path
          });
          return res.status(403).json({
            error: roleResult.reason,
            requestId
          });
        }
      }
      
      // 4. Consent Validation
      if (options.requireConsent) {
        const consentId = req.params.consentId || req.body.consentId || req.query.consentId;
        if (!consentId) {
          return res.status(400).json({
            error: 'Consent ID required',
            requestId
          });
        }
        
        const consentResult = validateConsent(consentId, options.requiredFields);
        if (!consentResult.valid) {
          auditService.log(AUDIT_EVENTS.ACCESS_DENIED, req.user.userId, {
            reason: consentResult.reason,
            consentId
          });
          return res.status(403).json({
            error: consentResult.reason,
            requestId
          });
        }
        
        req.consent = consentResult.consent;
        
        // 5. Purpose Binding
        const requestedPurpose = req.body.purpose || req.query.purpose;
        if (requestedPurpose) {
          const purposeResult = verifyPurpose(requestedPurpose, consentResult.purpose);
          if (!purposeResult.valid) {
            auditService.log(AUDIT_EVENTS.ACCESS_DENIED, req.user.userId, {
              reason: purposeResult.reason,
              consentId
            });
            return res.status(403).json({
              error: purposeResult.reason,
              requestId
            });
          }
        }
      }
      
      // 6. Risk Threshold Check
      if (options.maxRiskLevel && req.riskScore) {
        const riskResult = checkRiskThreshold(req.riskScore, options.maxRiskLevel);
        if (!riskResult.allowed) {
          auditService.log(AUDIT_EVENTS.ACCESS_DENIED, req.user.userId, {
            reason: riskResult.reason,
            riskScore: riskResult.riskScore
          });
          return res.status(403).json({
            error: riskResult.reason,
            requestId
          });
        }
      }
      
      // 7. Query Safety Check
      if (options.validateQuery && req.body) {
        const queryResult = validateQuerySafety(req.body, options.datasetSize || 1000);
        if (!queryResult.safe) {
          auditService.log(AUDIT_EVENTS.QUERY_BLOCKED, req.user.userId, {
            reason: queryResult.reason,
            query: req.body
          });
          return res.status(400).json({
            error: queryResult.reason,
            suggestion: queryResult.suggestion,
            requestId
          });
        }
      }
      
      // Attach request metadata
      req.requestId = requestId;
      req.clientInfo = clientInfo;
      
      // Log successful verification
      auditService.log(AUDIT_EVENTS.ACCESS_GRANTED, req.user.userId, {
        path: req.path,
        method: req.method,
        requestId,
        ip: clientInfo.ip
      });
      
      next();
    } catch (error) {
      auditService.log(AUDIT_EVENTS.ERROR_OCCURRED, req.user?.userId, {
        error: error.message,
        path: req.path,
        requestId
      });
      
      return res.status(500).json({
        error: 'Security verification failed',
        requestId
      });
    }
  };
};

/**
 * Middleware factory for specific roles
 */
const requireRole = (...roles) => {
  return verifyZeroTrust({ requiredRoles: roles });
};

/**
 * Middleware for consent-protected routes
 */
const requireConsent = (options = {}) => {
  return verifyZeroTrust({
    requireConsent: true,
    ...options
  });
};

/**
 * Export Zero Trust service
 */
export const zeroTrust = {
  // Core verification
  verifyToken,
  generateToken,
  checkRole,
  validateConsent,
  verifyPurpose,
  checkRiskThreshold,
  validateQuerySafety,
  verifyZeroTrust,
  
  // Middleware factories
  requireRole,
  requireConsent,
  
  // Utilities
  extractClientInfo,
  checkRateLimit,
  
  // Constants
  ROLES,
  ROLE_HIERARCHY,
  JWT_CONFIG
};

export {
  verifyToken,
  generateToken,
  checkRole,
  validateConsent,
  verifyPurpose,
  checkRiskThreshold,
  validateQuerySafety,
  verifyZeroTrust,
  requireRole,
  requireConsent
};
