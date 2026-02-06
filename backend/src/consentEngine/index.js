import { v4 as uuidv4 } from 'uuid';
import { auditService, AUDIT_EVENTS } from '../audit/index.js';

/**
 * Purpose-Bound Consent Engine
 * 
 * Enforces strict purpose limitation and field-level access control.
 * Each consent is bound to:
 * - Specific purpose (must match query purpose exactly)
 * - Specific fields (subset allowed)
 * - Time limit (expiry date)
 * - Risk threshold
 * 
 * Consent Lifecycle:
 * pending → approved → active → expired/revoked
 */

// Consent status enum
export const CONSENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  SUSPENDED: 'suspended'
};

// Valid purposes (extensible)
export const VALID_PURPOSES = {
  RESEARCH: 'research',
  STATISTICAL_ANALYSIS: 'statistical_analysis',
  PUBLIC_HEALTH: 'public_health',
  POLICY_EVALUATION: 'policy_evaluation',
  AUDIT: 'audit',
  QUALITY_IMPROVEMENT: 'quality_improvement'
};

// Consent storage
const consents = new Map();
const releaseConsentBindings = new Map();  // releaseId -> consentId

/**
 * Validate purpose
 */
const validatePurpose = (purpose) => {
  if (!purpose || typeof purpose !== 'string') {
    return { valid: false, error: 'Purpose must be a non-empty string' };
  }
  
  const validPurposes = Object.values(VALID_PURPOSES);
  if (!validPurposes.includes(purpose)) {
    return {
      valid: false,
      error: `Invalid purpose. Valid purposes: ${validPurposes.join(', ')}`
    };
  }
  
  return { valid: true };
};

/**
 * Validate field list
 */
const validateFields = (fields, availableFields = null) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { valid: false, error: 'At least one field must be specified' };
  }
  
  // Check for duplicates
  const uniqueFields = [...new Set(fields)];
  if (uniqueFields.length !== fields.length) {
    return { valid: false, error: 'Duplicate fields not allowed' };
  }
  
  // Check against available fields if provided
  if (availableFields) {
    const invalidFields = fields.filter(f => !availableFields.includes(f));
    if (invalidFields.length > 0) {
      return {
        valid: false,
        error: `Invalid fields: ${invalidFields.join(', ')}`
      };
    }
  }
  
  return { valid: true, fields: uniqueFields };
};

/**
 * Calculate expiry date
 */
const calculateExpiry = (requestedExpiry = null, defaultDays = 30) => {
  if (requestedExpiry) {
    const expiry = new Date(requestedExpiry);
    if (isNaN(expiry.getTime())) {
      throw new Error('Invalid expiry date');
    }
    return expiry.toISOString();
  }
  
  // Default: 30 days from now
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + defaultDays);
  return expiry.toISOString();
};

/**
 * Request new consent
 */
const requestConsent = async (researcherId, purpose, allowedFields, options = {}) => {
  // Validate inputs
  if (!researcherId) {
    throw new Error('Researcher ID is required');
  }
  
  const purposeValidation = validatePurpose(purpose);
  if (!purposeValidation.valid) {
    throw new Error(purposeValidation.error);
  }
  
  const fieldValidation = validateFields(allowedFields, options.availableFields);
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error);
  }
  
  // Calculate expiry
  const expiryDate = calculateExpiry(options.expiryDate, options.defaultDays);
  
  // Check expiry is in the future
  if (new Date(expiryDate) <= new Date()) {
    throw new Error('Expiry date must be in the future');
  }
  
  const consent = {
    id: uuidv4(),
    researcherId,
    purpose,
    allowedFields: fieldValidation.fields,
    datasetId: options.datasetId || null,
    expiryDate,
    status: CONSENT_STATUS.PENDING,
    
    // Risk assessment
    maxRiskLevel: options.maxRiskLevel || 'Medium',
    riskScore: null,
    
    // Metadata
    requestedAt: new Date().toISOString(),
    requestedBy: researcherId,
    
    // Approval metadata (populated later)
    approvedAt: null,
    approvedBy: null,
    approvalNotes: null,
    
    // Rejection metadata
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    
    // Revocation metadata
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    
    // Usage tracking
    accessCount: 0,
    lastAccessed: null,
    queryCount: 0,
    
    // Additional constraints
    constraints: {
      allowAggregatesOnly: options.aggregatesOnly !== false,  // Default true
      allowRawData: options.allowRawData === true,  // Default false
      dpEpsilon: options.dpEpsilon || 1.0,
      requireAnonymization: options.requireAnonymization !== false  // Default true
    }
  };
  
  consents.set(consent.id, consent);
  
  auditService.logConsent(AUDIT_EVENTS.CONSENT_REQUESTED, researcherId, consent.id, {
    purpose,
    allowedFields: fieldValidation.fields,
    datasetId: options.datasetId,
    expiryDate
  });
  
  return consent;
};

