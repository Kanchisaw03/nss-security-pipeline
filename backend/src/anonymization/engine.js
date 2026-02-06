import crypto from 'crypto';
import { classificationService, CLASSIFICATION_TYPES } from '../classification/index.js';

/**
 * Multi-Layer Anonymization Engine
 * 
 * Implements privacy-preserving transformations:
 * 1. Direct Identifiers: Suppress or tokenize
 * 2. k-Anonymity: Ensure each record is indistinguishable from at least k-1 others
 * 3. l-Diversity: Ensure each group has at least l distinct sensitive values
 * 4. t-Closeness: Ensure group distribution is close to overall distribution
 * 
 * Hierarchical Generalization:
 * - Age: exact → decade → suppressed
 * - ZIP: 5-digit → 3-digit → suppressed
 * - Income: exact → Low/Medium/High → suppressed
 */

// Anonymization configuration
const ANON_CONFIG = {
  // k-Anonymity default
  K_DEFAULT: 5,
  
  // l-Diversity default
  L_DEFAULT: 2,
  
  // t-Closeness default (Earth Mover's Distance threshold)
  T_DEFAULT: 0.2,
  
  // Suppression marker
  SUPPRESSION_MARKER: '[REDACTED]',
  
  // Hierarchy levels for generalization
  HIERARCHY_LEVELS: {
    NONE: 0,      // No generalization
    LOW: 1,       // First level (e.g., decade)
    MEDIUM: 2,    // Second level (e.g., broader range)
    HIGH: 3,      // Third level (e.g., suppressed)
    SUPPRESS: 4   // Full suppression
  }
};

// Age generalization hierarchy
const AGE_HIERARCHY = {
  generalize: (age, level) => {
    const numAge = parseInt(age);
    if (isNaN(numAge)) return ANON_CONFIG.SUPPRESSION_MARKER;
    
    switch (level) {
      case 0: // Exact
        return numAge;
      case 1: // Decade
        const decade = Math.floor(numAge / 10) * 10;
        return `${decade}-${decade + 9}`;
      case 2: // Quarter century
        if (numAge < 25) return '0-24';
        if (numAge < 50) return '25-49';
        if (numAge < 75) return '50-74';
        return '75+';
      case 3: // Binary
        return numAge < 50 ? '<50' : '50+';
      default: // Suppress
        return ANON_CONFIG.SUPPRESSION_MARKER;
    }
  }
};

// ZIP code generalization hierarchy
const ZIP_HIERARCHY = {
  generalize: (zip, level) => {
    if (!zip) return ANON_CONFIG.SUPPRESSION_MARKER;
    const zipStr = String(zip).replace(/[^0-9]/g, '');
    
    switch (level) {
      case 0: // Full ZIP
        return zipStr;
      case 1: // 4-digit prefix
        return zipStr.substring(0, 4) + 'X';
      case 2: // 3-digit prefix
        return zipStr.substring(0, 3) + 'XX';
      case 3: // 2-digit prefix
        return zipStr.substring(0, 2) + 'XXX';
      default: // Suppress
        return ANON_CONFIG.SUPPRESSION_MARKER;
    }
  }
};

// Income generalization hierarchy
const INCOME_HIERARCHY = {
  generalize: (income, level) => {
    const numIncome = parseFloat(income);
    if (isNaN(numIncome)) return ANON_CONFIG.SUPPRESSION_MARKER;
    
    switch (level) {
      case 0: // Exact (rounded to nearest 1000)
        return Math.round(numIncome / 1000) * 1000;
      case 1: // Tens of thousands
        return `${Math.floor(numIncome / 10000) * 10000}-${Math.floor(numIncome / 10000) * 10000 + 9999}`;
      case 2: // Low/Medium/High
        if (numIncome < 40000) return 'Low';
        if (numIncome < 100000) return 'Medium';
        return 'High';
      case 3: // Binary
        return numIncome < 75000 ? 'BelowAvg' : 'AboveAvg';
      default: // Suppress
        return ANON_CONFIG.SUPPRESSION_MARKER;
    }
  }
};

