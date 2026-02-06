/**
 * Safe Data Access Platform - Main Entry Point
 * 
 * Privacy-governed statistical data access system with defense-in-depth architecture.
 * 
 * ARCHITECTURE OVERVIEW:
 * - Gateway Layer: Entry point with security middleware
 * - Identity Layer: JWT authentication & role-based access
 * - Consent Layer: Purpose-scoped consent management
 * - Ingestion Layer: Raw dataset intake (admin only)
 * - Classification Layer: Field sensitivity detection
 * - Anonymization Layer: Privacy transformations
 * - Storage Layer: Encrypted logical data stores
 * - Release Layer: Dataset release engine
 * - Access Layer: Controlled researcher access
 * - Audit Layer: Comprehensive activity logging
 * - Risk Layer: Privacy risk scoring
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { createGateway, logger } from './gateway/index.js';
import { verifyJWT, requireRole, authService, ROLES } from './identity/index.js';
import { consentService, CONSENT_STATUS } from './consent/index.js';
import { ingestionService } from './ingestion/index.js';
import { classificationService } from './classification/index.js';
import { anonymizationService } from './anonymization/index.js';
import { storageService, stores } from './storage/index.js';
import { releaseService } from './release/index.js';
import { accessService } from './access/index.js';
import { auditService, AUDIT_EVENTS } from './audit/index.js';
import { riskService } from './risk/index.js';

// Import enhanced security modules
import { cryptoService } from './crypto/index.js';
import { anonymizationEngine } from './anonymization/engine.js';
import { dpEngine } from './dpEngine/index.js';
import { riskEngine } from './riskEngine/index.js';
import { consentEngine } from './consentEngine/index.js';
import { queryFirewall } from './queryFirewall/index.js';
import { auditChainService } from './auditChain/index.js';
import { releasePipeline } from './releasePipeline/index.js';

// Initialize gateway
const { app, notFoundHandler, globalErrorHandler } = createGateway();

// ==========================================
// HEALTH & STATUS ROUTES
// ==========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    layers: {
      gateway: 'active',
      identity: 'active',
      consent: 'active',
      ingestion: 'active',
      classification: 'active',
      anonymization: 'active',
      storage: 'active',
      release: 'active',
      access: 'active',
      audit: 'active',
      risk: 'active'
    }
  });
});

app.get('/api/status', (req, res) => {
  const storageStats = storageService.getStats();
  
  res.json({
    platform: 'Safe Data Access System',
    status: 'operational',
    storage: storageStats,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'userId and password are required'
      });
    }
    
    const result = await authService.login(userId, password);
    
    auditService.logAuth(AUDIT_EVENTS.USER_LOGIN, userId, true);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    auditService.logAuth(AUDIT_EVENTS.USER_LOGIN, req.body.userId, false, { error: error.message });
    next(error);
  }
});

// Register new user (admin only)
app.post('/api/auth/register', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { userId, password, role, purposeScope } = req.body;
    
    const user = await authService.register(userId, password, role, purposeScope);
    
    auditService.log(AUDIT_EVENTS.USER_CREATED, req.user.userId, {
      newUserId: userId,
      role
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user
    });
  } catch (error) {
    next(error);
  }
});

// List users (admin only)
app.get('/api/auth/users', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const users = authService.listUsers();
  res.json({ users });
});

// ==========================================
// DATA INGESTION ROUTES (Admin only)
// ==========================================

app.post('/api/ingestion/json', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { dataset, metadata } = req.body;
    
    if (!dataset || !Array.isArray(dataset)) {
      return res.status(400).json({
        error: 'Invalid dataset',
        message: 'Dataset must be an array'
      });
    }
    
    // Ingest dataset
    const ingestionRecord = await ingestionService.ingestJSON(dataset, metadata);
    
    // Store in raw storage
    storageService.storeRaw(ingestionRecord.id, dataset, ingestionRecord.metadata);
    
    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_INGESTED, req.user.userId, ingestionRecord.id, {
      type: 'json',
      recordCount: ingestionRecord.metadata.recordCount,
      fieldCount: ingestionRecord.metadata.fieldCount
    });
    
    res.status(201).json({
      success: true,
      message: 'Dataset ingested successfully',
      datasetId: ingestionRecord.id,
      stats: ingestionRecord.metadata
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ingestion/csv', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { csvContent, metadata } = req.body;
    
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({
        error: 'Invalid CSV content',
        message: 'csvContent must be a string'
      });
    }
    
    // Ingest CSV
    const ingestionRecord = await ingestionService.ingestCSV(csvContent, metadata);
    
    // Retrieve the data and store it
    const dataset = ingestionRecord.data || [];
    storageService.storeRaw(ingestionRecord.id, dataset, ingestionRecord.metadata);
    
    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_INGESTED, req.user.userId, ingestionRecord.id, {
      type: 'csv',
      recordCount: ingestionRecord.metadata.recordCount
    });
    
    res.status(201).json({
      success: true,
      message: 'CSV dataset ingested successfully',
      datasetId: ingestionRecord.id,
      stats: ingestionRecord.metadata
    });
  } catch (error) {
    next(error);
  }
});

// List datasets
app.get('/api/ingestion/datasets', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const datasets = storageService.listDatasets();
  res.json({ datasets });
});

// Get dataset metadata
app.get('/api/ingestion/datasets/:datasetId/metadata', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { datasetId } = req.params;
  const metadata = storageService.getMetadata(datasetId);
  
  if (!metadata) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  
  res.json(metadata);
});

// ==========================================
// CLASSIFICATION ROUTES (Admin/Reviewer)
// ==========================================

// Note: Enhanced classification route is defined later in the file

app.post('/api/classification/field/:fieldName', verifyJWT, requireRole(ROLES.ADMIN, ROLES.RESEARCHER, ROLES.REVIEWER), (req, res) => {
  const { fieldName } = req.params;
  const result = classificationService.classifyField(fieldName);
  
  res.json(result);
});

// ==========================================
// RISK ASSESSMENT ROUTES (Admin/Reviewer)
// ==========================================

// Note: Enhanced classification route is defined later in the file

app.post('/api/classification/field/:fieldName', verifyJWT, requireRole(ROLES.ADMIN, ROLES.RESEARCHER, ROLES.REVIEWER), (req, res) => {
  const { fieldName } = req.params;
  const result = classificationService.classifyField(fieldName);
  
  res.json(result);
});

// ==========================================
// CONSENT ROUTES
// ==========================================

// Request consent (researcher)
app.post('/api/consent/request', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { purpose, allowedFields, expiryDate, datasetId } = req.body;
    
    if (!purpose || !allowedFields || !Array.isArray(allowedFields)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'purpose and allowedFields (array) are required'
      });
    }
    
    const consent = await consentService.requestConsent(
      req.user.userId,
      purpose,
      allowedFields,
      expiryDate,
      datasetId
    );
    
    // Audit
    auditService.logConsent(AUDIT_EVENTS.CONSENT_REQUESTED, req.user.userId, consent.id, {
      purpose,
      allowedFields,
      datasetId
    });
    
    res.status(201).json({
      success: true,
      message: 'Consent request submitted',
      consent
    });
  } catch (error) {
    next(error);
  }
});

// Approve consent (admin/reviewer)
app.post('/api/consent/:consentId/approve', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const { riskScore } = req.body;
    
    const consent = await consentService.approveConsent(consentId, req.user.userId, riskScore);
    
    // Audit
    auditService.logConsent(AUDIT_EVENTS.CONSENT_APPROVED, req.user.userId, consentId, {
      researcherId: consent.researcherId,
      riskScore
    });
    
    res.json({
      success: true,
      message: 'Consent approved',
      consent
    });
  } catch (error) {
    next(error);
  }
});

// Reject consent (admin/reviewer)
app.post('/api/consent/:consentId/reject', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const { reason } = req.body;
    
    const consent = await consentService.rejectConsent(consentId, req.user.userId, reason);
    
    // Audit
    auditService.logConsent(AUDIT_EVENTS.CONSENT_REJECTED, req.user.userId, consentId, {
      researcherId: consent.researcherId,
      reason
    });
    
    res.json({
      success: true,
      message: 'Consent rejected',
      consent
    });
  } catch (error) {
    next(error);
  }
});

// Get my consents (researcher)
app.get('/api/consent/my', verifyJWT, requireRole(ROLES.RESEARCHER), (req, res) => {
  const consents = consentService.getConsentsByResearcher(req.user.userId);
  res.json({ consents });
});

// Get consent by ID
app.get('/api/consent/:consentId', verifyJWT, (req, res) => {
  const { consentId } = req.params;
  const consent = consentService.getConsent(consentId);
  
  if (!consent) {
    return res.status(404).json({ error: 'Consent not found' });
  }
  
  // Only allow researcher to see their own consents, or admin/reviewer to see any
  if (req.user.role === ROLES.RESEARCHER && consent.researcherId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  res.json({ consent });
});

// List all consents (admin/reviewer)
app.get('/api/consent', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  const { status } = req.query;
  let consents = consentService.listAllConsents();
  
  if (status) {
    consents = consents.filter(c => c.status === status);
  }
  
  res.json({ consents });
});

// ==========================================
// RISK ASSESSMENT ROUTES
// ==========================================

// Note: Enhanced risk assessment routes are defined later in the file

// Compare risk before/after anonymization
app.post('/api/risk/compare/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { customStrategies } = req.body;
    
    // Get raw data
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const rawData = cryptoService.decrypt(record.encrypted);
    
    // Get classification
    const classification = classificationService.classifyDataset(rawData);
    
    // Anonymize
    const anonymizedData = anonymizationService.anonymizeDataset(
      rawData,
      classification,
      null,
      customStrategies || {}
    );
    
    // Compare risk
    const comparison = riskService.compareRisk(rawData, anonymizedData, classification);
    
    res.json({
      success: true,
      datasetId,
      comparison
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// DATASET RELEASE ROUTES (Admin only)
// ==========================================

// Note: Enhanced release route is defined later in the file

// List releases (admin: all, researcher: own)
app.get('/api/release', verifyJWT, (req, res) => {
  let releases;
  
  if (req.user.role === ROLES.RESEARCHER) {
    releases = releaseService.listReleasesByResearcher(req.user.userId);
  } else {
    releases = releaseService.listAllReleases();
  }
  
  res.json({ releases });
});

// ==========================================
// RESEARCHER ACCESS ROUTES (Researcher only)
// ==========================================

// Query released dataset
app.post('/api/access/query/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const query = req.body;
    
    const result = accessService.queryDataset(releaseId, query, req.user);
    
    // Audit
    auditService.logAccess(req.user.userId, releaseId, query, result.totalRecords);
    auditService.logDataset(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, releaseId, {
      queryId: result.queryId,
      resultCount: result.totalRecords
    });
    
    res.json({
      success: true,
      queryId: result.queryId,
      totalRecords: result.totalRecords,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    next(error);
  }
});

// Get dataset summary (statistical view)
app.get('/api/access/summary/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), (req, res, next) => {
  try {
    const { releaseId } = req.params;
    
    const summary = accessService.getDatasetSummary(releaseId, req.user);
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// List accessible datasets
app.get('/api/access/datasets', verifyJWT, requireRole(ROLES.RESEARCHER), (req, res) => {
  const datasets = accessService.listAccessibleDatasets(req.user.userId);
  
  res.json({
    success: true,
    count: datasets.length,
    datasets
  });
});

// Get query history
app.get('/api/access/history', verifyJWT, requireRole(ROLES.RESEARCHER), (req, res) => {
  const history = accessService.getQueryHistory(req.user.userId);
  
  res.json({
    success: true,
    count: history.length,
    history
  });
});

// ==========================================
// AUDIT ROUTES (Admin only)
// ==========================================

// Query audit log
app.get('/api/audit', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { eventType, userId, fromDate, toDate, limit } = req.query;
  
  const filters = {};
  if (eventType) filters.eventType = eventType;
  if (userId) filters.userId = userId;
  if (fromDate) filters.fromDate = fromDate;
  if (toDate) filters.toDate = toDate;
  if (limit) filters.limit = parseInt(limit);
  
  const events = auditService.query(filters);
  
  res.json({
    success: true,
    count: events.length,
    events
  });
});

// Get user activity
app.get('/api/audit/user/:userId', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { userId } = req.params;
  const { fromDate, toDate } = req.query;
  
  const activity = auditService.getUserActivity(userId, fromDate, toDate);
  
  res.json({
    success: true,
    activity
  });
});

// Get dataset activity
app.get('/api/audit/dataset/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { datasetId } = req.params;
  
  const activity = auditService.getDatasetActivity(datasetId);
  
  res.json({
    success: true,
    activity
  });
});

// Get consent lifecycle
app.get('/api/audit/consent/:consentId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  const { consentId } = req.params;
  
  const lifecycle = auditService.getConsentLifecycle(consentId);
  
  res.json({
    success: true,
    lifecycle
  });
});

// Generate compliance report
app.get('/api/audit/report', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { fromDate, toDate } = req.query;
  
  const report = auditService.generateComplianceReport(fromDate, toDate);
  
  res.json({
    success: true,
    report
  });
});

// Export audit log
app.get('/api/audit/export', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { format } = req.query;
  
  try {
    const exportData = auditService.export(format || 'json');
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format || 'json'}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// ENHANCED SECURITY ROUTES
// ==========================================

// Security status
app.get('/api/security/status', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    components: {
      crypto: { status: 'active', algorithm: 'AES-256-GCM' },
      anonymization: { status: 'active', kDefault: 5 },
      dp: { status: 'active', epsilonDefault: 1.0 },
      risk: { status: 'active' },
      consent: { status: 'active' },
      firewall: { status: 'active' },
      audit: { status: 'active' },
      pipeline: { status: 'active' }
    }
  });
});

// Enhanced data ingestion with encryption
app.post('/api/ingestion/dataset', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { dataset, metadata = {} } = req.body;
    
    if (!dataset || !Array.isArray(dataset)) {
      return res.status(400).json({ error: 'Dataset must be an array' });
    }
    
    // Ingest and validate
    const ingestionRecord = await ingestionService.ingestJSON(dataset, metadata);
    
    // Encrypt dataset with key hierarchy
    const encryptedPackage = cryptoService.encrypt(dataset);
    
    // Store encrypted package directly (not using storeRaw to avoid double encryption)
    stores.raw.set(ingestionRecord.id, {
      id: ingestionRecord.id,
      type: 'raw',
      encrypted: encryptedPackage,
      metadata: {
        ...ingestionRecord.metadata,
        storedAt: new Date().toISOString(),
        encrypted: true,
        keyHierarchy: 'DEK/KEK'
      }
    });
    
    stores.metadata.set(ingestionRecord.id, {
      id: ingestionRecord.id,
      type: 'raw',
      ...ingestionRecord.metadata,
      storedAt: new Date().toISOString()
    });
    
    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_INGESTED, req.user.userId, ingestionRecord.id, {
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
    next(error);
  }
});

// Enhanced classification with risk assessment
app.post('/api/classification/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    
    // Retrieve from store and decrypt
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const data = cryptoService.decrypt(record.encrypted);
    
    // Classify
    const classification = classificationService.classifyDataset(data);
    
    // Calculate risk
    const riskAssessment = riskEngine.calculateRiskScore(data, classification);
    
    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_CLASSIFIED, req.user.userId, datasetId, {
      riskScore: riskAssessment.overallRisk,
      riskLevel: riskAssessment.riskLevel
    });
    
    res.json({
      datasetId,
      classification,
      riskAssessment
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced risk assessment
app.post('/api/risk/assess/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    
    // Retrieve from store and decrypt
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const data = cryptoService.decrypt(record.encrypted);
    
    // Get classification
    const classification = classificationService.classifyDataset(data);
    
    // Assess risk
    const assessment = riskEngine.calculateRiskScore(data, classification);
    
    res.json({
      success: true,
      datasetId,
      assessment
    });
  } catch (error) {
    next(error);
  }
});

// Check k-anonymity
app.post('/api/risk/k-anonymity/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { k = 5 } = req.body;
    
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const data = cryptoService.decrypt(record.encrypted);
    const classification = classificationService.classifyDataset(data);
    
    const result = anonymizationEngine.checkKAnonymity(
      data,
      classification.summary.quasiIdentifiers,
      k
    );
    
    res.json({
      success: true,
      datasetId,
      kAnonymity: result
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced consent with purpose binding
app.post('/api/consent/request', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { purpose, allowedFields, expiryDate, datasetId } = req.body;
    
    // Validate purpose
    const purposeValidation = consentEngine.validatePurpose(purpose);
    if (!purposeValidation.valid) {
      return res.status(400).json({ error: purposeValidation.error });
    }
    
    const consent = await consentEngine.requestConsent(
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
    
    auditService.logConsent(AUDIT_EVENTS.CONSENT_REQUESTED, req.user.userId, consent.id, {
      purpose,
      allowedFields
    });
    
    res.status(201).json({
      success: true,
      consent
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/consent/:consentId/approve', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const { riskScore, notes } = req.body;
    
    const consent = await consentEngine.approveConsent(consentId, req.user.userId, {
      riskScore,
      notes
    });
    
    auditService.logConsent(AUDIT_EVENTS.CONSENT_APPROVED, req.user.userId, consentId, {
      researcherId: consent.researcherId,
      riskScore
    });
    
    res.json({
      success: true,
      consent
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced release pipeline
app.post('/api/release/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { consentId, k = 5, l = 2 } = req.body;
    
    if (!consentId) {
      return res.status(400).json({ error: 'Consent ID required' });
    }
    
    // Verify consent
    const consentCheck = consentEngine.isConsentValid(consentId);
    if (!consentCheck.valid) {
      return res.status(403).json({ error: consentCheck.reason });
    }
    
    // Retrieve and decrypt raw data
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const rawData = cryptoService.decrypt(record.encrypted);
    
    // Execute pipeline
    const result = await releasePipeline.execute(datasetId, rawData, consentId, {
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
    
    auditService.logDataset(AUDIT_EVENTS.DATASET_RELEASED, req.user.userId, datasetId, {
      releaseId: result.releaseId,
      consentId,
      researcherId: consentCheck.consent.researcherId,
      riskScore: result.riskAssessment?.overallRisk,
      stagesCompleted: result.stagesCompleted
    });
    
    res.json({
      success: true,
      releaseId: result.releaseId,
      executionId: result.executionId,
      riskAssessment: result.riskAssessment,
      stagesCompleted: result.stagesCompleted,
      recordCount: result.recordCount
    });
  } catch (error) {
    next(error);
  }
});

// DP Count query
app.post('/api/dp/count/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const { epsilon = 1.0, filters } = req.body;
    
    const consentRecord = consentEngine.getConsentForRelease(releaseId);
    if (!consentRecord) {
      return res.status(403).json({ error: 'No consent for this release' });
    }
    
    if (epsilon > consentRecord.constraints.dpEpsilon) {
      return res.status(403).json({
        error: 'Epsilon exceeds consent limit',
        maxEpsilon: consentRecord.constraints.dpEpsilon
      });
    }
    
    // Get data
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = cryptoService.decrypt(releasedData.encryptedPackage);
    let dataset = decryptedData.data;
    
    if (filters) {
      dataset = dataset.filter(record => {
        return Object.entries(filters).every(([field, value]) => record[field] === value);
      });
    }
    
    // Apply DP count
    const dpResult = dpEngine.count(dataset.length, epsilon);
    
    auditChainService.log(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, {
      releaseId,
      queryType: 'dp_count',
      epsilon
    });
    
    res.json(dpResult);
  } catch (error) {
    next(error);
  }
});

// DP Sum query
app.post('/api/dp/sum/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const { field, epsilon = 1.0, filters } = req.body;
    
    const consentRecord = consentEngine.getConsentForRelease(releaseId);
    if (!consentRecord) {
      return res.status(403).json({ error: 'No consent for this release' });
    }
    
    if (epsilon > consentRecord.constraints.dpEpsilon) {
      return res.status(403).json({
        error: 'Epsilon exceeds consent limit',
        maxEpsilon: consentRecord.constraints.dpEpsilon
      });
    }
    
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = cryptoService.decrypt(releasedData.encryptedPackage);
    let dataset = decryptedData.data;
    
    if (filters) {
      dataset = dataset.filter(record => {
        return Object.entries(filters).every(([f, v]) => record[f] === v);
      });
    }
    
    const sum = dataset.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0);
    const dpResult = dpEngine.sum(sum, epsilon);
    
    auditChainService.log(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, {
      releaseId,
      queryType: 'dp_sum',
      field,
      epsilon
    });
    
    res.json(dpResult);
  } catch (error) {
    next(error);
  }
});

// DP Mean query
app.post('/api/dp/mean/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const { field, epsilon = 1.0 } = req.body;
    
    const consentRecord = consentEngine.getConsentForRelease(releaseId);
    if (!consentRecord) {
      return res.status(403).json({ error: 'No consent for this release' });
    }
    
    if (epsilon > consentRecord.constraints.dpEpsilon) {
      return res.status(403).json({
        error: 'Epsilon exceeds consent limit',
        maxEpsilon: consentRecord.constraints.dpEpsilon
      });
    }
    
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = cryptoService.decrypt(releasedData.encryptedPackage);
    const dataset = decryptedData.data;
    
    const values = dataset.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    const dpResult = dpEngine.mean(mean, values.length, epsilon);
    
    auditChainService.log(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, {
      releaseId,
      queryType: 'dp_mean',
      field,
      epsilon
    });
    
    res.json(dpResult);
  } catch (error) {
    next(error);
  }
});

// DP Histogram query
app.post('/api/dp/histogram/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const { field, epsilon = 1.0 } = req.body;
    
    const consentRecord = consentEngine.getConsentForRelease(releaseId);
    if (!consentRecord) {
      return res.status(403).json({ error: 'No consent for this release' });
    }
    
    if (epsilon > consentRecord.constraints.dpEpsilon) {
      return res.status(403).json({
        error: 'Epsilon exceeds consent limit',
        maxEpsilon: consentRecord.constraints.dpEpsilon
      });
    }
    
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = cryptoService.decrypt(releasedData.encryptedPackage);
    const dataset = decryptedData.data;
    
    const histogramBins = {};
    dataset.forEach(r => {
      const value = r[field];
      histogramBins[value] = (histogramBins[value] || 0) + 1;
    });
    
    const dpResult = dpEngine.histogram(histogramBins, epsilon);
    
    auditChainService.log(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, {
      releaseId,
      queryType: 'dp_histogram',
      field,
      epsilon
    });
    
    res.json(dpResult);
  } catch (error) {
    next(error);
  }
});

// Secure query with firewall
app.post('/api/query/:releaseId', verifyJWT, requireRole(ROLES.RESEARCHER), async (req, res, next) => {
  try {
    const { releaseId } = req.params;
    const query = req.body;
    
    const consentRecord = consentEngine.getConsentForRelease(releaseId);
    if (!consentRecord) {
      return res.status(403).json({ error: 'No valid consent for this release' });
    }
    
    // Validate consent
    const accessValidation = consentEngine.validateAccess(consentRecord.id, {
      purpose: query.purpose,
      fields: query.fields,
      epsilon: query.epsilon
    });
    
    if (!accessValidation.valid) {
      return res.status(403).json({ error: accessValidation.reason });
    }
    
    // Get dataset
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = cryptoService.decrypt(releasedData.encryptedPackage);
    const dataset = decryptedData.data;
    
    // Query firewall check
    const firewallResult = queryFirewall.validateQuery(req.user.userId, query, {
      datasetSize: dataset.length,
      estimatedResults: query.filters ? Math.floor(dataset.length * 0.3) : dataset.length
    });
    
    if (!firewallResult.allowed) {
      await auditChainService.log(AUDIT_EVENTS.QUERY_BLOCKED, req.user.userId, {
        reason: firewallResult.reason,
        releaseId
      });
      return res.status(403).json({ error: firewallResult.reason });
    }
    
    auditChainService.log(AUDIT_EVENTS.QUERY_EXECUTED, req.user.userId, {
      releaseId,
      queryType: query.type,
      aggregate: query.aggregate,
      epsilon: query.epsilon
    });
    
    res.json({
      success: true,
      firewall: firewallResult,
      consent: {
        purpose: consentRecord.purpose,
        allowedFields: consentRecord.allowedFields
      },
      result: { count: dataset.length }
    });
  } catch (error) {
    next(error);
  }
});

// Tamper-proof audit chain
app.get('/api/audit/chain', verifyJWT, requireRole(ROLES.ADMIN, ROLES.AUDITOR), async (req, res) => {
  try {
    const validation = auditChainService.validateChain();
    const stats = auditChainService.getStatistics();
    
    res.json({
      valid: validation.valid,
      statistics: stats,
      error: validation.error || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit/events', verifyJWT, requireRole(ROLES.ADMIN, ROLES.AUDITOR), async (req, res) => {
  try {
    const { eventType, userId, from, to, limit = 100 } = req.query;
    
    const events = auditChainService.query({
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
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// ==========================================
// SERVER STARTUP
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           SAFE DATA ACCESS PLATFORM                        ║
║           Privacy-Governed Statistical Data System           ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                               ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                  ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  logger.info(`Server started on port ${PORT}`);
});

export default app;






