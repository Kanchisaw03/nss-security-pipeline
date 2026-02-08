/**
 * Privacy-Utility Curve Generator
 * 
 * Simulates different DP epsilon values and generates privacy-utility tradeoff curves.
 * Epsilons tested: [0.1, 0.5, 1.0]
 * 
 * For each epsilon:
 * - Apply DP noise
 * - Compute risk
 * - Compute utility loss
 * - Store curve array
 */

import { v4 as uuidv4 } from 'uuid';
import { riskEngine } from '../riskEngine/index.js';
import { dpEngine } from '../dpEngine/index.js';

// Store curve results
const curveResults = new Map();

// Default epsilon values to test
const DEFAULT_EPSILONS = [0.1, 0.5, 1.0];

/**
 * Apply DP noise to numeric fields in dataset
 */
const applyDPNoise = (data, numericFields, epsilon) => {
  if (!numericFields || numericFields.length === 0) {
    return { data, noiseApplied: false };
  }
  
  const noisyData = data.map(record => {
    const newRecord = { ...record };
    
    numericFields.forEach(field => {
      const value = parseFloat(record[field]);
      if (!isNaN(value)) {
        // Calculate sensitivity (assume max possible change is 2x value for simplicity)
        const sensitivity = Math.abs(value) * 0.1;
        
        // Apply Laplace noise
        const noise = generateLaplaceNoise(sensitivity, epsilon);
        newRecord[field] = Math.round((value + noise) * 100) / 100;
      }
    });
    
    return newRecord;
  });
  
  return { data: noisyData, noiseApplied: true };
};

/**
 * Generate Laplace noise
 */
const generateLaplaceNoise = (sensitivity, epsilon) => {
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
};

/**
 * Identify numeric fields from data
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
 * Calculate utility loss after DP application
 * Compare mean squared error of numeric fields
 */
const calculateUtilityLoss = (originalData, noisyData, numericFields) => {
  if (!numericFields || numericFields.length === 0) {
    return { totalLoss: 0, fieldLosses: {} };
  }
  
  const fieldLosses = {};
  let totalLoss = 0;
  
  numericFields.forEach(field => {
    const originalValues = originalData.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
    const noisyValues = noisyData.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
    
    if (originalValues.length === 0 || noisyValues.length === 0) {
      fieldLosses[field] = 0;
      return;
    }
    
    // Calculate mean squared error as percentage
    const originalMean = originalValues.reduce((a, b) => a + b, 0) / originalValues.length;
    
    let squaredErrorSum = 0;
    for (let i = 0; i < Math.min(originalValues.length, noisyValues.length); i++) {
      squaredErrorSum += Math.pow(originalValues[i] - noisyValues[i], 2);
    }
    
    const mse = squaredErrorSum / originalValues.length;
    const normalizedLoss = originalMean !== 0 ? (Math.sqrt(mse) / Math.abs(originalMean)) * 100 : 0;
    
    fieldLosses[field] = Math.round(normalizedLoss * 100) / 100;
    totalLoss += normalizedLoss;
  });
  
  const avgLoss = numericFields.length > 0 ? totalLoss / numericFields.length : 0;
  
  return {
    totalLoss: Math.round(avgLoss * 100) / 100,
    fieldLosses
  };
};

/**
 * Calculate privacy gain (risk reduction)
 */
const calculatePrivacyGain = (originalRisk, noisyRisk) => {
  const riskReduction = originalRisk.overallRisk - noisyRisk.overallRisk;
  const gainPercent = originalRisk.overallRisk > 0 
    ? (riskReduction / originalRisk.overallRisk) * 100 
    : 0;
  
  return {
    absoluteReduction: Math.round(riskReduction * 100) / 100,
    gainPercent: Math.round(gainPercent * 100) / 100
  };
};

/**
 * Generate Privacy-Utility Curve for a dataset
 */