// Field type to hierarchy mapping
const FIELD_HIERARCHIES = {
  'age': AGE_HIERARCHY,
  'zip': ZIP_HIERARCHY,
  'postal': ZIP_HIERARCHY,
  'income': INCOME_HIERARCHY,
  'salary': INCOME_HIERARCHY,
  'earnings': INCOME_HIERARCHY
};

/**
 * Get hierarchy for a field
 */
const getFieldHierarchy = (fieldName) => {
  const lowerField = fieldName.toLowerCase();
  for (const [key, hierarchy] of Object.entries(FIELD_HIERARCHIES)) {
    if (lowerField.includes(key)) {
      return hierarchy;
    }
  }
  return null;
};

/**
 * Generalize a field value based on its hierarchy
 */
const generalizeField = (value, fieldName, level) => {
  if (value === null || value === undefined) return ANON_CONFIG.SUPPRESSION_MARKER;
  
  const hierarchy = getFieldHierarchy(fieldName);
  if (hierarchy) {
    return hierarchy.generalize(value, level);
  }
  
  // Default generalization: truncate strings
  if (level >= 3) return ANON_CONFIG.SUPPRESSION_MARKER;
  if (typeof value === 'string' && level > 0) {
    const visibleChars = Math.max(1, Math.floor(value.length / (level + 1)));
    return value.substring(0, visibleChars) + '***';
  }
  
  return value;
};

/**
 * Tokenize a direct identifier
 * Uses HMAC for deterministic tokenization
 */
const tokenizeField = (value, fieldName) => {
  if (value === null || value === undefined) return null;
  
  const hashSecret = process.env.HASH_SECRET || 'default-secret-change-in-production';
  const hmac = crypto.createHmac('sha256', hashSecret);
  hmac.update(`${fieldName}:${String(value).toLowerCase().trim()}`);
  return `TKN_${hmac.digest('hex').substring(0, 16)}`;
};

/**
 * Suppress a field
 */
const suppressField = () => ANON_CONFIG.SUPPRESSION_MARKER;

/**
 * Create quasi-identifier key for a record
 */
const createQuasiKey = (record, quasiFields) => {
  return quasiFields
    .map(field => String(record[field] || ''))
    .join('|');
};

/**
 * Check k-anonymity compliance
 * Returns compliance status and violations
 */
const checkKAnonymity = (data, quasiFields, k = ANON_CONFIG.K_DEFAULT) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid dataset');
  }
  
  if (!quasiFields || quasiFields.length === 0) {
    return { compliant: true, k, violations: [], allGroups: [] };
  }
  
  const groups = {};
  
  data.forEach((record, index) => {
    const key = createQuasiKey(record, quasiFields);
    if (!groups[key]) {
      groups[key] = { count: 0, indices: [], values: quasiFields.map(f => record[f]) };
    }
    groups[key].count++;
    groups[key].indices.push(index);
  });
  
  const violations = Object.entries(groups)
    .filter(([_, group]) => group.count < k)
    .map(([key, group]) => ({
      quasiKey: key,
      quasiValues: group.values,
      count: group.count,
      recordIndices: group.indices,
      deficit: k - group.count
    }));
  
  const totalGroups = Object.keys(groups).length;
  const compliantGroups = totalGroups - violations.length;
  
  return {
    k,
    totalGroups,
    compliantGroups,
    violatingGroups: violations.length,
    complianceRate: totalGroups > 0 ? (compliantGroups / totalGroups * 100).toFixed(2) : 100,
    compliant: violations.length === 0,
    violations: violations.slice(0, 100), // Limit to first 100 for performance
    allGroups: Object.entries(groups).map(([key, group]) => ({
      quasiKey: key,
      count: group.count
    })).sort((a, b) => b.count - a.count)
  };
};

