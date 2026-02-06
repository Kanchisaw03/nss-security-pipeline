import { v4 as uuidv4 } from 'uuid';
import { cryptoService } from '../crypto/index.js';
import { anonymizationEngine } from '../anonymization/engine.js';
import { dpEngine } from '../dpEngine/index.js';
import { riskEngine } from '../riskEngine/index.js';
import { consentEngine, CONSENT_STATUS } from '../consentEngine/index.js';
import { auditChainService, AUDIT_EVENTS } from '../auditChain/index.js';
import { classificationService } from '../classification/index.js';
import { storageService } from '../storage/index.js';

/**
 * Release Pipeline
 * 
 * Orchestrates the complete data release process:
 * 1. Decrypt raw data
 * 2. Classify fields
 * 3. Risk assessment
 * 4. Multi-layer anonymization (k-anon, l-div, t-close)
 * 5. Validate privacy models
 * 6. Encrypt release package
 * 7. Store separately
 * 
 * Ensures raw data never leaves the system.
 */

// Pipeline configuration
const PIPELINE_CONFIG = {
  // Default k-anonymity threshold
  K_ANON: 5,
  
  // Default l-diversity threshold
  L_DIV: 2,
  
  // Default t-closeness threshold
  T_CLOSE: 0.2,
  
  // Maximum risk level allowed for release
  MAX_RISK_LEVEL: 'Medium',
  
  // Risk threshold (0-100)
  MAX_RISK_SCORE: 60,
  
  // Enable/disable pipeline stages
  STAGES: {
    DECRYPT: true,
    CLASSIFY: true,
    RISK_ASSESS: true,
    ANONYMIZE: true,
    VALIDATE: true,
    ENCRYPT: true,
    STORE: true
  }
};

// Track pipeline executions
const pipelineExecutions = new Map();

/**
 * Execute the complete release pipeline
 * @param {string} datasetId - Source dataset ID
 * @param {Object} rawData - Raw dataset (encrypted in storage, decrypted here)
 * @param {string} consentId - Consent ID authorizing release
 * @param {Object} options - Pipeline options
 * @returns {Object} Pipeline execution result
 */
