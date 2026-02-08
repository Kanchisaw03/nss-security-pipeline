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
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { verifyJWT, requireRole, authService, ROLES } from './identity/index.js';
import { consentService, CONSENT_STATUS } from './consent/index.js';
import { ingestionService } from './ingestion/index.js';
import { classificationService } from './classification/index.js';
import { anonymizationService } from './anonymization/index.js';
import { storageService, stores, decrypt } from './storage/index.js';
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

// Import governance modules
import { baselineAnonymizer } from './benchmarkMode/baselineAnonymizer.js';
import { privacyUtilityReport } from './reporting/privacyUtilityReport.js';
import { attackSimulation } from './attackSimulation/index.js';

// Import multer for file uploads
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for CSV file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept CSV files by extension or mimetype
    const isCSV = file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error(`Only CSV files are allowed. Received: ${file.mimetype}`));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  }
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds 10MB limit'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }
  next();
};
import { dpdpCompliance } from './compliance/dpdpMap.js';
import { privacyUtilityCurve } from './governance/privacyUtilityCurve.js';
import { governanceIntegration } from './governance/index.js';

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
      risk: 'active',
      governance: 'active'
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

    // Check if CSV has data rows (not just headers)
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({
        error: 'Invalid CSV format',
        message: 'CSV must have a header row and at least one data row'
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
    // Handle CSV parsing errors with 400 status
    if (error.message.includes('CSV parsing failed') || error.message.includes('Schema validation failed')) {
      return res.status(400).json({
        error: 'CSV processing failed',
        message: error.message
      });
    }
    next(error);
  }
});