/**
 * Check l-diversity compliance
 * Ensures each quasi-group has at least l distinct sensitive values
 */
const checkLDiversity = (data, quasiFields, sensitiveFields, l = ANON_CONFIG.L_DEFAULT) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid dataset');
  }
  
  if (!quasiFields || quasiFields.length === 0 || !sensitiveFields || sensitiveFields.length === 0) {
    return { compliant: true, l, violations: [] };
  }
  
  const groups = {};
  
  data.forEach(record => {
    const key = createQuasiKey(record, quasiFields);
    if (!groups[key]) {
      groups[key] = { 
        sensitiveValues: {},
        totalCount: 0
      };
    }
    
    sensitiveFields.forEach(sensitiveField => {
      if (!groups[key].sensitiveValues[sensitiveField]) {
        groups[key].sensitiveValues[sensitiveField] = new Set();
      }
      groups[key].sensitiveValues[sensitiveField].add(record[sensitiveField]);
    });
    
    groups[key].totalCount++;
  });
  
  const violations = [];
  
  Object.entries(groups).forEach(([key, group]) => {
    sensitiveFields.forEach(sensitiveField => {
      const distinctValues = group.sensitiveValues[sensitiveField].size;
      if (distinctValues < l) {
        violations.push({
          quasiKey: key,
          sensitiveField,
          distinctValues,
          required: l,
          distinctValueList: Array.from(group.sensitiveValues[sensitiveField])
        });
      }
    });
  });
  
  return {
    l,
    totalGroups: Object.keys(groups).length,
    violatingGroups: violations.length,
    compliant: violations.length === 0,
    violations: violations.slice(0, 100)
  };
};

/**
 * Calculate distribution of values
 */
const calculateDistribution = (values) => {
  const counts = {};
  const total = values.length;
  
  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });
  
  const distribution = {};
  Object.entries(counts).forEach(([value, count]) => {
    distribution[value] = count / total;
  });
  
  return distribution;
};

/**
 * Calculate Earth Mover's Distance (simplified)
 * Measures distance between two probability distributions
 */
const calculateDistributionDistance = (dist1, dist2) => {
  const allKeys = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
  let distance = 0;
  
  allKeys.forEach(key => {
    const p1 = dist1[key] || 0;
    const p2 = dist2[key] || 0;
    distance += Math.abs(p1 - p2);
  });
  
  return distance / 2; // Normalize to [0, 1]
};

/**
 * Check t-closeness compliance
 * Ensures each group's sensitive distribution is within t of overall distribution
 */
const checkTCloseness = (data, quasiFields, sensitiveField, t = ANON_CONFIG.T_DEFAULT) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid dataset');
  }
  
  // Calculate overall distribution
  const allSensitiveValues = data.map(r => r[sensitiveField]);
  const overallDistribution = calculateDistribution(allSensitiveValues);
  
  // Group by quasi-identifiers
  const groups = {};
  data.forEach(record => {
    const key = createQuasiKey(record, quasiFields);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record[sensitiveField]);
  });
  
  const violations = [];
  
  Object.entries(groups).forEach(([key, values]) => {
    const groupDistribution = calculateDistribution(values);
    const distance = calculateDistributionDistance(groupDistribution, overallDistribution);
    
    if (distance > t) {
      violations.push({
        quasiKey: key,
        groupSize: values.length,
        distance: distance.toFixed(4),
        threshold: t,
        groupDistribution,
        overallDistribution
      });
    }
  });
  
  return {
    t,
    totalGroups: Object.keys(groups).length,
    violatingGroups: violations.length,
    compliant: violations.length === 0,
    violations: violations.slice(0, 50),
    overallDistribution
  };
};

/**
 * Apply generalization to achieve k-anonymity
 * Iteratively increases generalization levels until k-anonymity is achieved or max level reached
 */
