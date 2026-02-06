import { checkKAnonymity, checkLDiversity, calculateDistribution } from '../anonymization/engine.js';

/**
 * Risk Scoring Engine
 * 
 * Calculates privacy risk scores (0-100) for datasets.
 * Uses multi-factor risk assessment:
 * - Uniqueness Score (30%)
 * - k-Anonymity Violations (25%)
 * - Rare Sensitive Ratio (20%)
 * - Quasi-Identifier Count (15%)
 * - Dataset Size Factor (10%)
 * 
 * Risk Levels:
 * - Low: 0-30
 * - Medium: 31-60
 * - High: 61-100
 */

// Risk configuration
const RISK_CONFIG = {
  // Weight factors (must sum to 1.0)
  WEIGHTS: {
    UNIQUENESS: 0.30,
    K_VIOLATIONS: 0.25,
    RARE_SENSITIVE: 0.20,
    QUASI_COUNT: 0.15,
    SIZE_FACTOR: 0.10
  },
  
  // Thresholds
  THRESHOLDS: {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 100
  },
  
  // k-Anonymity default
  K_DEFAULT: 5,
  
  // Rare value threshold (values appearing less than this % are considered rare)
  RARE_THRESHOLD: 0.05
};

/**
 * Calculate uniqueness score
 * Measures what % of records have unique quasi-identifier combinations
 * @param {Array} data - Dataset
 * @param {Array} quasiFields - Quasi-identifier fields
 * @returns {number} Uniqueness score (0-100)
 */
const calculateUniquenessScore = (data, quasiFields) => {
  if (!data || data.length === 0 || !quasiFields || quasiFields.length === 0) {
    return 0;
  }
  
  const groups = {};
  
  data.forEach(record => {
    const key = quasiFields
      .map(field => String(record[field] || ''))
      .join('|');
    groups[key] = (groups[key] || 0) + 1;
  });
  
  const uniqueGroups = Object.values(groups).filter(count => count === 1).length;
  const totalGroups = Object.keys(groups).length;
  
  if (totalGroups === 0) return 0;
  
  // Calculate % of groups that are unique
  const uniquenessRatio = uniqueGroups / totalGroups;
  
  // Score 0-100 based on uniqueness ratio
  return Math.min(100, uniquenessRatio * 100);
};

/**
 * Calculate k-anonymity violation score
 * Measures severity of k-anonymity violations
 * @param {Array} data - Dataset
 * @param {Array} quasiFields - Quasi-identifier fields
 * @param {number} k - k threshold
 * @returns {number} Violation score (0-100)
 */
const calculateKViolationScore = (data, quasiFields, k = RISK_CONFIG.K_DEFAULT) => {
  if (!data || data.length === 0 || !quasiFields || quasiFields.length === 0) {
    return 0;
  }
  
  const kAnonResult = checkKAnonymity(data, quasiFields, k);
  
  if (kAnonResult.compliant) {
    return 0;
  }
  
  // Calculate total records in violation
  const recordsInViolation = kAnonResult.violations.reduce(
    (sum, v) => sum + v.count, 
    0
  );
  
  // Score based on % of records in violation
  const violationRatio = recordsInViolation / data.length;
  
  return Math.min(100, violationRatio * 100 * 2); // Multiply by 2 to amplify risk
};

/**
 * Calculate rare sensitive value ratio
 * Measures what % of sensitive values appear rarely (could lead to identification)
 * @param {Array} data - Dataset
 * @param {Array} sensitiveFields - Sensitive attribute fields
 * @returns {number} Rare value ratio score (0-100)
 */
const calculateRareSensitiveScore = (data, sensitiveFields) => {
  if (!data || data.length === 0 || !sensitiveFields || sensitiveFields.length === 0) {
    return 0;
  }
  
  let totalRareRatio = 0;
  let fieldCount = 0;
  
  sensitiveFields.forEach(field => {
    const values = data.map(r => r[field]).filter(v => v !== undefined && v !== null);
    
    if (values.length === 0) return;
    
    const distribution = calculateDistribution(values);
    
    // Count values that appear less than threshold
    const rareValues = Object.entries(distribution).filter(([_, prob]) => 
      prob < RISK_CONFIG.RARE_THRESHOLD
    );
    
    const rareRatio = rareValues.reduce((sum, [_, prob]) => sum + prob, 0);
    
    totalRareRatio += rareRatio;
    fieldCount++;
  });
  
  if (fieldCount === 0) return 0;
  
  const avgRareRatio = totalRareRatio / fieldCount;
  
  // Score 0-100 based on rare value ratio
  return Math.min(100, avgRareRatio * 100 * 1.5);
};