// Upload CSV file endpoint
app.post('/api/ingestion/csv/upload', verifyJWT, requireRole(ROLES.ADMIN), upload.single('file'), handleMulterError, async (req, res, next) => {
  try {
    // Debug logging
    logger.info(`Upload request received. Content-Type: ${req.headers['content-type']}`);
    logger.info(`File info: ${JSON.stringify(req.file)}`);
    logger.info(`Body keys: ${Object.keys(req.body || {})}`);

    if (!req.file) {
      logger.error('No file in request');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a CSV file to upload'
      });
    }

    logger.info(`Processing file: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);

    let csvContent = req.file.buffer.toString('utf-8');

    // Check if content is encrypted (JSON format with encrypted package)
    let isEncrypted = false;
    try {
      const parsed = JSON.parse(csvContent);
      if (parsed.encrypted && parsed.salt && parsed.iv) {
        logger.info('Detected encrypted CSV content, decrypting...');
        // Decrypt using the decrypt function from storage module
        csvContent = decrypt(parsed);
        isEncrypted = true;
      }
    } catch (e) {
      // Not JSON/encrypted, treat as regular CSV
    }

    const metadata = {
      filename: req.file.originalname,
      fileSize: req.file.size,
      description: req.body.description || '',
      wasEncrypted: isEncrypted
    };

    // Check if CSV has data rows
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({
        error: 'Invalid CSV format',
        message: 'CSV must have a header row and at least one data row'
      });
    }

    // Ingest CSV
    const ingestionRecord = await ingestionService.ingestCSV(csvContent, metadata);

    // Store the data
    const dataset = ingestionRecord.data || [];
    storageService.storeRaw(ingestionRecord.id, dataset, ingestionRecord.metadata);

    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_INGESTED, req.user.userId, ingestionRecord.id, {
      type: 'csv',
      recordCount: ingestionRecord.metadata.recordCount,
      filename: req.file.originalname
    });

    res.status(201).json({
      success: true,
      message: 'CSV file uploaded and ingested successfully',
      datasetId: ingestionRecord.id,
      filename: req.file.originalname,
      stats: ingestionRecord.metadata
    });
  } catch (error) {
    logger.error(`CSV upload error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    if (error.message.includes('CSV parsing failed') || error.message.includes('Schema validation failed')) {
      return res.status(400).json({
        error: 'CSV processing failed',
        message: error.message
      });
    }
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

// Get active consents
app.get('/api/consent/active', verifyJWT, (req, res) => {
  try {
    const activeConsents = consentService.getActiveConsents();
    res.json(activeConsents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const rawData = decryptRecord(record);

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
      pipeline: { status: 'active' },
      governance: {
        status: 'active',
        modules: {
          benchmark: 'active',
          privacyUtilityReport: 'active',
          attackSimulation: 'active',
          dpdpCompliance: 'active',
          privacyUtilityCurve: 'active'
        }
      }
    }
  });
});

// Enhanced data ingestion with encryption
app.post('/api/ingestion/dataset', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { dataset, metadata = {} } = req.body;

    if (!dataset || !Array.isArray(dataset) || dataset.length === 0) {
      return res.status(400).json({ error: 'Dataset must be a non-empty array' });
    }

    // Get field names from first record
    const fields = Object.keys(dataset[0]);

    // Create ingestion record with all metadata
    const datasetId = uuidv4();
    const recordCount = dataset.length;
    const fieldCount = fields.length;
    const totalSize = JSON.stringify(dataset).length;

    const fullMetadata = {
      filename: metadata.filename || 'unknown',
      originalFormat: metadata.originalFormat || 'json',
      fileSize: metadata.fileSize || totalSize,
      recordCount,
      fieldCount,
      fields,
      totalSize,
      ingestedAt: new Date().toISOString(),
      classificationStatus: 'pending',
      status: 'raw',
      anonymized: false,
      released: false
    };

    // Encrypt dataset (use simple encryption to avoid crypto issues)
    const jsonString = JSON.stringify(dataset);
    const salt = crypto.randomBytes(16).toString('hex');
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', salt, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedPackage = {
      encryptedData: encrypted,
      salt,
      iv: iv.toString('hex'),
      algorithm: 'aes-256-cbc'
    };

    // Store encrypted data
    stores.raw.set(datasetId, {
      id: datasetId,
      type: 'raw',
      encrypted: encryptedPackage,
      metadata: {
        ...fullMetadata,
        storedAt: new Date().toISOString(),
        encrypted: true
      }
    });

    // Store metadata
    stores.metadata.set(datasetId, {
      id: datasetId,
      type: 'raw',
      ...fullMetadata,
      storedAt: new Date().toISOString()
    });

    // Audit
    auditService.logDataset(AUDIT_EVENTS.DATASET_INGESTED, req.user.userId, datasetId, {
      recordCount,
      encrypted: true
    });

    res.status(201).json({
      success: true,
      datasetId,
      encrypted: true,
      recordCount
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete dataset
app.delete('/api/ingestion/datasets/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const { datasetId } = req.params;

  if (stores.raw.has(datasetId)) {
    stores.raw.delete(datasetId);
    stores.metadata.delete(datasetId);
    res.json({ success: true, message: 'Dataset deleted' });
  } else {
    res.status(404).json({ error: 'Dataset not found' });
  }
});

// Get dataset data (decrypted, with pagination)
app.get('/api/ingestion/datasets/:datasetId/data', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const { datasetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Decrypt the dataset
    const data = decryptRecord(record);

    if (!Array.isArray(data)) {
      return res.status(500).json({ error: 'Invalid dataset format' });
    }

    // Calculate pagination
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    // Get column headers from first record
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    res.json({
      success: true,
      datasetId,
      columns,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error retrieving dataset data:', error);
    res.status(500).json({ error: 'Failed to retrieve dataset data', message: error.message });
  }
});

// Clear all datasets (admin only)
app.delete('/api/ingestion/datasets', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  stores.raw.clear();
  stores.metadata.clear();
  res.json({ success: true, message: 'All datasets cleared' });
});

// Helper function to decrypt record
const decryptRecord = (record) => {
  if (!record?.encrypted) {
    return record;
  }
  const enc = record.encrypted;

  // Handle GCM encryption format (from storage service)
  if (enc.tag) {
    const salt = Buffer.from(enc.salt, 'hex');
    const iv = Buffer.from(enc.iv, 'hex');
    const tag = Buffer.from(enc.tag, 'hex');
    const key = crypto.pbkdf2Sync(
      process.env.ENCRYPTION_KEY || 'default-master-secret-change-in-production',
      salt,
      100000,
      32,
      'sha256'
    );

    const decipher = crypto.createDecipheriv(
      enc.algorithm || 'aes-256-gcm',
      key,
      iv
    );
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(enc.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Fallback to legacy CBC format
  const encryptedData = enc.encryptedData || enc.encrypted || enc;
  const salt = enc.salt || 'default-salt';
  const iv = enc.iv || 'default-iv';
  const algorithm = enc.algorithm || 'aes-256-cbc';

  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', salt, 32);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

// Helper function to decrypt released data
const decryptReleased = (releasedData) => {
  if (!releasedData?.encryptedPackage) {
    return releasedData;
  }
  const enc = releasedData.encryptedPackage;

  // Check if this is hierarchical encryption (GCM with authTag) or simple encryption (CBC)
  const isGCM = enc.authTag && enc.encryptedDEK;

  if (isGCM) {
    // Use the crypto service's decrypt function for hierarchical encryption
    return cryptoService.decrypt(enc);
  }

  // Simple CBC encryption (raw datasets)
  const encryptedData = enc.encryptedData || enc.encrypted || enc;
  const salt = enc.salt || 'default-salt';
  const iv = enc.iv || 'default-iv';
  const algorithm = enc.algorithm || 'aes-256-cbc';

  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', salt, 32);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

// Enhanced classification with risk assessment
app.post('/api/classification/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { datasetId } = req.params;

    // Retrieve from store and decrypt
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const data = decryptRecord(record);

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
    console.error('Classification error:', error);
    res.status(500).json({ error: error.message });
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
    const data = decryptRecord(record);

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
    console.error('Risk assessment error:', error);
    res.status(500).json({ error: error.message });
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
    const data = decryptRecord(record);
    const classification = classificationService.classifyDataset(data);

    const result = anonymizationEngine.checkKAnonymity(
      data,
      classification.summary.quasiIdentifiers,
      k
    );

    res.json({ success: true, datasetId, k, ...result });
  } catch (error) {
    console.error('K-anonymity check error:', error);
    res.status(500).json({ error: error.message });
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
    const data = decryptRecord(record);

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
    const data = decryptRecord(record);
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

// Enhanced release pipeline with governance integration
app.post('/api/release/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    let { consentId, k = 5, l = 2, mode = 'enhanced' } = req.body;

    // Auto-generate demo consent if none provided (for demo purposes)
    const isDemoMode = !consentId;
    if (!consentId) {
      consentId = `demo-consent-${Date.now()}`;
      console.log(`[DEMO MODE] Auto-generated consent ID: ${consentId}`);
    }

    // Validate mode
    if (!['baseline', 'enhanced'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be "baseline" or "enhanced"' });
    }

    // Skip consent validation in demo mode
    let consentCheck = null;
    if (!isDemoMode) {
      consentCheck = consentEngine.isConsentValid(consentId);
      if (!consentCheck.valid) {
        return res.status(403).json({ error: consentCheck.reason });
      }
    } else {
      // Create mock consent check for demo mode
      consentCheck = {
        valid: true,
        consent: {
          researcherId: 'demo-user',
          purpose: 'Demo Release'
        }
      };
    }

    // Retrieve and decrypt raw data
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const rawData = decryptRecord(record);

    // Execute pipeline (skip consent validation in demo mode)
    const result = await releasePipeline.execute(datasetId, rawData, consentId, {
      k,
      l,
      maxRiskLevel: 'Medium',
      skipConsentValidation: isDemoMode
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        stagesCompleted: result.stagesCompleted
      });
    }

    // Run governance pipeline after release
    let governanceResult = null;
    try {
      const { classificationService } = await import('./classification/index.js');
      const classification = classificationService.classifyDataset(rawData);

      governanceResult = await governanceIntegration.executeGovernancePipeline(
        result.releaseId,
        datasetId,
        rawData,
        classification,
        {
          mode,
          k,
          l,
          consentId
        }
      );
    } catch (govError) {
      // Log but don't fail the release if governance fails
      console.error('Governance pipeline error:', govError.message);
    }

    auditService.logDataset(AUDIT_EVENTS.DATASET_RELEASED, req.user.userId, datasetId, {
      releaseId: result.releaseId,
      consentId,
      researcherId: consentCheck.consent.researcherId,
      riskScore: result.riskAssessment?.overallRisk,
      stagesCompleted: result.stagesCompleted,
      mode,
      governanceId: governanceResult?.governanceId
    });

    res.json({
      success: true,
      releaseId: result.releaseId,
      executionId: result.executionId,
      riskAssessment: result.riskAssessment,
      stagesCompleted: result.stagesCompleted,
      recordCount: result.recordCount,
      mode,
      governance: governanceResult ? {
        governanceId: governanceResult.governanceId,
        summary: governanceResult.summary
      } : null
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
    const decryptedData = decryptReleased(releasedData);
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
    const decryptedData = decryptReleased(releasedData);
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
    const decryptedData = decryptReleased(releasedData);
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
    const decryptedData = decryptReleased(releasedData);
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
    const decryptedData = decryptReleased(releasedData);
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
// GOVERNANCE & REPORTING ROUTES
// ==========================================

// Get privacy-utility report by release ID
app.get('/api/report/privacy-utility/:releaseId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res) => {
  try {
    const { releaseId } = req.params;

    // Get governance results for this release
    const governanceData = governanceIntegration.getGovernanceByRelease(releaseId);

    if (!governanceData || governanceData.length === 0) {
      return res.status(404).json({
        error: 'No governance data found for this release',
        message: 'Governance pipeline may not have run for this release'
      });
    }

    // Get full governance result
    const latestGovernance = governanceData[0];
    const fullResult = governanceIntegration.getGovernanceResult(latestGovernance.governanceId);

    // Get the privacy-utility report if available
    let report = null;
    if (fullResult?.stages) {
      const reportStage = fullResult.stages.find(s => s.stage === 'privacy_utility_report' && s.status === 'completed');
      if (reportStage?.reportId) {
        report = privacyUtilityReport.getReport(reportStage.reportId);
      }
    }

    res.json({
      success: true,
      releaseId,
      governanceId: latestGovernance.governanceId,
      timestamp: latestGovernance.timestamp,
      report: report || 'Report not available',
      summary: latestGovernance.summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get benchmark comparison by dataset ID
app.get('/api/report/benchmark/:datasetId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res) => {
  try {
    const { datasetId } = req.params;

    // Get benchmarks for this dataset
    const benchmarks = baselineAnonymizer.listBenchmarks(datasetId);

    res.json({
      success: true,
      datasetId,
      benchmarkCount: benchmarks.length,
      benchmarks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run new benchmark comparison
app.post('/api/benchmark/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { k = 5, l = 2 } = req.body;

    // Retrieve raw data
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const rawData = decryptRecord(record);

    // Run benchmark
    const benchmark = await baselineAnonymizer.runBenchmark(datasetId, rawData, { k, l });

    // Audit
    auditChainService.log(AUDIT_EVENTS.DATASET_RELEASED, req.user.userId, {
      datasetId,
      benchmarkId: benchmark.benchmarkId,
      comparison: benchmark.comparison
    });

    res.json({
      success: true,
      benchmarkId: benchmark.benchmarkId,
      comparison: benchmark.comparison,
      modes: {
        baseline: {
          riskScore: benchmark.modes.baseline.riskAssessment.overallRisk,
          riskLevel: benchmark.modes.baseline.riskAssessment.riskLevel,
          utilityLoss: benchmark.modes.baseline.utilityLossPercent
        },
        enhanced: {
          riskScore: benchmark.modes.enhanced.riskAssessment.overallRisk,
          riskLevel: benchmark.modes.enhanced.riskAssessment.riskLevel,
          utilityLoss: benchmark.modes.enhanced.utilityLossPercent
        }
      },
      winner: benchmark.comparison.winner
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get DPDP compliance map
app.get('/api/compliance/dpdp', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  try {
    const complianceMap = dpdpCompliance.getComplianceMap();

    res.json({
      success: true,
      compliance: complianceMap
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific DPDP principle compliance
app.get('/api/compliance/dpdp/:principle', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  try {
    let { principle } = req.params;

    // Convert snake_case to camelCase (e.g., purpose_limitation -> purposeLimitation)
    principle = principle.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    const principleCompliance = dpdpCompliance.getPrincipleCompliance(principle);

    if (!principleCompliance) {
      return res.status(404).json({
        error: 'Principle not found',
        requestedPrinciple: req.params.principle,
        normalizedPrinciple: principle,
        availablePrinciples: Object.keys(dpdpCompliance.DPDP_COMPLIANCE_MAP)
      });
    }

    res.json({
      success: true,
      principle: principleCompliance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get compliance summary/certificate
app.get('/api/compliance/summary', verifyJWT, requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const summary = dpdpCompliance.generateComplianceSummary();

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run attack simulation on a release
app.post('/api/attack-simulation/:releaseId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), async (req, res) => {
  try {
    const { releaseId } = req.params;

    // Retrieve released data
    const releasedData = storageService.retrieveReleased(releaseId);
    const decryptedData = decryptReleased(releasedData);
    const dataset = decryptedData.data;

    // Get classification
    const classification = classificationService.classifyDataset(dataset);

    // Run attack simulation
    const attackResult = attackSimulation.runAllAttacks(dataset, null, classification);

    res.json({
      success: true,
      releaseId,
      attackId: attackResult.attackId,
      summary: attackResult.summary,
      attacks: attackResult.attacks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attack simulation result
app.get('/api/attack-simulation/result/:attackId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  try {
    const { attackId } = req.params;
    const result = attackSimulation.getAttackResult(attackId);

    if (!result) {
      return res.status(404).json({ error: 'Attack simulation result not found' });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate privacy-utility curve for dataset
app.post('/api/curve/:datasetId', verifyJWT, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { datasetId } = req.params;
    const { epsilons = [0.1, 0.5, 1.0] } = req.body;

    // Retrieve data
    const record = stores.raw.get(datasetId);
    if (!record) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const data = decryptRecord(record);
    const classification = classificationService.classifyDataset(data);

    // Generate curve
    const curve = await privacyUtilityCurve.generateCurve(datasetId, data, classification, { epsilons });

    res.json({
      success: true,
      curveId: curve.curveId,
      curve: curve.curve,
      optimal: curve.optimal,
      recommendation: curve.recommendation,
      summary: curve.summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get privacy-utility curve visualization data
app.get('/api/curve/visualization/:curveId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  try {
    const { curveId } = req.params;
    const vizData = privacyUtilityCurve.getCurveVisualizationData(curveId);

    if (!vizData) {
      return res.status(404).json({ error: 'Curve not found' });
    }

    res.json({
      success: true,
      visualization: vizData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get governance dashboard for release
app.get('/api/governance/dashboard/:releaseId', verifyJWT, requireRole(ROLES.ADMIN, ROLES.REVIEWER), (req, res) => {
  try {
    const { releaseId } = req.params;
    const dashboard = governanceIntegration.getGovernanceDashboard(releaseId);

    if (!dashboard) {
      return res.status(404).json({
        error: 'No governance data found',
        message: 'Governance pipeline may not have run for this release'
      });
    }

    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MISSING ROUTES FOR FRONTEND
// ==========================================

// Get overall risk summary
app.get('/api/risk/summary', verifyJWT, (req, res) => {
  try {
    // Calculate overall risk from all datasets
    const datasets = Array.from(stores.raw.values());
    let totalRisk = 0;
    let totalDatasets = datasets.length;

    if (totalDatasets === 0) {
      return res.json({
        overallScore: 0,
        trend: 'stable',
        datasets: 0,
        highRiskDatasets: 0,
        mediumRiskDatasets: 0,
        lowRiskDatasets: 0
      });
    }

    let highRisk = 0, mediumRisk = 0, lowRisk = 0;

    datasets.forEach(record => {
      try {
        const data = decryptRecord(record);
        const classification = classificationService.classifyDataset(data);
        const risk = riskEngine.calculateRiskScore(data, classification);
        totalRisk += risk.overall;

        if (risk.overall > 60) highRisk++;
        else if (risk.overall > 30) mediumRisk++;
        else lowRisk++;
      } catch (e) {
        // Skip datasets that can't be processed
      }
    });

    const overallScore = Math.round(totalRisk / totalDatasets);
    const trend = 'stable'; // Would calculate from historical data

    res.json({
      overallScore,
      trend,
      datasets: totalDatasets,
      highRiskDatasets: highRisk,
      mediumRiskDatasets: mediumRisk,
      lowRiskDatasets: lowRisk
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get DP budget
app.get('/api/dp/budget', verifyJWT, (req, res) => {
  try {
    const budget = dpEngine.getBudgetStatus();
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attack simulation status
app.get('/api/attack-simulation/status', verifyJWT, (req, res) => {
  try {
    const status = attackSimulation.getAttackSurfaceStatus();
    res.json(status);
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