const applyAnonymization = (data, classification, k = ANON_CONFIG.K_DEFAULT, l = ANON_CONFIG.L_DEFAULT) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid dataset');
  }
  
  if (!classification || !classification.fields) {
    throw new Error('Classification metadata required');
  }
  
  // Identify field types
  const directIdentifiers = [];
  const quasiIdentifiers = [];
  const sensitiveFields = [];
  
  Object.entries(classification.fields).forEach(([fieldName, fieldInfo]) => {
    switch (fieldInfo.type) {
      case CLASSIFICATION_TYPES.DIRECT:
        directIdentifiers.push(fieldName);
        break;
      case CLASSIFICATION_TYPES.QUASI:
        quasiIdentifiers.push(fieldName);
        break;
      case CLASSIFICATION_TYPES.SENSITIVE:
        sensitiveFields.push(fieldName);
        break;
    }
  });
  
  // Step 1: Process direct identifiers (suppress or tokenize)
  let processedData = data.map(record => {
    const newRecord = { ...record };
    directIdentifiers.forEach(field => {
      // Tokenize if value exists and is string-like, otherwise suppress
      if (newRecord[field] && typeof newRecord[field] === 'string' && newRecord[field].length > 3) {
        newRecord[field] = tokenizeField(newRecord[field], field);
      } else {
        newRecord[field] = suppressField();
      }
    });
    return newRecord;
  });
  
  // Step 2: Iteratively generalize quasi-identifiers to achieve k-anonymity
  let generalizationLevel = 0;
  let kAnonResult = checkKAnonymity(processedData, quasiIdentifiers, k);
  
  while (!kAnonResult.compliant && generalizationLevel < 4) {
    generalizationLevel++;
    
    processedData = processedData.map(record => {
      const newRecord = { ...record };
      quasiIdentifiers.forEach(field => {
        newRecord[field] = generalizeField(record[field], field, generalizationLevel);
      });
      return newRecord;
    });
    
    kAnonResult = checkKAnonymity(processedData, quasiIdentifiers, k);
    
    // Early exit if all values are suppressed
    if (generalizationLevel >= 4) break;
  }
  
  // Step 3: Check l-diversity
  const lDivResult = sensitiveFields.length > 0 
    ? checkLDiversity(processedData, quasiIdentifiers, sensitiveFields, l)
    : null;
  
  // Add metadata to first record
  if (processedData.length > 0) {
    processedData[0]._anonymizationMeta = {
      anonymizedAt: new Date().toISOString(),
      k: kAnonResult.k,
      kCompliant: kAnonResult.compliant,
      l: l,
      lCompliant: lDivResult ? lDivResult.compliant : true,
      generalizationLevel,
      directIdentifiers: directIdentifiers.length,
      quasiIdentifiers: quasiIdentifiers.length,
      sensitiveFields: sensitiveFields.length,
      suppressionStrategy: directIdentifiers.length > 0 ? 'tokenize/suppress' : 'none'
    };
  }
  
  return {
    data: processedData,
    kAnonResult,
    lDivResult,
    generalizationLevel,
    directIdentifiers,
    quasiIdentifiers,
    sensitiveFields
  };
};

/**
 * Anonymization service interface
 */
export const anonymizationEngine = {
  // Core anonymization
  anonymize: applyAnonymization,
  
  // Privacy model checks
  checkKAnonymity,
  checkLDiversity,
  checkTCloseness,
  
  // Field transformations
  generalizeField,
  tokenizeField,
  suppressField,
  
  // Utilities
  createQuasiKey,
  calculateDistribution,
  calculateDistributionDistance,
  
  // Configuration
  ANON_CONFIG,
  HIERARCHIES: FIELD_HIERARCHIES,
  CLASSIFICATION_TYPES
};

export {
  applyAnonymization,
  checkKAnonymity,
  checkLDiversity,
  checkTCloseness,
  generalizeField,
  tokenizeField,
  suppressField,
  calculateDistribution,
  calculateDistributionDistance,
  ANON_CONFIG
};
