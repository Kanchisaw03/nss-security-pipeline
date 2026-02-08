/**
 * Privacy-Utility Report Engine
 * 
 * Generates comprehensive privacy-utility tradeoff reports by comparing
 * original, baseline anonymized, and enhanced anonymized datasets.
 * 
 * Metrics:
 * - Privacy: k violations, l-diversity failures, uniqueness, entropy
 * - Utility: mean/variance difference, KL divergence, suppression rate
 * - Tradeoff: privacyGain / utilityLoss ratio with recommendation
 */

import { v4 as uuidv4 } from 'uuid';
import { riskEngine } from '../riskEngine/index.js';
import { checkKAnonymity, checkLDiversity } from '../anonymization/engine.js';

// Store reports
const privacyUtilityReports = new Map();

/**
 * Calculate entropy for quasi-identifier distribution
 * entropy = -Σ p(x) log p(x)
 */
const calculateQuasiEntropy = (data, quasiFields) => {
  if (!data || data.length === 0 || !quasiFields || quasiFields.length === 0) {
    return 0;
  }
  
  // Create quasi-key distribution
  const groups = {};
  data.forEach(record => {
    const key = quasiFields
      .map(field => String(record[field] || ''))
      .join('|');
    groups[key] = (groups[key] || 0) + 1;
  });
  
  // Calculate entropy
  let entropy = 0;
  const total = data.length;
  
  Object.values(groups).forEach(count => {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  });
  
  return Math.round(entropy * 100) / 100;
};

/**
 * Calculate mean of numeric field
 */