/**
 * Calculate quasi-identifier count risk
 * More quasi-identifiers = higher re-identification risk
 * @param {Array} quasiFields - Quasi-identifier fields
 * @returns {number} Quasi count score (0-100)
 */
const calculateQuasiCountScore = (quasiFields) => {
  if (!quasiFields || quasiFields.length === 0) {
    return 0;
  }
  
  const quasiCount = quasiFields.length;
  
  // Score increases with number of quasi-identifiers
  // 1-2: low risk, 3-4: medium, 5+: high
  if (quasiCount <= 2) {
    return quasiCount * 10;  // 0-20
  } else if (quasiCount <= 4) {
    return 20 + (quasiCount - 2) * 15;  // 35-50
  } else {
    return Math.min(100, 50 + (quasiCount - 4) * 10);  // 60+
  }
};

/**
 * Calculate dataset size factor
 * Smaller datasets are riskier (easier to identify individuals)
 * @param {number} size - Dataset size
 * @returns {number} Size factor score (0-100)
 */
const calculateSizeFactorScore = (size) => {
  if (!size || size <= 0) {
    return 100;  // Unknown size = maximum risk
  }
  
  // Larger datasets are safer
  // < 10: very high risk (100)
  // 10-100: high risk (80-100)
  // 100-1000: medium risk (40-80)
  // 1000-10000: low risk (10-40)
  // > 10000: very low risk (0-10)
  
  if (size < 10) {
    return 100;
  } else if (size < 100) {
    return 100 - ((size - 10) / 90) * 20;  // 100 to 80
  } else if (size < 1000) {
    return 80 - ((size - 100) / 900) * 40;  // 80 to 40
  } else if (size < 10000) {
    return 40 - ((size - 1000) / 9000) * 30;  // 40 to 10
  } else {
    return Math.max(0, 10 - (size - 10000) / 10000);  // 10 to 0
  }
};

/**
 * Calculate comprehensive risk score
 * Combines all risk factors with weighted formula
 * 
 * Formula:
 * risk = (uniquenessScore * 0.3) +
 *        (kViolations * 0.25) +
 *        (rareSensitiveRatio * 0.2) +
 *        (quasiCount * 0.15) +
 *        (datasetSizeFactor * 0.1)
 * 
 * @param {Array} data - Dataset
 * @param {Object} classification - Classification metadata
 * @returns {Object} Risk assessment results
 */
const calculateRiskScore = (data, classification) => {
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  
  if (!classification || !classification.fields) {
    throw new Error('Classification metadata required');
  }
  
  const datasetSize = data.length;
  
  // Extract field types from classification
  const quasiFields = [];
  const sensitiveFields = [];
  const directFields = [];
  
  Object.entries(classification.fields).forEach(([fieldName, fieldInfo]) => {
    switch (fieldInfo.type) {
      case 'quasi':
        quasiFields.push(fieldName);
        break;
      case 'sensitive':
        sensitiveFields.push(fieldName);
        break;
      case 'direct':
        directFields.push(fieldName);
        break;
    }
  });
  
  // Calculate individual risk components
  const uniquenessScore = calculateUniquenessScore(data, quasiFields);
  const kViolationScore = calculateKViolationScore(data, quasiFields);
  const rareSensitiveScore = calculateRareSensitiveScore(data, sensitiveFields);
  const quasiCountScore = calculateQuasiCountScore(quasiFields);
  const sizeFactorScore = calculateSizeFactorScore(datasetSize);
  
  // Calculate weighted risk score
  const riskScore = 
    (uniquenessScore * RISK_CONFIG.WEIGHTS.UNIQUENESS) +
    (kViolationScore * RISK_CONFIG.WEIGHTS.K_VIOLATIONS) +
    (rareSensitiveScore * RISK_CONFIG.WEIGHTS.RARE_SENSITIVE) +
    (quasiCountScore * RISK_CONFIG.WEIGHTS.QUASI_COUNT) +
    (sizeFactorScore * RISK_CONFIG.WEIGHTS.SIZE_FACTOR);
  
  // Round to 2 decimal places
  const finalScore = Math.round(riskScore * 100) / 100;
  
  // Determine risk level
  let riskLevel;
  if (finalScore <= RISK_CONFIG.THRESHOLDS.LOW) {
    riskLevel = 'Low';
  } else if (finalScore <= RISK_CONFIG.THRESHOLDS.MEDIUM) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'High';
  }
  
  // Generate recommendations
  const recommendations = [];
  
  if (uniquenessScore > 50) {
    recommendations.push('High uniqueness detected: Apply stronger generalization to quasi-identifiers');
  }
  
  if (kViolationScore > 0) {
    recommendations.push(`k-anonymity violations found: Consider increasing k or applying suppression`);
  }
  
  if (rareSensitiveScore > 30) {
    recommendations.push('Rare sensitive values detected: Apply l-diversity or t-closeness constraints');
  }
  
  if (quasiCountScore > 60) {
    recommendations.push('High number of quasi-identifiers: Consider reducing fields or applying stronger anonymization');
  }
  
  if (sizeFactorScore > 50) {
    recommendations.push('Small dataset size: Consider aggregation or combining with similar datasets');
  }
  
  if (directFields.length > 0) {
    recommendations.push(`Direct identifiers present (${directFields.length}): Must be removed or tokenized before release`);
  }
  
  return {
    overallRisk: finalScore,
    riskLevel,
    datasetSize,
    fieldAnalysis: {
      directFields: directFields.length,
      quasiFields: quasiFields.length,
      sensitiveFields: sensitiveFields.length
    },
    componentScores: {
      uniquenessScore: Math.round(uniquenessScore * 100) / 100,
      kViolationScore: Math.round(kViolationScore * 100) / 100,
      rareSensitiveScore: Math.round(rareSensitiveScore * 100) / 100,
      quasiCountScore: Math.round(quasiCountScore * 100) / 100,
      sizeFactorScore: Math.round(sizeFactorScore * 100) / 100
    },
    weights: RISK_CONFIG.WEIGHTS,
    recommendations,
    assessedAt: new Date().toISOString()
  };
};

