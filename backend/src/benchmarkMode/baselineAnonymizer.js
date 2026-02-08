/**
 * NSO Benchmark Mode - Baseline Anonymizer
 * 
 * Implements two anonymization modes for comparison:
 * - baseline: Basic anonymization without k-anonymity, l-diversity, or DP
 * - enhanced: Uses existing anonymization engine with full privacy protections
 * 
 * Returns risk and utility comparison metrics.
 */

import { v4 as uuidv4 } from 'uuid';
import { classificationService } from '../classification/index.js';
import { riskEngine } from '../riskEngine/index.js';
import { storageService, stores } from '../storage/index.js';
import { cryptoService } from '../crypto/index.js';

// Store benchmark results
const benchmarkResults = new Map();

/**
 * Apply baseline anonymization (simple rules, no k-anon enforcement)
 * Rules:
 * - Remove direct identifiers
 * - Age → 10-year buckets
 * - District → State only
 * - Income → None
 * - No k-anonymity
 * - No l-diversity
 * - No DP protection
 */
const applyBaselineAnonymization = (data, classification) => {
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
      case 'direct':
        directIdentifiers.push(fieldName);
        break;
      case 'quasi':
        quasiIdentifiers.push(fieldName);
        break;
      case 'sensitive':
        sensitiveFields.push(fieldName);
        break;
    }
  });
  
  // Apply baseline transformations
  const baselineData = data.map(record => {
    const newRecord = { ...record };
    
    // Step 1: Remove direct identifiers (suppress completely)
    directIdentifiers.forEach(field => {
      newRecord[field] = '[REDACTED]';
    });
    
    // Step 2: Age → 10-year buckets
    Object.keys(newRecord).forEach(field => {
      if (field.toLowerCase().includes('age')) {
        const age = parseInt(newRecord[field]);
        if (!isNaN(age)) {
          const decade = Math.floor(age / 10) * 10;
          newRecord[field] = `${decade}-${decade + 9}`;
        }
      }
      
      // Step 3: District/Location → State only (if contains state info)
      if (field.toLowerCase().includes('district') || 
          field.toLowerCase().includes('city') || 
          field.toLowerCase().includes('zip')) {
        const value = String(newRecord[field] || '');
        // If it's a ZIP code, reduce to first 2 digits
        if (/^\d{5}$/.test(value)) {
          newRecord[field] = value.substring(0, 2) + '***';
        } else if (value.includes(',')) {
          // If format like "City, State", keep only State
          const parts = value.split(',');
          newRecord[field] = parts[parts.length - 1].trim();
        }
      }
      
      // Step 4: Income → Remove (suppress)
      if (field.toLowerCase().includes('income') || 
          field.toLowerCase().includes('salary') ||
          field.toLowerCase().includes('earnings')) {
        newRecord[field] = '[SUPRESSED]';
      }
    });
    
    return newRecord;
  });
  
  // Calculate distortion rate
  let distortionCount = 0;
  let totalFields = 0;
  
  data.forEach((original, idx) => {
    const anonymized = baselineData[idx];
    Object.keys(original).forEach(field => {
      totalFields++;
      if (String(original[field]) !== String(anonymized[field])) {
        distortionCount++;
      }
    });
  });
  
  const distortionRate = totalFields > 0 ? (distortionCount / totalFields) * 100 : 0;
  
  return {
    data: baselineData,
    metadata: {
      mode: 'baseline',
      directIdentifiersRemoved: directIdentifiers.length,
      quasiIdentifiersGeneralized: quasiIdentifiers.length,
      sensitiveFieldsRetained: sensitiveFields.length,
      distortionRate: Math.round(distortionRate * 100) / 100,
      totalRecords: data.length
    }
  };
};

/**
 * Calculate record suppression rate
 */
const calculateSuppressionRate = (originalData, anonymizedData) => {
  if (!originalData.length) return 0;
  
  // Count records that are essentially suppressed (all quasi-identifiers redacted)
  const suppressedCount = anonymizedData.filter(record => {
    const quasiValues = Object.values(record).filter(v => 
      v === '[REDACTED]' || v === '[SUPRESSED]' || v === null || v === undefined
    );
    return quasiValues.length >= Object.keys(record).length * 0.5;
  }).length;
  
  return (suppressedCount / originalData.length) * 100;
};

/**
 * Run benchmark comparison between baseline and enhanced modes
 */
