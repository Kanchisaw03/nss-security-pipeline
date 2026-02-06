/**
 * Data Models
 * 
 * Type definitions and validation schemas for the platform
 */

// User Roles
export const UserRole = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  REVIEWER: 'reviewer'
};

// Consent Status
export const ConsentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

// Classification Types
export const ClassificationType = {
  DIRECT_IDENTIFIER: 'direct_identifier',
  QUASI_IDENTIFIER: 'quasi_identifier',
  SENSITIVE_ATTRIBUTE: 'sensitive_attribute',
  NON_SENSITIVE: 'non_sensitive'
};

// Dataset Status
export const DatasetStatus = {
  RAW: 'raw',
  CLASSIFIED: 'classified',
  ANONYMIZED: 'anonymized',
  RELEASED: 'released',
  REVOKED: 'revoked'
};

// Risk Level
export const RiskLevel = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};

/**
 * User Model
 */
export class User {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.role = data.role;
    this.purposeScope = data.purposeScope || [];
    this.createdAt = data.createdAt;
  }
  
  hasPermission(permission) {
    const permissions = {
      [UserRole.ADMIN]: ['ingest', 'classify', 'anonymize', 'release', 'approve_consent', 'view_audit', 'view_risk'],
      [UserRole.RESEARCHER]: ['request_consent', 'view_released', 'query_data'],
      [UserRole.REVIEWER]: ['view_consent', 'approve_consent', 'view_risk']
    };
    
    return permissions[this.role]?.includes(permission) || false;
  }
  
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      role: this.role,
      purposeScope: this.purposeScope,
      createdAt: this.createdAt
    };
  }
}

/**
 * Consent Model
 */
export class Consent {
  constructor(data) {
    this.id = data.id;
    this.researcherId = data.researcherId;
    this.purpose = data.purpose;
    this.allowedFields = data.allowedFields || [];
    this.datasetId = data.datasetId || null;
    this.expiryDate = data.expiryDate;
    this.riskScore = data.riskScore || null;
    this.status = data.status || ConsentStatus.PENDING;
    this.requestedAt = data.requestedAt;
    this.approvedAt = data.approvedAt || null;
    this.approvedBy = data.approvedBy || null;
    this.rejectedAt = data.rejectedAt || null;
    this.rejectedBy = data.rejectedBy || null;
    this.rejectionReason = data.rejectionReason || null;
  }
  
  isValid() {
    if (this.status !== ConsentStatus.APPROVED) return false;
    
    const now = new Date();
    const expiry = new Date(this.expiryDate);
    return now <= expiry;
  }
  
  approve(approverId, riskScore) {
    this.status = ConsentStatus.APPROVED;
    this.approvedBy = approverId;
    this.approvedAt = new Date().toISOString();
    this.riskScore = riskScore;
    return this;
  }
  
  reject(rejectorId, reason) {
    this.status = ConsentStatus.REJECTED;
    this.rejectedBy = rejectorId;
    this.rejectedAt = new Date().toISOString();
    this.rejectionReason = reason;
    return this;
  }
  
  toJSON() {
    return {
      id: this.id,
      researcherId: this.researcherId,
      purpose: this.purpose,
      allowedFields: this.allowedFields,
      datasetId: this.datasetId,
      expiryDate: this.expiryDate,
      riskScore: this.riskScore,
      status: this.status,
      requestedAt: this.requestedAt,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      rejectedAt: this.rejectedAt,
      rejectedBy: this.rejectedBy,
      rejectionReason: this.rejectionReason
    };
  }
}

/**
 * Dataset Model
 */
export class Dataset {
  constructor(data) {
    this.id = data.id;
    this.type = data.type || 'json';
    this.status = data.status || DatasetStatus.RAW;
    this.metadata = data.metadata || {};
    this.recordCount = data.metadata?.recordCount || 0;
    this.fieldCount = data.metadata?.fieldCount || 0;
    this.fields = data.metadata?.fields || [];
    this.classification = data.classification || null;
    this.anonymized = data.anonymized || false;
    this.released = data.released || false;
    this.createdAt = data.metadata?.storedAt || new Date().toISOString();
  }
  
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      metadata: this.metadata,
      recordCount: this.recordCount,
      fieldCount: this.fieldCount,
      fields: this.fields,
      classification: this.classification,
      anonymized: this.anonymized,
      released: this.released,
      createdAt: this.createdAt
    };
  }
}

/**
 * Audit Event Model
 */
export class AuditEvent {
  constructor(data) {
    this.id = data.id;
    this.timestamp = data.timestamp;
    this.eventType = data.eventType;
    this.userId = data.userId;
    this.details = data.details || {};
    this.ip = data.ip || null;
    this.userAgent = data.userAgent || null;
  }
  
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      eventType: this.eventType,
      userId: this.userId,
      details: this.details,
      ip: this.ip,
      userAgent: this.userAgent
    };
  }
}

/**
 * Risk Assessment Model
 */
export class RiskAssessment {
  constructor(data) {
    this.assessedAt = data.assessedAt;
    this.recordCount = data.recordCount;
    this.factors = data.factors || {};
    this.overallRisk = data.overallRisk;
    this.overallRiskScore = data.overallRiskScore;
    this.recommendations = data.recommendations || [];
  }
  
  toJSON() {
    return {
      assessedAt: this.assessedAt,
      recordCount: this.recordCount,
      factors: this.factors,
      overallRisk: this.overallRisk,
      overallRiskScore: this.overallRiskScore,
      recommendations: this.recommendations
    };
  }
}

/**
 * Query Model
 */
export class Query {
  constructor(data) {
    this.id = data.id;
    this.researcherId = data.researcherId;
    this.releaseId = data.releaseId;
    this.fields = data.fields || [];
    this.filters = data.filters || {};
    this.aggregate = data.aggregate || null;
    this.limit = data.limit || null;
    this.timestamp = data.timestamp;
    this.resultCount = data.resultCount || 0;
  }
  
  toJSON() {
    return {
      id: this.id,
      researcherId: this.researcherId,
      releaseId: this.releaseId,
      fields: this.fields,
      filters: this.filters,
      aggregate: this.aggregate,
      limit: this.limit,
      timestamp: this.timestamp,
      resultCount: this.resultCount
    };
  }
}

/**
 * Validation helpers
 */
export const validators = {
  isValidEmail: (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  
  isValidRole: (role) => {
    return Object.values(UserRole).includes(role);
  },
  
  isValidConsentStatus: (status) => {
    return Object.values(ConsentStatus).includes(status);
  },
  
  isValidRiskLevel: (level) => {
    return Object.values(RiskLevel).includes(level);
  }
};

export default {
  UserRole,
  ConsentStatus,
  ClassificationType,
  DatasetStatus,
  RiskLevel,
  User,
  Consent,
  Dataset,
  AuditEvent,
  RiskAssessment,
  Query,
  validators
};