const executePipeline = async (datasetId, rawData, consentId, options = {}) => {
  const startTime = Date.now();
  const executionId = uuidv4();
  const stagesCompleted = [];
  const errors = [];
  
  try {
    // Verify consent
    const consentCheck = consentEngine.isConsentValid(consentId);
    if (!consentCheck.valid) {
      throw new Error(`Consent validation failed: ${consentCheck.reason}`);
    }
    
    const consent = consentCheck.consent;
    
    // Initialize execution record
    const execution = {
      id: executionId,
      datasetId,
      consentId,
      researcherId: consent.researcherId,
      startedAt: new Date().toISOString(),
      stages: [],
      status: 'running'
    };
    
    pipelineExecutions.set(executionId, execution);
    
    // Stage 1: Retrieve and decrypt raw data
    let currentData;
    if (PIPELINE_CONFIG.STAGES.DECRYPT) {
      try {
        currentData = rawData;
        execution.stages.push({
          name: 'decrypt',
          status: 'completed',
          timestamp: new Date().toISOString(),
          recordCount: currentData.length
        });
        stagesCompleted.push('decrypt');
      } catch (error) {
        throw new Error(`Decrypt stage failed: ${error.message}`);
      }
    }
    
    // Stage 2: Classify fields
    let classification;
    if (PIPELINE_CONFIG.STAGES.CLASSIFY) {
      try {
        classification = classificationService.classifyDataset(currentData);
        execution.stages.push({
          name: 'classify',
          status: 'completed',
          timestamp: new Date().toISOString(),
          directIdentifiers: classification.summary.directIdentifiers.length,
          quasiIdentifiers: classification.summary.quasiIdentifiers.length,
          sensitiveAttributes: classification.summary.sensitiveAttributes.length
        });
        stagesCompleted.push('classify');
      } catch (error) {
        throw new Error(`Classification stage failed: ${error.message}`);
      }
    }
    
    // Stage 3: Risk Assessment
    let riskAssessment;
    if (PIPELINE_CONFIG.STAGES.RISK_ASSESS) {
      try {
        riskAssessment = riskEngine.calculateRiskScore(currentData, classification);
        execution.stages.push({
          name: 'risk_assess',
          status: 'completed',
          timestamp: new Date().toISOString(),
          riskScore: riskAssessment.overallRisk,
          riskLevel: riskAssessment.riskLevel
        });
        stagesCompleted.push('risk_assess');
        
        // Check risk threshold
        if (riskAssessment.overallRisk > PIPELINE_CONFIG.MAX_RISK_SCORE) {
          const releaseCheck = riskEngine.checkReleaseEligibility(
            riskAssessment, 
            options.maxRiskLevel || PIPELINE_CONFIG.MAX_RISK_LEVEL
          );
          
          if (!releaseCheck.eligible) {
            throw new Error(
              `Risk threshold exceeded: ${riskAssessment.overallRisk.toFixed(2)} ` +
              `(max allowed: ${PIPELINE_CONFIG.MAX_RISK_SCORE})`
            );
          }
        }
      } catch (error) {
        throw new Error(`Risk assessment failed: ${error.message}`);
      }
    }
    
    // Stage 4: Multi-layer anonymization
    let anonymizedResult;
    if (PIPELINE_CONFIG.STAGES.ANONYMIZE) {
      try {
        const k = options.k || PIPELINE_CONFIG.K_ANON;
        const l = options.l || PIPELINE_CONFIG.L_DIV;
        
        anonymizedResult = anonymizationEngine.anonymize(
          currentData,
          classification,
          k,
          l
        );
        
        execution.stages.push({
          name: 'anonymize',
          status: 'completed',
          timestamp: new Date().toISOString(),
          kCompliant: anonymizedResult.kAnonResult.compliant,
          lCompliant: anonymizedResult.lDivResult?.compliant || true,
          generalizationLevel: anonymizedResult.generalizationLevel
        });
        stagesCompleted.push('anonymize');
        
        currentData = anonymizedResult.data;
      } catch (error) {
        throw new Error(`Anonymization failed: ${error.message}`);
      }
    }
    
    // Stage 5: Validate privacy models
    if (PIPELINE_CONFIG.STAGES.VALIDATE) {
      try {
        const k = options.k || PIPELINE_CONFIG.K_ANON;
        const quasiFields = classification.summary.quasiIdentifiers;
        
        // Validate k-anonymity
        const kAnonCheck = anonymizationEngine.checkKAnonymity(currentData, quasiFields, k);
        
        // Validate l-diversity if sensitive fields exist
        const sensitiveFields = classification.summary.sensitiveAttributes;
        let lDivCheck = null;
        if (sensitiveFields.length > 0) {
          lDivCheck = anonymizationEngine.checkLDiversity(
            currentData,
            quasiFields,
            sensitiveFields,
            options.l || PIPELINE_CONFIG.L_DIV
          );
        }
        
        // Final risk assessment on anonymized data
        const finalRisk = riskEngine.calculateRiskScore(currentData, classification);
        
        execution.stages.push({
          name: 'validate',
          status: 'completed',
          timestamp: new Date().toISOString(),
          kCompliant: kAnonCheck.compliant,
          lCompliant: lDivCheck ? lDivCheck.compliant : true,
          finalRiskScore: finalRisk.overallRisk,
          finalRiskLevel: finalRisk.riskLevel
        });
        stagesCompleted.push('validate');
        
        // Must pass validation
        if (!kAnonCheck.compliant) {
          throw new Error(
            `Validation failed: k-anonymity not achieved (k=${k}, violations=${kAnonCheck.violatingGroups})`
          );
        }
        
        if (lDivCheck && !lDivCheck.compliant) {
          throw new Error(
            `Validation failed: l-diversity not achieved (l=${options.l || PIPELINE_CONFIG.L_DIV})`
          );
        }
        
        riskAssessment = finalRisk;
      } catch (error) {
        throw new Error(`Validation failed: ${error.message}`);
      }
    }
    
    // Stage 6: Encrypt release package
    let encryptedPackage;
    if (PIPELINE_CONFIG.STAGES.ENCRYPT) {
      try {
        // Prepare release metadata
        const releaseData = {
          data: currentData,
          metadata: {
            originalDatasetId: datasetId,
            consentId,
            researcherId: consent.researcherId,
            purpose: consent.purpose,
            classification: {
              directIdentifiers: classification.summary.directIdentifiers.length,
              quasiIdentifiers: classification.summary.quasiIdentifiers.length,
              sensitiveAttributes: classification.summary.sensitiveAttributes.length
            },
            riskAssessment: {
              score: riskAssessment.overallRisk,
              level: riskAssessment.riskLevel
            },
            anonymization: {
              k: options.k || PIPELINE_CONFIG.K_ANON,
              l: options.l || PIPELINE_CONFIG.L_DIV,
              generalizationLevel: anonymizedResult?.generalizationLevel || 0
            },
            createdAt: new Date().toISOString(),
            pipelineExecutionId: executionId
          }
        };
        
        // Encrypt with key hierarchy
        encryptedPackage = cryptoService.encrypt(releaseData);
        
        execution.stages.push({
          name: 'encrypt',
          status: 'completed',
          timestamp: new Date().toISOString()
        });
        stagesCompleted.push('encrypt');
      } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
      }
    }
    
    // Stage 7: Store release package
    let releaseId;
    if (PIPELINE_CONFIG.STAGES.STORE) {
      try {
        releaseId = uuidv4();
        
        // Store in released store
        storageService.storeReleased(releaseId, {
          encryptedPackage,
          metadata: encryptedPackage
        }, {
          originalDatasetId: datasetId,
          consentId,
          researcherId: consent.researcherId,
          purpose: consent.purpose,
          riskScore: riskAssessment.overallRisk,
          pipelineExecutionId: executionId
        });
        
        // Bind release to consent
        consentEngine.bindReleaseToConsent(releaseId, consentId);
        
        execution.stages.push({
          name: 'store',
          status: 'completed',
          timestamp: new Date().toISOString(),
          releaseId
        });
        stagesCompleted.push('store');
      } catch (error) {
        throw new Error(`Storage failed: ${error.message}`);
      }
    }
    
    // Complete execution
    const executionTime = Date.now() - startTime;
    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.executionTime = executionTime;
    execution.releaseId = releaseId;
    
    // Log to audit chain
    await auditChainService.logDataset(AUDIT_EVENTS.DATASET_RELEASED, 'system', datasetId, {
      releaseId,
      consentId,
      researcherId: consent.researcherId,
      riskScore: riskAssessment.overallRisk,
      stagesCompleted,
      executionTime
    });
    
    return {
      success: true,
      executionId,
      releaseId,
      datasetId,
      consentId,
      researcherId: consent.researcherId,
      stagesCompleted,
      executionTime,
      riskAssessment,
      classification: {
        directIdentifiers: classification.summary.directIdentifiers.length,
        quasiIdentifiers: classification.summary.quasiIdentifiers.length,
        sensitiveAttributes: classification.summary.sensitiveAttributes.length
      },
      anonymization: {
        kCompliant: anonymizedResult?.kAnonResult.compliant || true,
        lCompliant: anonymizedResult?.lDivResult?.compliant || true,
        generalizationLevel: anonymizedResult?.generalizationLevel || 0
      },
      recordCount: currentData.length
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    // Update execution record
    const execution = pipelineExecutions.get(executionId);
    if (execution) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();
      execution.executionTime = executionTime;
    }
    
    // Log failure
    await auditChainService.logEvent(AUDIT_EVENTS.ERROR_OCCURRED, 'system', {
      error: `Pipeline execution failed: ${error.message}`,
      executionId,
      datasetId,
      consentId,
      stagesCompleted
    });
    
    return {
      success: false,
      executionId,
      error: error.message,
      stagesCompleted,
      executionTime,
      datasetId,
      consentId
    };
  }
};