const generateCurve = async (datasetId, data, classification, options = {}) => {
  try {
    const curveId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const epsilons = options.epsilons || DEFAULT_EPSILONS;
    const numericFields = options.numericFields || identifyNumericFields(data);
    
    // Calculate baseline (original) risk
    const originalRisk = riskEngine.calculateRiskScore(data, classification);
    
    // Calculate curve points
    const curvePoints = [];
    
    for (const epsilon of epsilons) {
      // Apply DP noise
      const { data: noisyData } = applyDPNoise(data, numericFields, epsilon);
      
      // Calculate risk on noisy data
      const noisyRisk = riskEngine.calculateRiskScore(noisyData, classification);
      
      // Calculate utility loss
      const utilityLoss = calculateUtilityLoss(data, noisyData, numericFields);
      
      // Calculate privacy gain
      const privacyGain = calculatePrivacyGain(originalRisk, noisyRisk);
      
      curvePoints.push({
        epsilon,
        privacyMetrics: {
          riskScore: noisyRisk.overallRisk,
          riskLevel: noisyRisk.riskLevel,
          privacyGainPercent: privacyGain.gainPercent,
          absoluteRiskReduction: privacyGain.absoluteReduction
        },
        utilityMetrics: {
          utilityLossPercent: utilityLoss.totalLoss,
          fieldBreakdown: utilityLoss.fieldLosses,
          noiseMagnitude: epsilon < 0.5 ? 'High' : epsilon < 1.0 ? 'Medium' : 'Low'
        },
        tradeoff: {
          ratio: utilityLoss.totalLoss > 0 
            ? Math.round((privacyGain.gainPercent / utilityLoss.totalLoss) * 100) / 100
            : privacyGain.gainPercent,
          efficiency: privacyGain.gainPercent > utilityLoss.totalLoss ? 'good' : 'poor'
        }
      });
    }
    
    // Determine optimal epsilon
    const optimalPoint = curvePoints.reduce((best, current) => {
      if (current.tradeoff.efficiency === 'good' && current.tradeoff.ratio > best.tradeoff.ratio) {
        return current;
      }
      return best;
    }, curvePoints[0]);
    
    // Generate recommendation
    const recommendation = generateRecommendation(curvePoints, optimalPoint);
    
    const result = {
      curveId,
      datasetId,
      timestamp,
      parameters: {
        epsilonsTested: epsilons,
        numericFields,
        totalRecords: data.length
      },
      baseline: {
        originalRiskScore: originalRisk.overallRisk,
        originalRiskLevel: originalRisk.riskLevel
      },
      curve: curvePoints,
      optimal: {
        epsilon: optimalPoint.epsilon,
        privacyGain: optimalPoint.privacyMetrics.privacyGainPercent,
        utilityLoss: optimalPoint.utilityMetrics.utilityLossPercent,
        reason: `Best privacy-utility tradeoff with ${optimalPoint.tradeoff.efficiency} efficiency`
      },
      recommendation,
      summary: {
        totalPoints: curvePoints.length,
        epsilonRange: `${Math.min(...epsilons)} - ${Math.max(...epsilons)}`,
        achievablePrivacyGain: Math.max(...curvePoints.map(p => p.privacyMetrics.privacyGainPercent)),
        minimumUtilityLoss: Math.min(...curvePoints.map(p => p.utilityMetrics.utilityLossPercent))
      }
    };
    
    // Store result
    curveResults.set(curveId, result);
    
    return result;
    
  } catch (error) {
    throw new Error(`Curve generation failed: ${error.message}`);
  }
};

/**
 * Generate recommendation based on curve analysis
 */
const generateRecommendation = (curvePoints, optimal) => {
  const highPrivacyPoints = curvePoints.filter(p => p.epsilon <= 0.5);
  const balancedPoints = curvePoints.filter(p => p.epsilon > 0.5 && p.epsilon <= 1.0);
  
  if (highPrivacyPoints.length > 0 && highPrivacyPoints[0].privacyMetrics.privacyGainPercent > 20) {
    return {
      suggestedEpsilon: highPrivacyPoints[0].epsilon,
      rationale: 'Strong privacy protection with acceptable utility tradeoff',
      useCase: 'High-sensitivity datasets or strict compliance requirements',
      confidence: 'high'
    };
  }
  
  if (balancedPoints.length > 0) {
    return {
      suggestedEpsilon: balancedPoints[0].epsilon,
      rationale: 'Balanced privacy-utility tradeoff for general use',
      useCase: 'Standard research datasets with moderate sensitivity',
      confidence: 'medium'
    };
  }
  
  return {
    suggestedEpsilon: optimal.epsilon,
    rationale: 'Best available tradeoff',
    useCase: 'Consider additional anonymization if privacy requirements are strict',
    confidence: 'low'
  };
};

