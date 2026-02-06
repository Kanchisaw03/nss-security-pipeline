import crypto from 'crypto';
import { classificationService, CLASSIFICATION_TYPES } from '../classification/index.js';

/**
 * Anonymization Layer
 * 
 * Multi-layer transformation pipeline:
 * 1. Suppression (remove direct identifiers)
 * 2. Generalization (exact → range)
 * 3. Hash/tokenization
 * 4. Noise injection (for numeric values)
 * 
 * Depends on:
 * - Classification metadata
 * - Consent.allowedFields
 */

// Anonymization configuration
const ANON_CONFIG = {
  // Generalization bins
  ageBins: [
    { min: 0, max: 17, label: '0-17' },
    { min: 18, max: 30, label: '18-30' },
    { min: 31, max: 45, label: '31-45' },
    { min: 46, max: 60, label: '46-60' },
    { min: 61, max: 999, label: '60+' }
  ],
  
  incomeBins: [
    { min: 0, max: 25000, label: 'low' },
    { min: 25001, max: 75000, label: 'medium' },
    { min: 75001, max: 150000, label: 'high' },
    { min: 150001, max: 999999999, label: 'very_high' }
  ],
  
  // Noise injection (standard deviation as % of value)
  noiseLevel: 0.05, // 5% noise
  
  // Hash algorithm
  hashAlgorithm: 'sha256',
  
  // Suppression marker
  suppressionMarker: '[REDACTED]'
};

/**
 * Hash/tokenize a value
 */
const hashValue = (value, salt = '') => {
  if (value === null || value === undefined) return null;
  
  const strValue = String(value);
  const hash = crypto
    .createHmac(ANON_CONFIG.hashAlgorithm, salt || process.env.HASH_SECRET || 'default-salt')
    .update(strValue)
    .digest('hex')
    .substring(0, 16); // Truncate for readability
  
  return `HASH:${hash}`;
};

/**
 * Generalize numeric value to range
 */
const generalizeNumeric = (value, bins) => {
  if (value === null || value === undefined) return null;
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  const bin = bins.find(b => numValue >= b.min && numValue <= b.max);
  return bin ? bin.label : String(value);
};

/**
 * Inject laplacian noise into numeric value
 */
const injectNoise = (value, epsilon = 1.0) => {
  if (value === null || value === undefined) return null;
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  // Generate Laplacian noise
  const u = Math.random() - 0.5;
  const noise = -Math.sign(u) * ANON_CONFIG.noiseLevel * numValue * Math.log(1 - 2 * Math.abs(u));
  
  return Math.round((numValue + noise) * 100) / 100; // Round to 2 decimals
};

/**
 * Suppress value
 */
const suppressValue = () => ANON_CONFIG.suppressionMarker;

/**
 * Anonymization strategies
 */
const ANONYMIZATION_STRATEGIES = {
  [CLASSIFICATION_TYPES.DIRECT]: {
    default: 'suppress',
    options: ['suppress', 'hash']
  },
  [CLASSIFICATION_TYPES.QUASI]: {
    default: 'generalize',
    options: ['suppress', 'generalize', 'hash']
  },
  [CLASSIFICATION_TYPES.SENSITIVE]: {
    default: 'noise',
    options: ['suppress', 'generalize', 'noise']
  },
  [CLASSIFICATION_TYPES.NON_SENSITIVE]: {
    default: 'keep',
    options: ['keep', 'suppress']
  }
};

/**
 * Apply anonymization to a single field
 */
const anonymizeField = (value, fieldName, fieldType, strategy = null) => {
  const effectiveStrategy = strategy || ANONYMIZATION_STRATEGIES[fieldType]?.default || 'keep';
  
  switch (effectiveStrategy) {
    case 'suppress':
      return suppressValue();
    
    case 'hash':
      return hashValue(value, fieldName);
    
    case 'generalize':
      // Check for specific field types
      if (fieldName.toLowerCase().includes('age')) {
        return generalizeNumeric(value, ANON_CONFIG.ageBins);
      }
      if (fieldName.toLowerCase().includes('income') || fieldName.toLowerCase().includes('salary')) {
        return generalizeNumeric(value, ANON_CONFIG.incomeBins);
      }
      // Default: return original (could be enhanced with more bin types)
      return value;
    
    case 'noise':
      return injectNoise(value);
    
    case 'keep':
    default:
      return value;
  }
};

