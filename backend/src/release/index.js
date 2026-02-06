import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../storage/index.js';
import { classificationService } from '../classification/index.js';
import { anonymizationService } from '../anonymization/index.js';
import { consentService, CONSENT_STATUS } from '../consent/index.js';
import { riskService } from '../risk/index.js';

/**
 * Dataset Release Engine
 * 
 * Core pipeline:
 * Raw → Classified → Anonymized → Risk Scored → Consent Filter → Released Dataset
 * 
 * Only approved consents allowed.
 */

// Release status tracking
const releaseStatus = new Map();

/**
 * Release pipeline stages
 */
const PIPELINE_STAGES = {
  INGESTED: 'ingested',
  CLASSIFIED: 'classified',
  ANONYMIZED: 'anonymized',
  RISK_SCORED: 'risk_scored',
  CONSENT_CHECKED: 'consent_checked',
  APPROVED: 'approved',
  RELEASED: 'released'
};

/**
 * Release service
 */
export const releaseService = {
  /**
   * Initialize release pipeline for a dataset
   */
  initializePipeline: (datasetId, rawData, metadata = {}) => {
    const pipelineId = uuidv4();
    
    const pipeline = {
      id: pipelineId,
      datasetId,
      status: PIPELINE_STAGES.INGESTED,
      stages: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata
    };
    
    releaseStatus.set(pipelineId, pipeline);
    
    return pipeline;
  },
  
  /**
   * Execute full release pipeline
   */
  executePipeline: async (datasetId, rawData, consentId, customAnonStrategies = {}) => {
    const startTime = Date.now();
    const results = {
      pipelineId: null,
      stagesCompleted: [],
      errors: [],
      releasedDatasetId: null,
      riskAssessment: null
    };
    
    try {
      // Initialize pipeline
      const pipeline = releaseService.initializePipeline(datasetId, rawData);
      results.pipelineId = pipeline.id;
      
      // Stage 1: Classification
      console.log(`[Pipeline ${pipeline.id}] Stage 1: Classifying dataset...`);
      const classification = classificationService.classifyDataset(rawData);
      pipeline.stages.classification = classification;
      pipeline.status = PIPELINE_STAGES.CLASSIFIED;
      results.stagesCompleted.push('classification');
      
      // Stage 2: Anonymization
      console.log(`[Pipeline ${pipeline.id}] Stage 2: Applying anonymization...`);
      const consent = consentService.getConsent(consentId);
      const allowedFields = consent?.allowedFields || null;
      
      const anonymizedData = anonymizationService.anonymizeDataset(
        rawData,
        classification,
        allowedFields,
        customAnonStrategies
      );
      
      pipeline.stages.anonymization = {
        recordCount: anonymizedData.length,
        strategies: customAnonStrategies,
        appliedAt: new Date().toISOString()
      };
      pipeline.status = PIPELINE_STAGES.ANONYMIZED;
      results.stagesCompleted.push('anonymization');
      
      // Stage 3: Risk Scoring
      console.log(`[Pipeline ${pipeline.id}] Stage 3: Computing risk scores...`);
      const riskAssessment = riskService.assessDataset(
        anonymizedData,
        classification
      );
      
      pipeline.stages.riskAssessment = riskAssessment;
      pipeline.status = PIPELINE_STAGES.RISK_SCORED;
      results.riskAssessment = riskAssessment;
      results.stagesCompleted.push('risk_scoring');
      
      // Stage 4: Consent Validation
      console.log(`[Pipeline ${pipeline.id}] Stage 4: Validating consent...`);
      if (!consent) {
        throw new Error('Consent not found');
      }
      
      if (consent.status !== CONSENT_STATUS.APPROVED) {
        throw new Error(`Consent status is ${consent.status}, not approved`);
      }
      
      // Validate risk score against consent
      if (consent.riskScore && riskAssessment.overallRisk !== consent.riskScore) {
        console.warn(`[Pipeline ${pipeline.id}] Risk score mismatch: computed ${riskAssessment.overallRisk}, consent allows ${consent.riskScore}`);
      }
      
      pipeline.stages.consentValidation = {
        consentId,
        validatedAt: new Date().toISOString(),
        valid: true
      };
      pipeline.status = PIPELINE_STAGES.CONSENT_CHECKED;
      results.stagesCompleted.push('consent_validation');
      
      // Stage 5: Release
      console.log(`[Pipeline ${pipeline.id}] Stage 5: Releasing dataset...`);
      const releaseId = uuidv4();
      
      const releaseMetadata = {
        originalDatasetId: datasetId,
        consentId,
        pipelineId: pipeline.id,
        classification,
        riskAssessment,
        releasedAt: new Date().toISOString(),
        allowedFields,
        anonymizationStrategies: customAnonStrategies,
        researcherId: consent.researcherId,
        purpose: consent.purpose
      };
      
      // Store released dataset
      storageService.storeReleased(releaseId, anonymizedData, releaseMetadata);
      
      pipeline.stages.release = {
        releaseId,
        releasedAt: new Date().toISOString(),
        researcherId: consent.researcherId
      };
      pipeline.status = PIPELINE_STAGES.RELEASED;
      results.releasedDatasetId = releaseId;
      results.stagesCompleted.push('release');
      
      // Update pipeline record
      pipeline.updatedAt = new Date().toISOString();
      releaseStatus.set(pipeline.id, pipeline);
      
      console.log(`[Pipeline ${pipeline.id}] Pipeline completed in ${Date.now() - startTime}ms`);
      
      return {
        success: true,
        ...results,
        pipeline,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      results.errors.push(error.message);
      console.error(`[Pipeline ${results.pipelineId}] Pipeline failed:`, error.message);
      
      return {
        success: false,
        ...results,
        error: error.message
      };
    }
  },
  
  /**
   * Get pipeline status
   */
  getPipelineStatus: (pipelineId) => {
    return releaseStatus.get(pipelineId) || null;
  },
  
  /**
   * Get released dataset
   */
  getReleasedDataset: (releaseId) => {
    try {
      return storageService.retrieveReleased(releaseId);
    } catch (error) {
      return null;
    }
  },
  
  /**
   * Get release metadata
   */
  getReleaseMetadata: (releaseId) => {
    // Find in released store
    const released = storageService.stores?.released;
    if (!released) return null;
    
    const record = released.get(releaseId);
    return record?.metadata || null;
  },
  
  /**
   * List all releases for a researcher
   */
  listReleasesByResearcher: (researcherId) => {
    const releases = [];
    const released = storageService.stores?.released;
    
    if (!released) return releases;
    
    released.forEach((record, releaseId) => {
      if (record.metadata?.researcherId === researcherId) {
        releases.push({
          releaseId,
          ...record.metadata
        });
      }
    });
    
    return releases;
  },
  
  /**
   * List all releases (admin only)
   */
  listAllReleases: () => {
    const releases = [];
    const released = storageService.stores?.released;
    
    if (!released) return releases;
    
    released.forEach((record, releaseId) => {
      releases.push({
        releaseId,
        ...record.metadata
      });
    });
    
    return releases;
  },
  
  PIPELINE_STAGES
};

export { PIPELINE_STAGES };