/**
 * Approve consent
 */
const approveConsent = async (consentId, approverId, options = {}) => {
  const consent = consents.get(consentId);
  
  if (!consent) {
    throw new Error('Consent not found');
  }
  
  if (consent.status !== CONSENT_STATUS.PENDING) {
    throw new Error(`Cannot approve consent with status: ${consent.status}`);
  }
  
  // Validate risk score if provided
  if (options.riskScore !== undefined) {
    if (typeof options.riskScore !== 'number' || options.riskScore < 0 || options.riskScore > 100) {
      throw new Error('Risk score must be a number between 0 and 100');
    }
    consent.riskScore = options.riskScore;
  }
  
  consent.status = CONSENT_STATUS.APPROVED;
  consent.approvedAt = new Date().toISOString();
  consent.approvedBy = approverId;
  consent.approvalNotes = options.notes || null;
  
  // Update constraints if provided
  if (options.constraints) {
    consent.constraints = { ...consent.constraints, ...options.constraints };
  }
  
  consents.set(consentId, consent);
  
  auditService.logConsent(AUDIT_EVENTS.CONSENT_APPROVED, approverId, consentId, {
    researcherId: consent.researcherId,
    riskScore: consent.riskScore,
    notes: options.notes
  });
  
  return consent;
};

/**
 * Reject consent
 */
const rejectConsent = async (consentId, rejectorId, reason) => {
  if (!reason || reason.trim().length < 10) {
    throw new Error('Rejection reason must be at least 10 characters');
  }
  
  const consent = consents.get(consentId);
  
  if (!consent) {
    throw new Error('Consent not found');
  }
  
  if (consent.status !== CONSENT_STATUS.PENDING) {
    throw new Error(`Cannot reject consent with status: ${consent.status}`);
  }
  
  consent.status = CONSENT_STATUS.REJECTED;
  consent.rejectedAt = new Date().toISOString();
  consent.rejectedBy = rejectorId;
  consent.rejectionReason = reason;
  
  consents.set(consentId, consent);
  
  auditService.logConsent(AUDIT_EVENTS.CONSENT_REJECTED, rejectorId, consentId, {
    researcherId: consent.researcherId,
    reason
  });
  
  return consent;
};

/**
 * Revoke consent
 */
const revokeConsent = async (consentId, revokerId, reason) => {
  if (!reason || reason.trim().length < 10) {
    throw new Error('Revocation reason must be at least 10 characters');
  }
  
  const consent = consents.get(consentId);
  
  if (!consent) {
    throw new Error('Consent not found');
  }
  
  if (![CONSENT_STATUS.APPROVED, CONSENT_STATUS.ACTIVE].includes(consent.status)) {
    throw new Error(`Cannot revoke consent with status: ${consent.status}`);
  }
  
  consent.status = CONSENT_STATUS.REVOKED;
  consent.revokedAt = new Date().toISOString();
  consent.revokedBy = revokerId;
  consent.revocationReason = reason;
  
  consents.set(consentId, consent);
  
  auditService.logConsent(AUDIT_EVENTS.CONSENT_REVOKED, revokerId, consentId, {
    researcherId: consent.researcherId,
    reason
  });
  
  return consent;
};