const calculateMean = (data, field) => {
  const values = data
    .map(r => parseFloat(r[field]))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Calculate variance of numeric field
 */
const calculateVariance = (data, field, mean) => {
  const values = data
    .map(r => parseFloat(r[field]))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) return 0;
  
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Calculate KL Divergence between two distributions
 * KL(P||Q) = Σ P(x) log(P(x)/Q(x))
 */
const calculateKLDivergence = (originalData, anonymizedData, field) => {
  // Get value distributions
  const getDistribution = (data) => {
    const counts = {};
    data.forEach(record => {
      const value = String(record[field] || 'unknown');
      counts[value] = (counts[value] || 0) + 1;
    });
    
    const total = data.length;
    const dist = {};
    Object.entries(counts).forEach(([value, count]) => {
      dist[value] = count / total;
    });
    return dist;
  };
  
  const p = getDistribution(originalData);
  const q = getDistribution(anonymizedData);
  
  // Calculate KL divergence
  let klDiv = 0;
  Object.entries(p).forEach(([value, probP]) => {
    const probQ = q[value] || 0.0001; // Small epsilon to avoid log(0)
    klDiv += probP * Math.log2(probP / probQ);
  });
  
  return Math.max(0, Math.round(klDiv * 100) / 100);
};

/**
 * Calculate mean difference percentage
 * |mean_original - mean_anonymized| / mean_original
 */
const calculateMeanDifferencePercent = (originalData, anonymizedData, numericFields) => {
  if (!numericFields || numericFields.length === 0) {
    return { avgMeanDiff: 0, fieldDiffs: {} };
  }
  
  const fieldDiffs = {};
  let totalDiff = 0;
  let count = 0;
  
  numericFields.forEach(field => {
    const origMean = calculateMean(originalData, field);
    if (origMean === 0) return;
    
    const anonMean = calculateMean(anonymizedData, field);
    const diff = Math.abs(origMean - anonMean) / origMean * 100;
    
    fieldDiffs[field] = Math.round(diff * 100) / 100;
    totalDiff += diff;
    count++;
  });
  
  return {
    avgMeanDiff: count > 0 ? Math.round((totalDiff / count) * 100) / 100 : 0,
    fieldDiffs
  };
};

/**
 * Calculate variance difference percentage
 */
const calculateVarianceDifferencePercent = (originalData, anonymizedData, numericFields) => {
  if (!numericFields || numericFields.length === 0) {
    return { avgVarianceDiff: 0, fieldDiffs: {} };
  }
  
  const fieldDiffs = {};
  let totalDiff = 0;
  let count = 0;
  
  numericFields.forEach(field => {
    const origMean = calculateMean(originalData, field);
    const origVar = calculateVariance(originalData, field, origMean);
    if (origVar === 0) return;
    
    const anonMean = calculateMean(anonymizedData, field);
    const anonVar = calculateVariance(anonymizedData, field, anonMean);
    const diff = Math.abs(origVar - anonVar) / origVar * 100;
    
    fieldDiffs[field] = Math.round(diff * 100) / 100;
    totalDiff += diff;
    count++;
  });
  
  return {
    avgVarianceDiff: count > 0 ? Math.round((totalDiff / count) * 100) / 100 : 0,
    fieldDiffs
  };
};

/**
 * Calculate record suppression percentage
 */
const calculateRecordSuppressionPercent = (originalData, anonymizedData) => {
  if (!originalData.length) return 0;
  
  // Count records that are heavily suppressed
  const suppressedCount = anonymizedData.filter(record => {
    const redactedFields = Object.values(record).filter(v => 
      v === '[REDACTED]' || v === '[SUPRESSED]' || v === null || v === undefined || v === '*'
    ).length;
    return redactedFields >= Object.keys(record).length * 0.5;
  }).length;
  
  return Math.round((suppressedCount / originalData.length) * 100 * 100) / 100;
};

/**
 * Identify numeric fields from data sample
 */
const identifyNumericFields = (data) => {
  if (!data || data.length === 0) return [];
  
  const sample = data[0];
  const numericFields = [];
  
  Object.entries(sample).forEach(([field, value]) => {
    if (typeof value === 'number' || !isNaN(parseFloat(value))) {
      numericFields.push(field);
    }
  });
  
  return numericFields;
};

/**
 * Generate Privacy-Utility Report
 */
const generateReport = async (originalData, baselineData, enhancedData, options = {}) => {
  try {
    const reportId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get field info
    const numericFields = identifyNumericFields(originalData);
    
    // Get classification for quasi/sensitive fields
    const { classificationService } = await import('../classification/index.js');
    const classification = classificationService.classifyDataset(originalData);
    
    const quasiFields = classification.summary.quasiIdentifiers;
    const sensitiveFields = classification.summary.sensitiveAttributes;
    
    // === PRIVACY METRICS ===
    
    // k-anonymity violations
    const baselineKAnon = checkKAnonymity(baselineData, quasiFields, options.k || 5);
    const enhancedKAnon = checkKAnonymity(enhancedData, quasiFields, options.k || 5);
    
    // l-diversity failures
    const baselineLDiv = sensitiveFields.length > 0 
      ? checkLDiversity(baselineData, quasiFields, sensitiveFields, options.l || 2)
      : { compliant: true, violations: [] };
    const enhancedLDiv = sensitiveFields.length > 0
      ? checkLDiversity(enhancedData, quasiFields, sensitiveFields, options.l || 2)
      : { compliant: true, violations: [] };
    
    // Uniqueness ratio (records with unique quasi-key)
    const calculateUniquenessRatio = (data) => {
      if (!data.length || !quasiFields.length) return 0;
      
      const groups = {};
      data.forEach(record => {
        const key = quasiFields.map(f => String(record[f] || '')).join('|');
        groups[key] = (groups[key] || 0) + 1;
      });
      
      const uniqueGroups = Object.values(groups).filter(c => c === 1).length;
      return Math.round((uniqueGroups / data.length) * 100 * 100) / 100;
    };
    
    // Quasi-identifier entropy
    const baselineEntropy = calculateQuasiEntropy(baselineData, quasiFields);
    const enhancedEntropy = calculateQuasiEntropy(enhancedData, quasiFields);
    const originalEntropy = calculateQuasiEntropy(originalData, quasiFields);
    
    // === UTILITY METRICS ===
    
    const baselineMeanDiff = calculateMeanDifferencePercent(originalData, baselineData, numericFields);
    const enhancedMeanDiff = calculateMeanDifferencePercent(originalData, enhancedData, numericFields);
    
    const baselineVarDiff = calculateVarianceDifferencePercent(originalData, baselineData, numericFields);
    const enhancedVarDiff = calculateVarianceDifferencePercent(originalData, enhancedData, numericFields);
    
    // KL Divergence for distribution shift
    const baselineKLDiv = {};
    const enhancedKLDiv = {};
    
    if (sensitiveFields.length > 0) {
      sensitiveFields.forEach(field => {
        baselineKLDiv[field] = calculateKLDivergence(originalData, baselineData, field);
        enhancedKLDiv[field] = calculateKLDivergence(originalData, enhancedData, field);
      });
    }
    
    // Record suppression rate
    const baselineSuppression = calculateRecordSuppressionPercent(originalData, baselineData);
    const enhancedSuppression = calculateRecordSuppressionPercent(originalData, enhancedData);
    
    // === RISK ASSESSMENTS ===
    
    const baselineRisk = riskEngine.calculateRiskScore(baselineData, classification);
    const enhancedRisk = riskEngine.calculateRiskScore(enhancedData, classification);
    const originalRisk = riskEngine.calculateRiskScore(originalData, classification);
    
    // === CALCULATE TRADEOFFS ===
    
    // Privacy gain (risk reduction)
    const baselinePrivacyGain = originalRisk.overallRisk - baselineRisk.overallRisk;
    const enhancedPrivacyGain = originalRisk.overallRisk - enhancedRisk.overallRisk;
    
    // Utility loss (composite score)
    const baselineUtilityLoss = baselineMeanDiff.avgMeanDiff + baselineSuppression;
    const enhancedUtilityLoss = enhancedMeanDiff.avgMeanDiff + enhancedSuppression;
    
    // Tradeoff score (higher = better privacy per unit utility loss)
    const baselineTradeoff = baselineUtilityLoss > 0 
      ? baselinePrivacyGain / baselineUtilityLoss 
      : baselinePrivacyGain;
    const enhancedTradeoff = enhancedUtilityLoss > 0
      ? enhancedPrivacyGain / enhancedUtilityLoss
      : enhancedPrivacyGain;
    
    // === RECOMMENDATION ===
    const getRecommendation = (privacyGain, utilityLoss, riskLevel) => {
      if (privacyGain < 10 && riskLevel !== 'Low') {
        return 'HIGH_RISK';
      }
      if (utilityLoss > 50) {
        return 'REVIEW';
      }
      if (riskLevel === 'Low' || riskLevel === 'Medium' && privacyGain > 20) {
        return 'SAFE';
      }
      return 'REVIEW';
    };
    
    const report = {
      reportId,
      timestamp,
      datasetSize: originalData.length,
      privacyMetrics: {
        baseline: {
          kViolations: baselineKAnon.violatingGroups,
          lDiversityFailures: baselineLDiv.violations?.length || 0,
          uniquenessRatio: calculateUniquenessRatio(baselineData),
          quasiEntropy: baselineEntropy,
          riskScore: baselineRisk.overallRisk,
          riskLevel: baselineRisk.riskLevel
        },
        enhanced: {
          kViolations: enhancedKAnon.violatingGroups,
          lDiversityFailures: enhancedLDiv.violations?.length || 0,
          uniquenessRatio: calculateUniquenessRatio(enhancedData),
          quasiEntropy: enhancedEntropy,
          riskScore: enhancedRisk.overallRisk,
          riskLevel: enhancedRisk.riskLevel
        },
        comparison: {
          privacyGainVsBaseline: Math.round((baselinePrivacyGain - (originalRisk.overallRisk - baselineRisk.overallRisk)) * 100) / 100,
          privacyGainVsEnhanced: Math.round((enhancedPrivacyGain - (originalRisk.overallRisk - enhancedRisk.overallRisk)) * 100) / 100
        }
      },
      utilityMetrics: {
        baseline: {
          meanDifferencePercent: baselineMeanDiff,
          varianceDifferencePercent: baselineVarDiff,
          recordSuppressionPercent: baselineSuppression,
          klDivergence: baselineKLDiv
        },
        enhanced: {
          meanDifferencePercent: enhancedMeanDiff,
          varianceDifferencePercent: enhancedVarDiff,
          recordSuppressionPercent: enhancedSuppression,
          klDivergence: enhancedKLDiv
        }
      },
      tradeoffAnalysis: {
        baseline: {
          privacyGain: Math.round(baselinePrivacyGain * 100) / 100,
          utilityLoss: Math.round(baselineUtilityLoss * 100) / 100,
          tradeoffScore: Math.round(baselineTradeoff * 100) / 100
        },
        enhanced: {
          privacyGain: Math.round(enhancedPrivacyGain * 100) / 100,
          utilityLoss: Math.round(enhancedUtilityLoss * 100) / 100,
          tradeoffScore: Math.round(enhancedTradeoff * 100) / 100
        },
        winner: enhancedTradeoff > baselineTradeoff ? 'enhanced' : 'baseline'
      },
      recommendations: {
        baseline: getRecommendation(baselinePrivacyGain, baselineUtilityLoss, baselineRisk.riskLevel),
        enhanced: getRecommendation(enhancedPrivacyGain, enhancedUtilityLoss, enhancedRisk.riskLevel),
        preferredMode: enhancedTradeoff > baselineTradeoff ? 'enhanced' : 'baseline'
      },
      fieldAnalysis: {
        quasiIdentifiers: quasiFields,
        sensitiveAttributes: sensitiveFields,
        numericFields
      }
    };
    
    // Store report
    privacyUtilityReports.set(reportId, report);
    
    return report;
    
  } catch (error) {
    throw new Error(`Report generation failed: ${error.message}`);
  }
};

/**
 * Get report by ID
 */
const getReport = (reportId) => {
  return privacyUtilityReports.get(reportId) || null;
};

/**
 * List reports with optional filtering
 */
const listReports = (filters = {}) => {
  let reports = Array.from(privacyUtilityReports.values());
  
  if (filters.recommendation) {
    reports = reports.filter(r => 
      r.recommendations.enhanced === filters.recommendation ||
      r.recommendations.baseline === filters.recommendation
    );
  }
  
  return reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Privacy Utility Report Engine Interface
 */
export const privacyUtilityReport = {
  generateReport,
  getReport,
  listReports,
  calculateQuasiEntropy
};

export {
  generateReport,
  getReport,
  listReports,
  calculateQuasiEntropy,
  calculateKLDivergence
};