/**
 * Anonymization service
 */
export const anonymizationService = {
  /**
   * Anonymize dataset based on classification and consent
   */
  anonymizeDataset: (data, classification, allowedFields = null, customStrategies = {}) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid dataset');
    }
    
    if (!classification || !classification.fields) {
      throw new Error('Classification metadata required');
    }
    
    const anonymized = data.map((record, index) => {
      const anonymizedRecord = {};
      
      Object.entries(record).forEach(([fieldName, value]) => {
        // Check if field is allowed by consent
        if (allowedFields && !allowedFields.includes(fieldName)) {
          // Field not in consent - suppress entirely
          anonymizedRecord[fieldName] = suppressValue();
          return;
        }
        
        const fieldType = classification.fields[fieldName]?.type || CLASSIFICATION_TYPES.NON_SENSITIVE;
        const customStrategy = customStrategies[fieldName];
        
        anonymizedRecord[fieldName] = anonymizeField(value, fieldName, fieldType, customStrategy);
      });
      
      // Add anonymization metadata to first record
      if (index === 0) {
        anonymizedRecord._anonymizationMeta = {
          anonymizedAt: new Date().toISOString(),
          appliedStrategies: Object.keys(classification.fields).reduce((acc, field) => {
            const type = classification.fields[field]?.type;
            acc[field] = customStrategies[field] || ANONYMIZATION_STRATEGIES[type]?.default || 'keep';
            return acc;
          }, {})
        };
      }
      
      return anonymizedRecord;
    });
    
    return anonymized;
  },
  
  /**
   * Apply k-anonymity check
   */
  checkKAnonymity: (data, quasiIdentifierFields, k = 5) => {
    const groups = {};
    
    data.forEach(record => {
      const key = quasiIdentifierFields
        .map(field => String(record[field] || ''))
        .join('|');
      
      groups[key] = (groups[key] || 0) + 1;
    });
    
    const violations = Object.entries(groups)
      .filter(([_, count]) => count < k)
      .map(([key, count]) => ({
        quasiIdentifierValues: key.split('|'),
        count,
        required: k
      }));
    
    return {
      k,
      totalGroups: Object.keys(groups).length,
      violatingGroups: violations.length,
      complianceRate: ((Object.keys(groups).length - violations.length) / Object.keys(groups).length * 100).toFixed(2),
      violations,
      compliant: violations.length === 0
    };
  },
  
  /**
   * Apply l-diversity check for sensitive attributes
   */
  checkLDiversity: (data, quasiIdentifierFields, sensitiveField, l = 2) => {
    const groups = {};
    
    data.forEach(record => {
      const key = quasiIdentifierFields
        .map(field => String(record[field] || ''))
        .join('|');
      
      if (!groups[key]) {
        groups[key] = new Set();
      }
      groups[key].add(record[sensitiveField]);
    });
    
    const violations = Object.entries(groups)
      .filter(([_, values]) => values.size < l)
      .map(([key, values]) => ({
        quasiIdentifierValues: key.split('|'),
        distinctSensitiveValues: Array.from(values),
        count: values.size,
        required: l
      }));
    
    return {
      l,
      sensitiveField,
      totalGroups: Object.keys(groups).length,
      violatingGroups: violations.length,
      compliant: violations.length === 0,
      violations
    };
  },
  
  /**
   * Get available strategies for field type
   */
  getStrategies: (fieldType) => {
    return ANONYMIZATION_STRATEGIES[fieldType] || ANONYMIZATION_STRATEGIES[CLASSIFICATION_TYPES.NON_SENSITIVE];
  },
  
  ANON_CONFIG,
  CLASSIFICATION_TYPES
};

export { hashValue, generalizeNumeric, injectNoise, suppressValue };