/**
 * Check if consent is valid
 */
const isConsentValid = (consentId) => {
  const consent = consents.get(consentId);
  
  if (!consent) {
    return { valid: false, reason: 'Consent not found' };
  }
  
  // Check status
  if (consent.status !== CONSENT_STATUS.APPROVED && consent.status !== CONSENT_STATUS.ACTIVE) {
    return { valid: false, reason: `Consent status is ${consent.status}` };
  }
  
  // Check expiry
  const now = new Date();
  const expiry = new Date(consent.expiryDate);
  
  if (now > expiry) {
    consent.status = CONSENT_STATUS.EXPIRED;
    consents.set(consentId, consent);
    
    auditService.logConsent(AUDIT_EVENTS.CONSENT_EXPIRED, consent.researcherId, consentId, {
      expiryDate: consent.expiryDate
    });
    
    return { valid: false, reason: 'Consent has expired' };
  }
  
  // Activate if approved
  if (consent.status === CONSENT_STATUS.APPROVED) {
    consent.status = CONSENT_STATUS.ACTIVE;
    consent.activatedAt = now.toISOString();
    consents.set(consentId, consent);
  }
  
  return { valid: true, consent };
};

/**
 * Validate access request against consent
 * Enforces purpose binding and field restrictions
 */
const validateAccess = (consentId, accessRequest) => {
  // Check consent validity
  const validityResult = isConsentValid(consentId);
  if (!validityResult.valid) {
    return validityResult;
  }
  
  const consent = validityResult.consent;
  
  // Validate purpose binding
  if (accessRequest.purpose && accessRequest.purpose !== consent.purpose) {
    return {
      valid: false,
      reason: `Purpose mismatch. Query purpose '${accessRequest.purpose}' does not match consent purpose '${consent.purpose}'`
    };
  }
  
  // Validate requested fields
  if (accessRequest.fields) {
    const requestedFields = Array.isArray(accessRequest.fields) 
      ? accessRequest.fields 
      : [accessRequest.fields];
    
    const unauthorizedFields = requestedFields.filter(
      field => !consent.allowedFields.includes(field)
    );
    
    if (unauthorizedFields.length > 0) {
      return {
        valid: false,
        reason: `Access denied for fields: ${unauthorizedFields.join(', ')}`,
        allowedFields: consent.allowedFields,
        unauthorizedFields
      };
    }
  }
  
  // Check aggregate-only constraint
  if (consent.constraints.allowAggregatesOnly && accessRequest.rawData) {
    return {
      valid: false,
      reason: 'This consent only allows aggregate queries, not raw data access'
    };
  }
  
  // Check DP epsilon constraint
  if (accessRequest.epsilon && accessRequest.epsilon > consent.constraints.dpEpsilon) {
    return {
      valid: false,
      reason: `Epsilon ${accessRequest.epsilon} exceeds consent limit of ${consent.constraints.dpEpsilon}`,
      maxEpsilon: consent.constraints.dpEpsilon
    };
  }
  
  // Track access
  consent.accessCount++;
  consent.lastAccessed = new Date().toISOString();
  if (accessRequest.query) {
    consent.queryCount++;
  }
  consents.set(consentId, consent);
  
  return {
    valid: true,
    consent,
    allowedFields: consent.allowedFields,
    constraints: consent.constraints
  };
};

/**
 * Bind release to consent
 */
const bindReleaseToConsent = (releaseId, consentId) => {
  const validityResult = isConsentValid(consentId);
  if (!validityResult.valid) {
    throw new Error(`Cannot bind release: ${validityResult.reason}`);
  }
  
  releaseConsentBindings.set(releaseId, consentId);
  
  auditService.log(AUDIT_EVENTS.RELEASE_BOUND, validityResult.consent.researcherId, {
    releaseId,
    consentId
  });
  
  return { releaseId, consentId, bound: true };
};

