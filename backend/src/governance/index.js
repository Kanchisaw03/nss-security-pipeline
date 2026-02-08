/**
 * Governance Integration Module
 * 
 * Integrates governance modules into the release pipeline:
 * - Benchmark mode (baseline vs enhanced)
 * - Attack simulation
 * - Privacy-utility report generation
 * - Privacy-utility curve generation
 * 
 * Called after "Release" stage in the pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import { baselineAnonymizer } from '../benchmarkMode/baselineAnonymizer.js';
import { privacyUtilityReport } from '../reporting/privacyUtilityReport.js';
import { attackSimulation } from '../attackSimulation/index.js';
import { privacyUtilityCurve } from './privacyUtilityCurve.js';
import { dpdpCompliance } from '../compliance/dpdpMap.js';
import { storageService, stores } from '../storage/index.js';
import { cryptoService } from '../crypto/index.js';

// Store governance results
const governanceResults = new Map();

/**
 * Execute governance pipeline after release
 * 
 * Flow:
 * 1. Determine mode (baseline vs enhanced)
 * 2. Run appropriate anonymization
 * 3. Run attack simulation
 * 4. Generate privacy-utility report
 * 5. Generate privacy-utility curve
 * 6. Store report
 */
const executeGovernancePipeline = async (releaseId, datasetId, rawData, classification, options = {}) => {
  try {
    const governanceId = uuidv4();
    const timestamp = new Date().toISOString();
    const mode = options.mode || 'enhanced';
    
    const result = {
      governanceId,
      releaseId,
      datasetId,
      timestamp,
      mode,
      stages: []
    };
    
    // Stage 1: Run benchmark comparison
    let benchmarkResult = null;
    let baselineData = null;
    let enhancedData = null;
    
    try {
      if (mode === 'baseline') {
        // Apply baseline anonymization
        const baselineResult = baselineAnonymizer.applyBaselineAnonymization(rawData, classification);
        baselineData = baselineResult.data;
        
        result.stages.push({
          stage: 'anonymization',
          mode: 'baseline',
          status: 'completed',
          metadata: baselineResult.metadata
        });
      } else {
        // Run full benchmark comparison
        benchmarkResult = await baselineAnonymizer.runBenchmark(datasetId, rawData, {
          enhancedDatasetId: releaseId,
          k: options.k || 5,
          l: options.l || 2
        });
        
        baselineData = benchmarkResult.modes.baseline.anonymized;
        enhancedData = benchmarkResult.modes.enhanced.anonymized;
        
        result.stages.push({
          stage: 'benchmark',
          status: 'completed',
          comparison: benchmarkResult.comparison
        });
      }
      
      // Use appropriate data for downstream analysis
      const analysisData = mode === 'baseline' ? baselineData : enhancedData;
      
      // Stage 2: Run attack simulation
      let attackResult = null;
      try {
        attackResult = attackSimulation.runAllAttacks(
          analysisData,
          null, // No auxiliary data provided, use same dataset
          classification
        );
        
        result.stages.push({
          stage: 'attack_simulation',
          status: 'completed',
          attackRiskScore: attackResult.summary?.compositeRiskScore,
          riskLevel: attackResult.summary?.riskLevel
        });
      } catch (attackError) {
        result.stages.push({
          stage: 'attack_simulation',
          status: 'failed',
          error: attackError.message
        });
      }
      
      // Stage 3: Generate privacy-utility report
      let reportResult = null;
      try {
        // Need both baseline and enhanced for comparison
        if (!baselineData || !enhancedData) {
          // If only one mode, use same data for both (degraded comparison)
          const fallbackData = baselineData || enhancedData || analysisData;
          reportResult = await privacyUtilityReport.generateReport(
            rawData,
            fallbackData,
            fallbackData,
            { k: options.k || 5, l: options.l || 2 }
          );
        } else {
          reportResult = await privacyUtilityReport.generateReport(
            rawData,
            baselineData,
            enhancedData,
            { k: options.k || 5, l: options.l || 2 }
          );
        }
        
        result.stages.push({
          stage: 'privacy_utility_report',
          status: 'completed',
          reportId: reportResult.reportId,
          recommendation: reportResult.recommendations?.preferredMode
        });
      } catch (reportError) {
        result.stages.push({
          stage: 'privacy_utility_report',
          status: 'failed',
          error: reportError.message
        });
      }
      
      // Stage 4: Generate privacy-utility curve
      let curveResult = null;
      try {
        curveResult = await privacyUtilityCurve.generateCurve(
          datasetId,
          analysisData,
          classification,
          { epsilons: [0.1, 0.5, 1.0] }
        );
        
        result.stages.push({
          stage: 'privacy_utility_curve',
          status: 'completed',
          curveId: curveResult.curveId,
          optimalEpsilon: curveResult.optimal?.epsilon
        });
      } catch (curveError) {
        result.stages.push({
          stage: 'privacy_utility_curve',
          status: 'failed',
          error: curveError.message
        });
      }
      
      // Stage 5: Validate DPDP compliance
      let complianceResult = null;
      try {
        complianceResult = dpdpCompliance.validateReleaseCompliance(releaseId, options.consentId);
        
        result.stages.push({
          stage: 'compliance_validation',
          status: 'completed',
          dpdpCompliant: complianceResult.dpdpCompliant,
          complianceStatus: complianceResult.complianceStatus
        });
      } catch (complianceError) {
        result.stages.push({
          stage: 'compliance_validation',
          status: 'failed',
          error: complianceError.message
        });
      }
      
      // Compile final result
      result.summary = {
        mode,
        datasetSize: rawData.length,
        stagesCompleted: result.stages.filter(s => s.status === 'completed').length,
        stagesFailed: result.stages.filter(s => s.status === 'failed').length,
        attackRiskLevel: attackResult?.summary?.riskLevel || 'unknown',
        reportRecommendation: reportResult?.recommendations?.preferredMode || 'unknown',
        optimalEpsilon: curveResult?.optimal?.epsilon,
        complianceStatus: complianceResult?.complianceStatus || 'unknown'
      };
      
      // Store governance result
      governanceResults.set(governanceId, {
        ...result,
        rawData: null, // Don't store raw data
        reportId: reportResult?.reportId,
        attackId: attackResult?.attackId,
        curveId: curveResult?.curveId
      });
      
      return result;
      
    } catch (pipelineError) {
      result.status = 'failed';
      result.error = pipelineError.message;
      
      governanceResults.set(governanceId, result);
      
      throw pipelineError;
    }
    
  } catch (error) {
    throw new Error(`Governance pipeline failed: ${error.message}`);
  }
};

