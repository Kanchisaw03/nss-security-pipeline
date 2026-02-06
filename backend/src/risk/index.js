/**
 * Risk Scoring Layer
 * 
 * Computes re-identification risk based on:
 * - Number of quasi-identifiers
 * - Uniqueness/granularity of quasi-identifiers
 * - Presence of sensitive attributes
 * - k-anonymity and l-diversity metrics
 * 
 * Outputs: Low / Medium / High
 */

import { classificationService, CLASSIFICATION_TYPES } from '../classification/index.js';
import { anonymizationService } from '../anonymization/index.js';

// Risk thresholds
const RISK_THRESHOLDS = {
  LOW: { max: 30, label: 'Low' },
  MEDIUM: { max: 60, label: 'Medium' },
  HIGH: { max: 100, label: 'High' }
};

// Risk weights
const RISK_WEIGHTS = {
  directIdentifier: 40,
  quasiIdentifierUniqueness: 25,
  quasiIdentifierCount: 15,
  sensitiveAttribute: 10,
  kAnonymity: 10
};

/**
 * Risk scoring service
 */
export const riskService = {
  /**
   * Assess dataset risk
   */
  assessDataset: (data, classification) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid dataset');
    }
    
    if (!classification || !classification.fields) {
      throw new Error('Classification required for risk assessment');
    }
    
    const assessment = {
      assessedAt: new Date().toISOString(),
      recordCount: data.length,
      factors: {},
      overallRisk: null,
      overallRiskScore: 0,
      recommendations: []
    };
    
    let totalRiskScore = 0;
    
    // Factor 1: Direct identifiers
    const directIdCount = classification.summary.directIdentifiers.length;
    const directIdRisk = Math.min(directIdCount * 20, RISK_WEIGHTS.directIdentifier);
    assessment.factors.directIdentifiers = {
      count: directIdCount,
      fields: classification.summary.directIdentifiers,
      riskScore: directIdRisk,
      weight: RISK_WEIGHTS.directIdentifier,
      description: 'Direct identifiers can uniquely identify individuals'
    };
    totalRiskScore += directIdRisk;
    
    // Factor 2: Quasi-identifier count
    const quasiIdCount = classification.summary.quasiIdentifiers.length;
    const quasiIdRisk = Math.min(quasiIdCount * 5, RISK_WEIGHTS.quasiIdentifierCount);
    assessment.factors.quasiIdentifierCount = {
      count: quasiIdCount,
      fields: classification.summary.quasiIdentifiers,
      riskScore: quasiIdRisk,
      weight: RISK_WEIGHTS.quasiIdentifierCount,
      description: 'More quasi-identifiers increase re-identification risk'
    };
    totalRiskScore += quasiIdRisk;
    
    // Factor 3: Quasi-identifier uniqueness
    let avgUniqueness = 0;
    const highRiskQuasi = [];
    
    classification.summary.quasiIdentifiers.forEach(field => {
      const analysis = classification.fields[field]?.analysis;
      if (analysis) {
        avgUniqueness += analysis.uniquenessRatio || 0;
        if (analysis.riskLevel === 'high') {
          highRiskQuasi.push(field);
        }
      }
    });
    
    if (quasiIdCount > 0) {
      avgUniqueness /= quasiIdCount;
    }
    
    const uniquenessRisk = Math.round(avgUniqueness * RISK_WEIGHTS.quasiIdentifierUniqueness);
    assessment.factors.quasiIdentifierUniqueness = {
      averageUniqueness: Math.round(avgUniqueness * 100) + '%',
      highRiskFields: highRiskQuasi,
      riskScore: uniquenessRisk,
      weight: RISK_WEIGHTS.quasiIdentifierUniqueness,
      description: 'High uniqueness in quasi-identifiers enables re-identification'
    };
    totalRiskScore += uniquenessRisk;
    
    // Factor 4: Sensitive attributes
    const sensitiveCount = classification.summary.sensitiveAttributes.length;
    const sensitiveRisk = Math.min(sensitiveCount * 3, RISK_WEIGHTS.sensitiveAttribute);
    assessment.factors.sensitiveAttributes = {
      count: sensitiveCount,
      fields: classification.summary.sensitiveAttributes,
      riskScore: sensitiveRisk,
      weight: RISK_WEIGHTS.sensitiveAttribute,
      description: 'Sensitive attributes increase harm from re-identification'
    };
    totalRiskScore += sensitiveRisk;
    
    // Factor 5: k-anonymity check
    if (quasiIdCount > 0) {
      const kAnonResult = anonymizationService.checkKAnonymity(
        data,
        classification.summary.quasiIdentifiers,
        5 // k=5 threshold
      );
      
      const kAnonRisk = kAnonResult.compliant ? 0 : RISK_WEIGHTS.kAnonymity;
      assessment.factors.kAnonymity = {
        k: kAnonResult.k,
        compliant: kAnonResult.compliant,
        violatingGroups: kAnonResult.violatingGroups,
        complianceRate: kAnonResult.complianceRate + '%',
        riskScore: kAnonRisk,
        weight: RISK_WEIGHTS.kAnonymity,
        description: 'k-anonymity ensures each record is indistinguishable from k-1 others'
      };
      totalRiskScore += kAnonRisk;
    }
    
    // Calculate overall risk
    assessment.overallRiskScore = Math.min(Math.round(totalRiskScore), 100);
    assessment.overallRisk = calculateRiskLevel(assessment.overallRiskScore);
    
    // Generate recommendations
    assessment.recommendations = generateRecommendations(assessment);
    
    return assessment;
  },
  
  /**
   * Quick risk check for field
   */
  checkFieldRisk: (fieldName, values) => {
    const classification = classificationService.classifyField(fieldName);
    const uniqueValues = [...new Set(values)];
    const uniquenessRatio = uniqueValues.length / values.length;
    
    let riskLevel = 'low';
    if (classification.type === CLASSIFICATION_TYPES.DIRECT) {
      riskLevel = 'high';
    } else if (classification.type === CLASSIFICATION_TYPES.QUASI) {
      riskLevel = uniquenessRatio > 0.8 ? 'high' : uniquenessRatio > 0.5 ? 'medium' : 'low';
    } else if (classification.type === CLASSIFICATION_TYPES.SENSITIVE) {
      riskLevel = 'medium';
    }
    
    return {
      field: fieldName,
      classification: classification.type,
      uniquenessRatio: Math.round(uniquenessRatio * 100) + '%',
      uniqueValues: uniqueValues.length,
      totalValues: values.length,
      riskLevel
    };
  },
  
  /**
   * Compare risk before and after anonymization
   */
  compareRisk: (originalData, anonymizedData, classification) => {
    const beforeRisk = riskService.assessDataset(originalData, classification);
    const afterRisk = riskService.assessDataset(anonymizedData, classification);
    
    return {
      before: {
        score: beforeRisk.overallRiskScore,
        level: beforeRisk.overallRisk
      },
      after: {
        score: afterRisk.overallRiskScore,
        level: afterRisk.overallRisk
      },
      improvement: beforeRisk.overallRiskScore - afterRisk.overallRiskScore,
      percentageImprovement: Math.round(
        ((beforeRisk.overallRiskScore - afterRisk.overallRiskScore) / beforeRisk.overallRiskScore) * 100
      ) + '%'
    };
  },
  
  /**
   * Validate if risk is acceptable for release
   */
  isRiskAcceptable: (riskScore, maxAllowedRisk = 'Medium') => {
    const levels = { 'Low': 1, 'Medium': 2, 'High': 3 };
    const scoreLevel = calculateRiskLevel(riskScore);
    
    return levels[scoreLevel] <= levels[maxAllowedRisk];
  },
  
  RISK_THRESHOLDS,
  RISK_WEIGHTS
};