/**
 * Get consent for a release
 */
const getConsentForRelease = (releaseId) => {
  const consentId = releaseConsentBindings.get(releaseId);
  if (!consentId) {
    return null;
  }
  
  return consents.get(consentId) || null;
};

/**
 * Get consent by ID
 */
const getConsent = (consentId) => {
  return consents.get(consentId) || null;
};

/**
 * Get consents by researcher
 */
const getConsentsByResearcher = (researcherId, status = null) => {
  let researcherConsents = Array.from(consents.values())
    .filter(c => c.researcherId === researcherId);
  
  if (status) {
    researcherConsents = researcherConsents.filter(c => c.status === status);
  }
  
  return researcherConsents.sort((a, b) => 
    new Date(b.requestedAt) - new Date(a.requestedAt)
  );
};

/**
 * Get consents by dataset
 */
const getConsentsByDataset = (datasetId) => {
  return Array.from(consents.values())
    .filter(c => c.datasetId === datasetId)
    .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
};

/**
 * List all consents (admin)
 */
const listAllConsents = (filters = {}) => {
  let allConsents = Array.from(consents.values());
  
  if (filters.status) {
    allConsents = allConsents.filter(c => c.status === filters.status);
  }
  
  if (filters.researcherId) {
    allConsents = allConsents.filter(c => c.researcherId === filters.researcherId);
  }
  
  if (filters.datasetId) {
    allConsents = allConsents.filter(c => c.datasetId === filters.datasetId);
  }
  
  return allConsents.sort((a, b) => 
    new Date(b.requestedAt) - new Date(a.requestedAt)
  );
};

/**
 * Get pending consents
 */
const getPendingConsents = () => {
  return Array.from(consents.values())
    .filter(c => c.status === CONSENT_STATUS.PENDING)
    .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
};

/**
 * Get consent statistics
 */
const getStatistics = () => {
  const allConsents = Array.from(consents.values());
  
  return {
    total: allConsents.length,
    byStatus: {
      pending: allConsents.filter(c => c.status === CONSENT_STATUS.PENDING).length,
      approved: allConsents.filter(c => c.status === CONSENT_STATUS.APPROVED).length,
      active: allConsents.filter(c => c.status === CONSENT_STATUS.ACTIVE).length,
      rejected: allConsents.filter(c => c.status === CONSENT_STATUS.REJECTED).length,
      expired: allConsents.filter(c => c.status === CONSENT_STATUS.EXPIRED).length,
      revoked: allConsents.filter(c => c.status === CONSENT_STATUS.REVOKED).length
    },
    totalAccesses: allConsents.reduce((sum, c) => sum + c.accessCount, 0),
    totalQueries: allConsents.reduce((sum, c) => sum + c.queryCount, 0),
    activeConsentsExpiringSoon: allConsents.filter(c => {
      if (c.status !== CONSENT_STATUS.ACTIVE) return false;
      const daysUntilExpiry = (new Date(c.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    }).length
  };
};

/**
 * Consent Engine interface
 */
export const consentEngine = {
  // Core operations
  requestConsent,
  approveConsent,
  rejectConsent,
  revokeConsent,
  
  // Validation
  isConsentValid,
  validateAccess,
  validatePurpose,
  validateFields,
  
  // Binding
  bindReleaseToConsent,
  getConsentForRelease,
  
  // Retrieval
  getConsent,
  getConsentsByResearcher,
  getConsentsByDataset,
  listAllConsents,
  getPendingConsents,
  
  // Statistics
  getStatistics,
  
  // Constants
  CONSENT_STATUS,
  VALID_PURPOSES
};

export {
  requestConsent,
  approveConsent,
  rejectConsent,
  revokeConsent,
  isConsentValid,
  validateAccess,
  validatePurpose,
  validateFields,
  bindReleaseToConsent,
  getConsentForRelease
};