/**
 * Get governance result by ID
 */
const getGovernanceResult = (governanceId) => {
  return governanceResults.get(governanceId) || null;
};

/**
 * Get governance results for a release
 */
const getGovernanceByRelease = (releaseId) => {
  const results = Array.from(governanceResults.values())
    .filter(g => g.releaseId === releaseId)
    .map(g => ({
      governanceId: g.governanceId,
      releaseId: g.releaseId,
      timestamp: g.timestamp,
      mode: g.mode,
      summary: g.summary
    }));
  
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * List all governance results with optional filters
 */
const listGovernanceResults = (filters = {}) => {
  let results = Array.from(governanceResults.values());
  
  if (filters.datasetId) {
    results = results.filter(g => g.datasetId === filters.datasetId);
  }
  
  if (filters.mode) {
    results = results.filter(g => g.mode === filters.mode);
  }
  
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Get full governance dashboard data for a release
 */
const getGovernanceDashboard = (releaseId) => {
  const governanceList = getGovernanceByRelease(releaseId);
  
  if (governanceList.length === 0) {
    return null;
  }
  
  const latest = governanceList[0];
  const fullResult = getGovernanceResult(latest.governanceId);
  
  return {
    releaseId,
    governanceId: latest.governanceId,
    timestamp: latest.timestamp,
    mode: latest.mode,
    summary: latest.summary,
    stages: fullResult?.stages || [],
    detailedReports: {
      privacyUtilityReport: fullResult?.reportId,
      attackSimulation: fullResult?.attackId,
      privacyUtilityCurve: fullResult?.curveId
    }
  };
};

/**
 * Governance Integration Interface
 */
export const governanceIntegration = {
  executeGovernancePipeline,
  getGovernanceResult,
  getGovernanceByRelease,
  listGovernanceResults,
  getGovernanceDashboard
};

export {
  executeGovernancePipeline,
  getGovernanceResult,
  getGovernanceByRelease,
  listGovernanceResults,
  getGovernanceDashboard
};