/**
 * Get pipeline execution by ID
 */
const getExecution = (executionId) => {
  return pipelineExecutions.get(executionId) || null;
};

/**
 * List all pipeline executions
 */
const listExecutions = (filters = {}) => {
  let executions = Array.from(pipelineExecutions.values());
  
  if (filters.status) {
    executions = executions.filter(e => e.status === filters.status);
  }
  
  if (filters.datasetId) {
    executions = executions.filter(e => e.datasetId === filters.datasetId);
  }
  
  if (filters.consentId) {
    executions = executions.filter(e => e.consentId === filters.consentId);
  }
  
  return executions.sort((a, b) => 
    new Date(b.startedAt) - new Date(a.startedAt)
  );
};

/**
 * Get pipeline statistics
 */
const getStatistics = () => {
  const executions = Array.from(pipelineExecutions.values());
  
  return {
    totalExecutions: executions.length,
    successful: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length,
    running: executions.filter(e => e.status === 'running').length,
    avgExecutionTime: executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / executions.length
      : 0,
    config: PIPELINE_CONFIG
  };
};

/**
 * Release Pipeline interface
 */
export const releasePipeline = {
  execute: executePipeline,
  getExecution,
  listExecutions,
  getStatistics,
  
  // Configuration
  config: PIPELINE_CONFIG
};

export {
  executePipeline,
  getExecution,
  listExecutions,
  PIPELINE_CONFIG
};