/**
 * Compare curves between baseline and enhanced modes
 */
const compareModeCurves = async (datasetId, originalData, baselineData, enhancedData, classification) => {
  try {
    const comparisonId = uuidv4();
    
    // Generate curves for both modes
    const baselineCurve = await generateCurve(`${datasetId}_baseline`, baselineData, classification, {
      epsilons: DEFAULT_EPSILONS
    });
    
    const enhancedCurve = await generateCurve(`${datasetId}_enhanced`, enhancedData, classification, {
      epsilons: DEFAULT_EPSILONS
    });
    
    // Compare curves
    const comparison = {
      comparisonId,
      datasetId,
      timestamp: new Date().toISOString(),
      curves: {
        baseline: baselineCurve,
        enhanced: enhancedCurve
      },
      analysis: {
        winner: enhancedCurve.optimal.privacyGain > baselineCurve.optimal.privacyGain 
          ? 'enhanced' 
          : 'baseline',
        baselineOptimalEpsilon: baselineCurve.optimal.epsilon,
        enhancedOptimalEpsilon: enhancedCurve.optimal.epsilon,
        privacyGainDifference: Math.round(
          (enhancedCurve.optimal.privacyGain - baselineCurve.optimal.privacyGain) * 100
        ) / 100,
        utilityLossDifference: Math.round(
          (enhancedCurve.optimal.utilityLoss - baselineCurve.optimal.utilityLoss) * 100
        ) / 100
      },
      recommendation: enhancedCurve.optimal.privacyGain > baselineCurve.optimal.privacyGain
        ? 'Enhanced mode provides better privacy-utility tradeoff'
        : 'Baseline mode provides comparable tradeoff with less complexity'
    };
    
    return comparison;
    
  } catch (error) {
    throw new Error(`Curve comparison failed: ${error.message}`);
  }
};

/**
 * Get curve by ID
 */
const getCurve = (curveId) => {
  return curveResults.get(curveId) || null;
};

/**
 * List all curves for a dataset
 */
const listCurves = (datasetId) => {
  const curves = Array.from(curveResults.values())
    .filter(c => c.datasetId === datasetId)
    .map(c => ({
      curveId: c.curveId,
      datasetId: c.datasetId,
      timestamp: c.timestamp,
      optimalEpsilon: c.optimal.epsilon,
      privacyGain: c.optimal.privacyGain,
      utilityLoss: c.optimal.utilityLoss
    }));
  
  return curves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Get curve data for visualization
 */
const getCurveVisualizationData = (curveId) => {
  const curve = curveResults.get(curveId);
  if (!curve) return null;
  
  return {
    curveId: curve.curveId,
    datasetId: curve.datasetId,
    points: curve.curve.map(p => ({
      x: p.utilityMetrics.utilityLossPercent,
      y: p.privacyMetrics.privacyGainPercent,
      epsilon: p.epsilon,
      label: `ε=${p.epsilon}`
    })),
    optimal: {
      x: curve.optimal.utilityLoss,
      y: curve.optimal.privacyGain,
      epsilon: curve.optimal.epsilon
    },
    recommendation: curve.recommendation
  };
};

/**
 * Privacy-Utility Curve Interface
 */
export const privacyUtilityCurve = {
  generateCurve,
  compareModeCurves,
  getCurve,
  listCurves,
  getCurveVisualizationData,
  DEFAULT_EPSILONS
};

export {
  generateCurve,
  compareModeCurves,
  getCurve,
  listCurves,
  getCurveVisualizationData,
  DEFAULT_EPSILONS
};