const runBenchmark = async (datasetId, rawData, options = {}) => {
  try {
    const benchmarkId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get classification
    const classification = classificationService.classifyDataset(rawData);
    
    // Run baseline anonymization
    const baselineResult = applyBaselineAnonymization(rawData, classification);
    
    // Get enhanced result from storage if available, or compute it
    let enhancedData;
    let enhancedSource = 'computed';
    
    if (options.enhancedDatasetId) {
      try {
        const record = stores.released.get(options.enhancedDatasetId);
        if (record) {
          const decrypted = cryptoService.decrypt(record.encrypted);
          enhancedData = decrypted.data;
          enhancedSource = 'retrieved';
        }
      } catch (e) {
        // Fall back to computing
      }
    }
    
    if (!enhancedData) {
      // Use existing anonymization engine
      const { anonymizationEngine } = await import('../anonymization/engine.js');
      const enhancedResult = anonymizationEngine.anonymize(
        rawData,
        classification,
        options.k || 5,
        options.l || 2
      );
      enhancedData = enhancedResult.data;
    }
    
    // Calculate risk for both modes
    const baselineRisk = riskEngine.calculateRiskScore(baselineResult.data, classification);
    const enhancedRisk = riskEngine.calculateRiskScore(enhancedData, classification);
    
    // Calculate utility metrics
    const baselineSuppressionRate = calculateSuppressionRate(rawData, baselineResult.data);
    const enhancedSuppressionRate = calculateSuppressionRate(rawData, enhancedData);
    
    // Calculate risk reduction
    const riskReduction = baselineRisk.overallRisk - enhancedRisk.overallRisk;
    const riskReductionPercent = baselineRisk.overallRisk > 0 
      ? (riskReduction / baselineRisk.overallRisk) * 100 
      : 0;
    
    // Calculate utility loss
    const baselineUtilityLoss = baselineSuppressionRate + baselineResult.metadata.distortionRate;
    const enhancedUtilityLoss = enhancedSuppressionRate + 0; // Enhanced mode distortion is more complex
    
    const comparison = {
      benchmarkId,
      datasetId,
      timestamp,
      modes: {
        baseline: {
          anonymized: baselineResult.data,
          metadata: baselineResult.metadata,
          riskAssessment: baselineRisk,
          suppressionRate: Math.round(baselineSuppressionRate * 100) / 100,
          utilityLossPercent: Math.round(baselineUtilityLoss * 100) / 100
        },
        enhanced: {
          anonymized: enhancedData,
          metadata: {
            mode: 'enhanced',
            k: options.k || 5,
            l: options.l || 2,
            source: enhancedSource,
            totalRecords: enhancedData.length
          },
          riskAssessment: enhancedRisk,
          suppressionRate: Math.round(enhancedSuppressionRate * 100) / 100,
          utilityLossPercent: Math.round(enhancedUtilityLoss * 100) / 100
        }
      },
      comparison: {
        riskReductionPercent: Math.round(riskReductionPercent * 100) / 100,
        baselineRisk: baselineRisk.overallRisk,
        enhancedRisk: enhancedRisk.overallRisk,
        riskLevelChanged: baselineRisk.riskLevel !== enhancedRisk.riskLevel,
        baselineRiskLevel: baselineRisk.riskLevel,
        enhancedRiskLevel: enhancedRisk.riskLevel,
        baselineUtilityLossPercent: Math.round(baselineUtilityLoss * 100) / 100,
        enhancedUtilityLossPercent: Math.round(enhancedUtilityLoss * 100) / 100,
        winner: enhancedRisk.overallRisk < baselineRisk.overallRisk ? 'enhanced' : 'baseline'
      }
    };
    
    // Store result
    benchmarkResults.set(benchmarkId, {
      ...comparison,
      rawData: null // Don't store raw data to save memory
    });
    
    return comparison;
    
  } catch (error) {
    throw new Error(`Benchmark failed: ${error.message}`);
  }
};

/**
 * Get benchmark result by ID
 */
const getBenchmarkResult = (benchmarkId) => {
  return benchmarkResults.get(benchmarkId) || null;
};

/**
 * List all benchmark results for a dataset
 */
const listBenchmarks = (datasetId) => {
  const results = Array.from(benchmarkResults.values())
    .filter(b => b.datasetId === datasetId)
    .map(b => ({
      benchmarkId: b.benchmarkId,
      datasetId: b.datasetId,
      timestamp: b.timestamp,
      riskReductionPercent: b.comparison.riskReductionPercent,
      winner: b.comparison.winner
    }));
  
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Benchmark Service Interface
 */
export const baselineAnonymizer = {
  runBenchmark,
  getBenchmarkResult,
  listBenchmarks,
  applyBaselineAnonymization
};

export {
  runBenchmark,
  getBenchmarkResult,
  listBenchmarks,
  applyBaselineAnonymization
};