/**
 * Calculate risk level from score
 */
const calculateRiskLevel = (score) => {
  if (score <= RISK_THRESHOLDS.LOW.max) {
    return RISK_THRESHOLDS.LOW.label;
  } else if (score <= RISK_THRESHOLDS.MEDIUM.max) {
    return RISK_THRESHOLDS.MEDIUM.label;
  } else {
    return RISK_THRESHOLDS.HIGH.label;
  }
};

/**
 * Generate recommendations based on risk assessment
 */
const generateRecommendations = (assessment) => {
  const recommendations = [];
  
  // Direct identifier recommendations
  if (assessment.factors.directIdentifiers.count > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Direct Identifiers',
      action: 'Suppress or hash all direct identifiers',
      fields: assessment.factors.directIdentifiers.fields
    });
  }
  
  // Quasi-identifier recommendations
  if (assessment.factors.quasiIdentifierUniqueness.highRiskFields.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Quasi-Identifiers',
      action: 'Apply generalization to high-uniqueness quasi-identifiers',
      fields: assessment.factors.quasiIdentifierUniqueness.highRiskFields
    });
  }
  
  if (assessment.factors.quasiIdentifierCount.count >= 3) {
    recommendations.push({
      priority: 'medium',
      category: 'Quasi-Identifier Count',
      action: 'Consider reducing number of quasi-identifiers or applying stronger generalization',
      fields: assessment.factors.quasiIdentifierCount.fields
    });
  }
  
  // k-anonymity recommendations
  if (!assessment.factors.kAnonymity?.compliant) {
    recommendations.push({
      priority: 'high',
      category: 'K-Anonymity',
      action: `Apply k-anonymity with k=${assessment.factors.kAnonymity?.k || 5}. Consider suppressing rare combinations.`,
      violatingGroups: assessment.factors.kAnonymity?.violatingGroups
    });
  }
  
  // Overall risk recommendations
  if (assessment.overallRisk === 'High') {
    recommendations.push({
      priority: 'critical',
      category: 'Overall Risk',
      action: 'Dataset has high re-identification risk. Do not release without additional anonymization.',
      riskScore: assessment.overallRiskScore
    });
  } else if (assessment.overallRisk === 'Medium') {
    recommendations.push({
      priority: 'medium',
      category: 'Overall Risk',
      action: 'Medium risk level. Consider additional review before release.',
      riskScore: assessment.overallRiskScore
    });
  }
  
  return recommendations;
};

export { calculateRiskLevel };