/**
 * Compare risk before and after anonymization
 * @param {Array} originalData - Original dataset
 * @param {Array} anonymizedData - Anonymized dataset
 * @param {Object} classification - Classification metadata
 * @returns {Object} Risk comparison
 */
const compareRisk = (originalData, anonymizedData, classification) => {
  const beforeRisk = calculateRiskScore(originalData, classification);
  const afterRisk = calculateRiskScore(anonymizedData, classification);
  
  const riskReduction = beforeRisk.overallRisk - afterRisk.overallRisk;
  const riskReductionPercent = beforeRisk.overallRisk > 0 
    ? (riskReduction / beforeRisk.overallRisk * 100).toFixed(2)
    : 0;
  
  return {
    before: beforeRisk,
    after: afterRisk,
    comparison: {
      riskReduction: Math.round(riskReduction * 100) / 100,
      riskReductionPercent: `${riskReductionPercent}%`,
      riskLevelChanged: beforeRisk.riskLevel !== afterRisk.riskLevel,
      previousLevel: beforeRisk.riskLevel,
      currentLevel: afterRisk.riskLevel,
      improvement: riskReduction > 0 ? 'Positive' : 'Negative'
    },
    assessedAt: new Date().toISOString()
  };
};

/**
 * Check if risk is acceptable for release
 * @param {Object} riskAssessment - Risk assessment result
 * @param {string} maxLevel - Maximum acceptable risk level ('Low', 'Medium', 'High')
 * @returns {Object} Release decision
 */
const checkReleaseEligibility = (riskAssessment, maxLevel = 'Medium') => {
  const levels = { 'Low': 1, 'Medium': 2, 'High': 3 };
  const currentLevel = levels[riskAssessment.riskLevel];
  const maxLevelNum = levels[maxLevel];
  
  const eligible = currentLevel <= maxLevelNum;
  
  return {
    eligible,
    currentRisk: riskAssessment.overallRisk,
    currentLevel: riskAssessment.riskLevel,
    maxAllowedLevel: maxLevel,
    reasons: eligible ? [] : [`Risk level ${riskAssessment.riskLevel} exceeds maximum allowed ${maxLevel}`],
    requiresAdditionalAnonymization: !eligible
  };
};

/**
 * Risk Engine interface
 */
export const riskEngine = {
  calculateRiskScore,
  compareRisk,
  checkReleaseEligibility,
  
  // Individual risk components
  calculateUniquenessScore,
  calculateKViolationScore,
  calculateRareSensitiveScore,
  calculateQuasiCountScore,
  calculateSizeFactorScore,
  
  // Configuration
  RISK_CONFIG
};

export {
  calculateRiskScore,
  compareRisk,
  checkReleaseEligibility,
  RISK_CONFIG
};
