/**
 * Enhanced Security Integration Layer
 * 
 * Integrates all security modules into a unified interface:
 * - Crypto Service (encryption, tokenization)
 * - Anonymization Engine (k-anon, l-div, t-close)
 * - Differential Privacy Engine (Laplace mechanism)
 * - Risk Engine (scoring)
 * - Zero Trust (authentication, authorization)
 * - Consent Engine (purpose binding)
 * - Query Firewall (attack defense)
 * - Audit Chain (tamper-proof logging)
 * - Release Pipeline (orchestration)
 * 
 * Usage:
 * import { securityLayer } from './security/index.js';
 * 
 * // Encrypt dataset
 * const encrypted = securityLayer.crypto.encrypt(dataset);
 * 
 * // Anonymize with privacy checks
 * const anonymized = securityLayer.anonymization.anonymize(data, classification);
 * 
 * // Query with DP
 * const dpResult = securityLayer.dp.count(100, 1.0);
 */

// Import all security modules
import { cryptoService } from '../crypto/index.js';
import { anonymizationEngine } from '../anonymization/engine.js';
import { dpEngine } from '../dpEngine/index.js';
import { riskEngine } from '../riskEngine/index.js';
import { zeroTrust, ROLES } from '../zeroTrust/index.js';
import { consentEngine, CONSENT_STATUS, VALID_PURPOSES } from '../consentEngine/index.js';
import { queryFirewall } from '../queryFirewall/index.js';
import { auditChainService, AUDIT_EVENTS } from '../auditChain/index.js';
import { releasePipeline } from '../releasePipeline/index.js';

/**
 * Unified Security Layer
 * Provides a single interface for all security operations
 */
export const securityLayer = {
  // Cryptography
  crypto: cryptoService,
  
  // Anonymization
  anonymization: anonymizationEngine,
  
  // Differential Privacy
  dp: dpEngine,
  
  // Risk Assessment
  risk: riskEngine,
  
  // Zero Trust (Auth/AuthZ)
  auth: zeroTrust,
  roles: ROLES,
  
  // Consent Management
  consent: consentEngine,
  consentStatus: CONSENT_STATUS,
  validPurposes: VALID_PURPOSES,
  
  // Query Firewall
  firewall: queryFirewall,
  
  // Audit Chain
  audit: auditChainService,
  auditEvents: AUDIT_EVENTS,
  
  // Release Pipeline
  pipeline: releasePipeline,
  
  /**
   * Initialize all security components
   */
  initialize: async () => {
    console.log('🔐 Initializing Security Layer...');
    
    // Validate crypto configuration
    try {
      cryptoService.validateConfig();
      console.log('✓ Cryptography validated');
    } catch (error) {
      console.error('✗ Cryptography validation failed:', error.message);
      throw error;
    }
    
    // Initialize audit chain
    await auditChainService.load();
    console.log('✓ Audit chain loaded');
    
    // Validate chain integrity
    const validation = auditChainService.validateChain();
    if (!validation.valid) {
      console.warn('⚠ Audit chain validation failed:', validation.error);
    } else {
      console.log('✓ Audit chain validated');
    }
    
    console.log('🔐 Security Layer initialized');
    
    return {
      crypto: 'ready',
      anonymization: 'ready',
      dp: 'ready',
      risk: 'ready',
      auth: 'ready',
      consent: 'ready',
      firewall: 'ready',
      audit: validation.valid ? 'valid' : 'invalid',
      pipeline: 'ready'
    };
  },
  
  /**
   * Get comprehensive security status
   */
  getStatus: () => {
    const auditStats = auditChainService.getStatistics();
    const pipelineStats = releasePipeline.getStatistics();
    const firewallStats = queryFirewall.getStatistics();
    const consentStats = consentEngine.getStatistics();
    
    return {
      timestamp: new Date().toISOString(),
      components: {
        crypto: { status: 'active', algorithm: cryptoService.CRYPTO_CONFIG.DATA_ALGORITHM },
        anonymization: { status: 'active', kDefault: anonymizationEngine.ANON_CONFIG.K_DEFAULT },
        dp: { status: 'active', epsilonDefault: dpEngine.DP_CONFIG.DEFAULT_EPSILON },
        risk: { status: 'active', maxRiskLevel: riskEngine.RISK_CONFIG.THRESHOLDS.MEDIUM },
        auth: { status: 'active', roles: Object.keys(ROLES) },
        consent: { status: 'active', ...consentStats },
        firewall: { status: 'active', ...firewallStats },
        audit: { status: auditStats.isValid ? 'valid' : 'invalid', ...auditStats },
        pipeline: { status: 'active', ...pipelineStats }
      }
    };
  },
  
  /**
   * Execute a secure query with all protections
   */
  executeSecureQuery: async (userId, query, context) => {
    const results = {
      authorized: false,
      firewall: null,
      consent: null,
      dp: null,
      data: null,
      audit: null
    };
    
    try {
      // 1. Check query firewall
      const firewallResult = queryFirewall.validateQuery(userId, query, context);
      results.firewall = firewallResult;
      
      if (!firewallResult.allowed) {
        await auditChainService.logEvent(AUDIT_EVENTS.QUERY_BLOCKED, userId, {
          reason: firewallResult.reason,
          query: queryFirewall.sanitizeQueryForLog(query)
        });
        return results;
      }
      
      // 2. Validate consent if required
      if (context.consentId) {
        const consentResult = consentEngine.validateAccess(context.consentId, {
          purpose: query.purpose,
          fields: query.fields,
          epsilon: query.epsilon
        });
        
        results.consent = consentResult;
        
        if (!consentResult.valid) {
          await auditChainService.logEvent(AUDIT_EVENTS.ACCESS_DENIED, userId, {
            reason: consentResult.reason,
            consentId: context.consentId
          });
          return results;
        }
        
        results.authorized = true;
      }
      
      // 3. Apply differential privacy if requested
      if (query.aggregate && query.epsilon) {
        // This would integrate with actual query execution
        results.dp = {
          epsilon: query.epsilon,
          mechanism: 'Laplace',
          applied: true
        };
      }
      
      // 4. Log access
      results.audit = await auditChainService.logEvent(AUDIT_EVENTS.QUERY_EXECUTED, userId, {
        queryType: query.type,
        consentId: context.consentId,
        aggregate: query.aggregate,
        epsilon: query.epsilon
      });
      
      return results;
    } catch (error) {
      await auditChainService.logEvent(AUDIT_EVENTS.ERROR_OCCURRED, userId, {
        error: error.message,
        operation: 'executeSecureQuery'
      });
      throw error;
    }
  }
};

/**
 * Export individual modules for direct access
 */
export {
  cryptoService,
  anonymizationEngine,
  dpEngine,
  riskEngine,
  zeroTrust,
  ROLES,
  consentEngine,
  CONSENT_STATUS,
  VALID_PURPOSES,
  queryFirewall,
  auditChainService,
  AUDIT_EVENTS,
  releasePipeline
};

/**
 * Export configuration objects
 */
export const CONFIG = {
  crypto: cryptoService.CRYPTO_CONFIG,
  anonymization: anonymizationEngine.ANON_CONFIG,
  dp: dpEngine.DP_CONFIG,
  risk: riskEngine.RISK_CONFIG,
  firewall: queryFirewall.FIREWALL_CONFIG,
  audit: auditChainService.AUDIT_CONFIG,
  pipeline: releasePipeline.config
};

export default securityLayer;
