/**
 * Enhanced Routes with Security Integration
 * 
 * Demonstrates integration of all security modules:
 * - Dataset ingestion with encryption
 * - Classification and risk assessment
 * - Consent management with purpose binding
 * - Release pipeline with anonymization
 * - Secure querying with DP and firewall
 * - Audit logging
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { securityLayer } from '../security/index.js';
import { storageService } from '../storage/index.js';
import { ingestionService } from '../ingestion/index.js';
import { classificationService } from '../classification/index.js';
import { accessService } from '../access/index.js';

const router = Router();

// Destructure security components for easier access
const { 
  crypto, 
  anonymization, 
  dp, 
  risk, 
  auth, 
  consent, 
  firewall, 
  audit, 
  pipeline,
  roles,
  consentStatus 
} = securityLayer;

// ==========================================
// HEALTH & STATUS
// ==========================================

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    security: securityLayer.getStatus()
  });
});

// ==========================================
// AUTHENTICATION (Enhanced with Zero Trust)
// ==========================================

router.post('/auth/login', [
  body('userId').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { userId, password } = req.body;
  
  try {
    // This would integrate with actual auth service
    const token = auth.generateToken(userId, 'researcher', { 
      scope: 'data_access',
      issuedAt: Date.now()
    });
    
    await audit.log(audit.auditEvents.USER_LOGIN, userId, { 
      success: true,
      ip: req.ip 
    });
    
    res.json({
      success: true,
      token,
      expiresIn: '24h'
    });
  } catch (error) {
    await audit.logAuth(audit.auditEvents.AUTH_FAILED, userId, false, {
      error: error.message
    });
    
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ==========================================
// DATA INGESTION (With Encryption)
// ==========================================

router.post('/ingestion/dataset', 
  auth.requireRole(roles.ADMIN),
  [
    body('dataset').isArray({ min: 1 }),
    body('metadata').optional().isObject()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { dataset, metadata = {} } = req.body;
      
      // Ingest and validate
      const ingestionRecord = await ingestionService.ingestJSON(dataset, metadata);
      
      // Encrypt dataset with key hierarchy
      const encryptedPackage = crypto.encrypt(dataset);
      
      // Store encrypted
      storageService.storeRaw(ingestionRecord.id, encryptedPackage, {
        ...ingestionRecord.metadata,
        encrypted: true,
        keyHierarchy: 'DEK/KEK'
      });
      
      // Audit
      await audit.logDataset(audit.auditEvents.DATASET_INGESTED, req.user.userId, ingestionRecord.id, {
        recordCount: dataset.length,
        encrypted: true
      });
      
      res.status(201).json({
        success: true,
        datasetId: ingestionRecord.id,
        encrypted: true,
        recordCount: dataset.length
      });
    } catch (error) {
      await audit.logEvent(audit.auditEvents.ERROR_OCCURRED, req.user?.userId, {
        error: error.message,
        operation: 'ingestion'
      });
      
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// CLASSIFICATION & RISK
// ==========================================

router.post('/classification/:datasetId',
  auth.requireRole(roles.ADMIN, roles.REVIEWER),
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      
      // Retrieve and decrypt
      const encryptedData = storageService.retrieveRaw(datasetId);
      const data = crypto.decrypt(encryptedData);
      
      // Classify
      const classification = classificationService.classifyDataset(data);
      
      // Calculate risk
      const riskAssessment = risk.calculateRiskScore(data, classification);
      
      // Audit
      await audit.logDataset(audit.auditEvents.DATASET_CLASSIFIED, req.user.userId, datasetId, {
        riskScore: riskAssessment.overallRisk,
        riskLevel: riskAssessment.riskLevel
      });
      
      res.json({
        datasetId,
        classification,
        riskAssessment
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// CONSENT MANAGEMENT (Purpose-Bound)
// ==========================================

router.post('/consent/request',
  auth.requireRole(roles.RESEARCHER),
  [
    body('purpose').notEmpty(),
    body('allowedFields').isArray({ min: 1 }),
    body('datasetId').optional()
  ],
  async (req, res) => {
    try {
      const { purpose, allowedFields, datasetId, expiryDate } = req.body;
      
      // Validate purpose
      const purposeValidation = consent.validatePurpose(purpose);
      if (!purposeValidation.valid) {
        return res.status(400).json({ error: purposeValidation.error });
      }
      
      // Request consent
      const consentRecord = await consent.requestConsent(
        req.user.userId,
        purpose,
        allowedFields,
        {
          datasetId,
          expiryDate,
          aggregatesOnly: true,
          requireAnonymization: true,
          dpEpsilon: 1.0
        }
      );
      
      // Audit
      await audit.logConsent(audit.auditEvents.CONSENT_REQUESTED, req.user.userId, consentRecord.id, {
        purpose,
        allowedFields
      });
      
      res.status(201).json({
        success: true,
        consent: consentRecord
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post('/consent/:consentId/approve',
  auth.requireRole(roles.ADMIN, roles.REVIEWER),
  async (req, res) => {
    try {
      const { consentId } = req.params;
      const { riskScore, notes } = req.body;
      
      const approvedConsent = await consent.approveConsent(consentId, req.user.userId, {
        riskScore,
        notes
      });
      
      await audit.logConsent(audit.auditEvents.CONSENT_APPROVED, req.user.userId, consentId, {
        riskScore
      });
      
      res.json({
        success: true,
        consent: approvedConsent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ==========================================
// RELEASE PIPELINE
// ==========================================

router.post('/release/:datasetId',
  auth.requireRole(roles.ADMIN),
  [
    body('consentId').notEmpty(),
    body('k').optional().isInt({ min: 2 }),
    body('l').optional().isInt({ min: 2 })
  ],
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { consentId, k = 5, l = 2 } = req.body;
      
      // Verify consent
      const consentCheck = consent.isConsentValid(consentId);
      if (!consentCheck.valid) {
        return res.status(403).json({ error: consentCheck.reason });
      }
      
      // Retrieve and decrypt raw data
      const encryptedData = storageService.retrieveRaw(datasetId);
      const rawData = crypto.decrypt(encryptedData);
      
      // Execute pipeline
      const result = await pipeline.execute(datasetId, rawData, consentId, {
        k,
        l,
        maxRiskLevel: 'Medium'
      });
      
      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          stagesCompleted: result.stagesCompleted
        });
      }
      
      res.json({
        success: true,
        releaseId: result.releaseId,
        executionId: result.executionId,
        riskAssessment: result.riskAssessment,
        stagesCompleted: result.stagesCompleted,
        recordCount: result.recordCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// SECURE QUERY (With Firewall + DP)
// ==========================================

router.post('/query/:releaseId',
  auth.requireRole(roles.RESEARCHER),
  [
    body('type').notEmpty(),
    body('fields').optional().isArray(),
    body('filters').optional().isObject(),
    body('aggregate').optional().isIn(['count', 'sum', 'mean', 'histogram']),
    body('epsilon').optional().isFloat({ min: 0.01, max: 10 })
  ],
  async (req, res) => {
    try {
      const { releaseId } = req.params;
      const query = req.body;
      
      // Get consent for this release
      const consentRecord = consent.getConsentForRelease(releaseId);
      if (!consentRecord) {
        return res.status(403).json({ error: 'No valid consent for this release' });
      }
      
      // Validate consent for query
      const accessValidation = consent.validateAccess(consentRecord.id, {
        purpose: query.purpose,
        fields: query.fields,
        epsilon: query.epsilon
      });
      
      if (!accessValidation.valid) {
        await audit.logEvent(audit.auditEvents.ACCESS_DENIED, req.user.userId, {
          reason: accessValidation.reason,
          releaseId
        });
        return res.status(403).json({ error: accessValidation.reason });
      }
      
      // Retrieve released dataset
      const releasedData = storageService.retrieveReleased(releaseId);
      const decryptedData = crypto.decrypt(releasedData.encryptedPackage);
      const dataset = decryptedData.data;
      
      // Query firewall check
      const firewallResult = firewall.validateQuery(req.user.userId, query, {
        datasetSize: dataset.length,
        estimatedResults: query.filters ? estimateResultCount(dataset, query.filters) : dataset.length
      });
      
      if (!firewallResult.allowed) {
        await audit.logEvent(audit.auditEvents.QUERY_BLOCKED, req.user.userId, {
          reason: firewallResult.reason,
          releaseId
        });
        return res.status(403).json({ error: firewallResult.reason });
      }
      
      // Execute query with optional DP
      let result;
      if (query.aggregate) {
        result = executeAggregateQuery(dataset, query);
        
        // Apply DP if epsilon specified
        if (query.epsilon) {
          result = applyDPToResult(result, query);
        }
      } else {
        // Filter data
        result = filterDataset(dataset, query.filters);
      }
      
      // Log query
      await audit.logEvent(audit.auditEvents.QUERY_EXECUTED, req.user.userId, {
        releaseId,
        queryType: query.type,
        aggregate: query.aggregate,
        epsilon: query.epsilon,
        resultCount: Array.isArray(result) ? result.length : 1
      });
      
      res.json({
        success: true,
        firewall: firewallResult,
        consent: {
          purpose: consentRecord.purpose,
          allowedFields: consentRecord.allowedFields
        },
        result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// DIFFERENTIAL PRIVACY QUERIES
// ==========================================

router.post('/dp/count/:releaseId',
  auth.requireRole(roles.RESEARCHER),
  async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { epsilon = 1.0, filters } = req.body;
      
      const consentRecord = consent.getConsentForRelease(releaseId);
      if (!consentRecord) {
        return res.status(403).json({ error: 'No consent' });
      }
      
      // Check DP epsilon against consent limits
      if (epsilon > consentRecord.constraints.dpEpsilon) {
        return res.status(403).json({
          error: `Epsilon exceeds consent limit`,
          maxEpsilon: consentRecord.constraints.dpEpsilon
        });
      }
      
      // Get data
      const releasedData = storageService.retrieveReleased(releaseId);
      const decryptedData = crypto.decrypt(releasedData.encryptedPackage);
      let dataset = decryptedData.data;
      
      // Apply filters if provided
      if (filters) {
        dataset = filterDataset(dataset, filters);
      }
      
      // Apply DP count
      const dpResult = dp.count(dataset.length, epsilon);
      
      await audit.logEvent(audit.auditEvents.QUERY_EXECUTED, req.user.userId, {
        releaseId,
        queryType: 'dp_count',
        epsilon,
        trueValue: dpResult.trueValue,
        noisyValue: dpResult.noisyValue
      });
      
      res.json(dpResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/dp/sum/:releaseId',
  auth.requireRole(roles.RESEARCHER),
  async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { field, epsilon = 1.0, filters } = req.body;
      
      const consentRecord = consent.getConsentForRelease(releaseId);
      if (!consentRecord) {
        return res.status(403).json({ error: 'No consent' });
      }
      
      if (epsilon > consentRecord.constraints.dpEpsilon) {
        return res.status(403).json({
          error: `Epsilon exceeds consent limit`,
          maxEpsilon: consentRecord.constraints.dpEpsilon
        });
      }
      
      // Get data
      const releasedData = storageService.retrieveReleased(releaseId);
      const decryptedData = crypto.decrypt(releasedData.encryptedPackage);
      let dataset = decryptedData.data;
      
      // Apply filters
      if (filters) {
        dataset = filterDataset(dataset, filters);
      }
      
      // Calculate sum
      const sum = dataset.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0);
      
      // Apply DP
      const dpResult = dp.sum(sum, epsilon);
      
      await audit.logEvent(audit.auditEvents.QUERY_EXECUTED, req.user.userId, {
        releaseId,
        queryType: 'dp_sum',
        field,
        epsilon
      });
      
      res.json(dpResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/dp/mean/:releaseId',
  auth.requireRole(roles.RESEARCHER),
  async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { field, epsilon = 1.0, filters } = req.body;
      
      const consentRecord = consent.getConsentForRelease(releaseId);
      if (!consentRecord) {
        return res.status(403).json({ error: 'No consent' });
      }
      
      if (epsilon > consentRecord.constraints.dpEpsilon) {
        return res.status(403).json({
          error: `Epsilon exceeds consent limit`,
          maxEpsilon: consentRecord.constraints.dpEpsilon
        });
      }
      
      // Get data
      const releasedData = storageService.retrieveReleased(releaseId);
      const decryptedData = crypto.decrypt(releasedData.encryptedPackage);
      let dataset = decryptedData.data;
      
      // Apply filters
      if (filters) {
        dataset = filterDataset(dataset, filters);
      }
      
      // Calculate mean
      const values = dataset.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Apply DP
      const dpResult = dp.mean(mean, values.length, epsilon);
      
      await audit.logEvent(audit.auditEvents.QUERY_EXECUTED, req.user.userId, {
        releaseId,
        queryType: 'dp_mean',
        field,
        epsilon
      });
      
      res.json(dpResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/dp/histogram/:releaseId',
  auth.requireRole(roles.RESEARCHER),
  async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { field, epsilon = 1.0, bins } = req.body;
      
      const consentRecord = consent.getConsentForRelease(releaseId);
      if (!consentRecord) {
        return res.status(403).json({ error: 'No consent' });
      }
      
      if (epsilon > consentRecord.constraints.dpEpsilon) {
        return res.status(403).json({
          error: `Epsilon exceeds consent limit`,
          maxEpsilon: consentRecord.constraints.dpEpsilon
        });
      }
      
      // Get data
      const releasedData = storageService.retrieveReleased(releaseId);
      const decryptedData = crypto.decrypt(releasedData.encryptedPackage);
      const dataset = decryptedData.data;
      
      // Build histogram
      const histogramBins = {};
      dataset.forEach(r => {
        const value = r[field];
        histogramBins[value] = (histogramBins[value] || 0) + 1;
      });
      
      // Apply DP
      const dpResult = dp.histogram(histogramBins, epsilon);
      
      await audit.logEvent(audit.auditEvents.QUERY_EXECUTED, req.user.userId, {
        releaseId,
        queryType: 'dp_histogram',
        field,
        epsilon,
        binCount: Object.keys(histogramBins).length
      });
      
      res.json(dpResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// AUDIT CHAIN
// ==========================================

router.get('/audit/chain',
  auth.requireRole(roles.ADMIN, roles.AUDITOR),
  async (req, res) => {
    try {
      const validation = audit.validateChain();
      const stats = audit.getStatistics();
      
      res.json({
        valid: validation.valid,
        statistics: stats,
        error: validation.error || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/audit/events',
  auth.requireRole(roles.ADMIN, roles.AUDITOR),
  async (req, res) => {
    try {
      const { eventType, userId, from, to, limit = 100 } = req.query;
      
      const events = audit.query({
        eventType,
        userId,
        from,
        to,
        limit: parseInt(limit)
      });
      
      res.json({
        count: events.length,
        events
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/audit/export',
  auth.requireRole(roles.ADMIN),
  async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      
      const exportData = audit.export(format);
      
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// SECURITY STATUS
// ==========================================

router.get('/security/status',
  auth.requireRole(roles.ADMIN),
  (req, res) => {
    res.json(securityLayer.getStatus());
  }
);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function estimateResultCount(dataset, filters) {
  // Simple estimation - in production, use actual query planner
  let count = dataset.length;
  
  if (filters) {
    Object.entries(filters).forEach(([field, value]) => {
      if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
        // Range filter - rough estimate
        count = Math.floor(count * 0.3);
      } else {
        // Exact match - very selective
        count = Math.floor(count * 0.1);
      }
    });
  }
  
  return Math.max(0, count);
}

function filterDataset(dataset, filters) {
  if (!filters) return dataset;
  
  return dataset.filter(record => {
    return Object.entries(filters).every(([field, condition]) => {
      const value = record[field];
      
      if (typeof condition === 'object') {
        if (condition.eq !== undefined) return value === condition.eq;
        if (condition.min !== undefined && value < condition.min) return false;
        if (condition.max !== undefined && value > condition.max) return false;
        if (condition.in && Array.isArray(condition.in)) return condition.in.includes(value);
        return true;
      }
      
      return value === condition;
    });
  });
}

function executeAggregateQuery(dataset, query) {
  const { aggregate, field, groupBy } = query;
  
  if (groupBy) {
    // Group by field
    const groups = {};
    dataset.forEach(r => {
      const key = r[groupBy];
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    
    const results = {};
    Object.entries(groups).forEach(([key, group]) => {
      results[key] = calculateAggregate(group, aggregate, field);
    });
    
    return results;
  }
  
  return calculateAggregate(dataset, aggregate, field);
}

function calculateAggregate(data, type, field) {
  const values = data.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
  
  switch (type) {
    case 'count':
      return data.length;
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'mean':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return null;
  }
}

function applyDPToResult(result, query) {
  const { epsilon, aggregate } = query;
  
  if (typeof result === 'number') {
    switch (aggregate) {
      case 'count':
        return dp.count(result, epsilon);
      case 'sum':
        return dp.sum(result, epsilon);
      default:
        return result;
    }
  }
  
  if (typeof result === 'object' && result !== null) {
    const dpResult = {};
    Object.entries(result).forEach(([key, value]) => {
      if (typeof value === 'number') {
        switch (aggregate) {
          case 'count':
            dpResult[key] = dp.count(value, epsilon);
            break;
          case 'sum':
            dpResult[key] = dp.sum(value, epsilon);
            break;
          default:
            dpResult[key] = value;
        }
      } else {
        dpResult[key] = value;
      }
    });
    return dpResult;
  }
  
  return result;
}

export default router;
