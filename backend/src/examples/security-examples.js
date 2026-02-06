/**
 * Integration Examples and Usage Guide
 * 
 * This file demonstrates how to use all security modules together.
 * These are examples, not actual routes.
 */

import { securityLayer } from './security/index.js';

const examples = {
  
  /**
   * Example 1: Complete Data Ingestion Flow
   */
  async dataIngestionFlow() {
    console.log('=== Example 1: Data Ingestion ===\n');
    
    // Sample dataset
    const dataset = [
      { id: 1, name: 'John Doe', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 2, name: 'Jane Smith', age: 28, zip: '12346', income: 82000, condition: 'hypertension' },
      { id: 3, name: 'Bob Johnson', age: 42, zip: '12345', income: 68000, condition: 'diabetes' },
      // ... more records
    ];
    
    // Step 1: Encrypt dataset with key hierarchy (DEK/KEK)
    console.log('Step 1: Encrypting dataset...');
    const encryptedPackage = securityLayer.crypto.encrypt(dataset);
    console.log('✓ Encrypted with AES-256-GCM');
    console.log('  - DEK encrypted with KEK (AES-256-ECB)');
    console.log('  - IV:', encryptedPackage.iv);
    console.log('  - Auth Tag:', encryptedPackage.authTag.substring(0, 20) + '...');
    
    // Step 2: Store encrypted data
    console.log('\nStep 2: Storing encrypted data...');
    // storageService.storeRaw(datasetId, encryptedPackage, metadata);
    console.log('✓ Stored securely');
    
    return encryptedPackage;
  },
  
  /**
   * Example 2: Classification and Risk Assessment
   */
  async classificationAndRisk() {
    console.log('\n=== Example 2: Classification & Risk Assessment ===\n');
    
    const sampleData = [
      { id: 1, name: 'Alice', age: 35, zip: '12345', income: 75000, disease: 'flu' },
      { id: 2, name: 'Bob', age: 35, zip: '12345', income: 75000, disease: 'cold' },
      { id: 3, name: 'Charlie', age: 42, zip: '67890', income: 90000, disease: 'flu' }
    ];
    
    // Classify fields
    console.log('Classifying fields...');
    const classification = {
      fields: {
        id: { type: 'direct', confidence: 1.0 },
        name: { type: 'direct', confidence: 1.0 },
        age: { type: 'quasi', confidence: 0.9 },
        zip: { type: 'quasi', confidence: 0.95 },
        income: { type: 'quasi', confidence: 0.8 },
        disease: { type: 'sensitive', confidence: 0.9 }
      }
    };
    
    console.log('Classification Results:');
    console.log('  Direct Identifiers: id, name');
    console.log('  Quasi-Identifiers: age, zip, income');
    console.log('  Sensitive: disease');
    
    // Calculate risk
    console.log('\nCalculating risk score...');
    const riskAssessment = securityLayer.risk.calculateRiskScore(sampleData, classification);
    
    console.log('Risk Assessment:');
    console.log(`  Overall Risk: ${riskAssessment.overallRisk}/100`);
    console.log(`  Risk Level: ${riskAssessment.riskLevel}`);
    console.log('  Component Scores:');
    console.log(`    - Uniqueness: ${riskAssessment.componentScores.uniquenessScore}`);
    console.log(`    - k-Violations: ${riskAssessment.componentScores.kViolationScore}`);
    console.log(`    - Rare Values: ${riskAssessment.componentScores.rareSensitiveScore}`);
    console.log('  Recommendations:');
    riskAssessment.recommendations.forEach(rec => console.log(`    - ${rec}`));
    
    return { classification, riskAssessment };
  },
  
  /**
   * Example 3: Multi-Layer Anonymization
   */
  async multiLayerAnonymization() {
    console.log('\n=== Example 3: Multi-Layer Anonymization ===\n');
    
    const data = [
      { id: 1, name: 'John Doe', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 2, name: 'Jane Smith', age: 38, zip: '12346', income: 82000, condition: 'hypertension' },
      { id: 3, name: 'Bob Johnson', age: 42, zip: '12345', income: 68000, condition: 'diabetes' },
      { id: 4, name: 'Alice Brown', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 5, name: 'Charlie Wilson', age: 45, zip: '12347', income: 95000, condition: 'asthma' }
    ];
    
    const classification = {
      fields: {
        id: { type: 'direct' },
        name: { type: 'direct' },
        age: { type: 'quasi' },
        zip: { type: 'quasi' },
        income: { type: 'quasi' },
        condition: { type: 'sensitive' }
      }
    };
    
    console.log('Applying anonymization (k=5, l=2)...');
    
    // Apply anonymization
    const result = securityLayer.anonymization.anonymize(data, classification, 5, 2);
    
    console.log('Step 1 - Direct Identifiers:');
    console.log('  ✓ Tokenized/Suppressed: id, name');
    
    console.log('\nStep 2 - Generalization:');
    console.log('  Age → Decade buckets');
    console.log('  ZIP → 3-digit prefix');
    console.log('  Income → Low/Medium/High');
    
    console.log('\nStep 3 - k-Anonymity Check:');
    console.log(`  k=5, Compliant: ${result.kAnonResult.compliant}`);
    console.log(`  Groups: ${result.kAnonResult.totalGroups}`);
    console.log(`  Violations: ${result.kAnonResult.violatingGroups}`);
    
    console.log('\nStep 4 - l-Diversity Check:');
    if (result.lDivResult) {
      console.log(`  l=2, Compliant: ${result.lDivResult.compliant}`);
    }
    
    console.log('\nAnonymized Sample:');
    console.log(result.data[0]);
    
    return result;
  },
  
  /**
   * Example 4: Differential Privacy Queries
   */
  async differentialPrivacyQueries() {
    console.log('\n=== Example 4: Differential Privacy ===\n');
    
    const datasetSize = 10000;
    const epsilon = 1.0;
    
    console.log(`Dataset size: ${datasetSize}, Epsilon: ${epsilon}`);
    
    // DP Count
    console.log('\n1. DP Count Query:');
    const countResult = securityLayer.dp.count(datasetSize, epsilon);
    console.log(`   True count: ${countResult.trueValue}`);
    console.log(`   DP count: ${countResult.noisyValue}`);
    console.log(`   Noise: ${countResult.noise}`);
    console.log(`   Scale (b): ${countResult.scale}`);
    console.log(`   Privacy: ${countResult.privacyGuarantee}`);
    
    // DP Sum
    console.log('\n2. DP Sum Query:');
    const sumResult = securityLayer.dp.sum(1000000, epsilon, 100000);
    console.log(`   True sum: $${sumResult.trueValue.toLocaleString()}`);
    console.log(`   DP sum: $${sumResult.noisyValue.toLocaleString()}`);
    console.log(`   Noise: $${parseFloat(sumResult.noise).toLocaleString()}`);
    
    // DP Mean
    console.log('\n3. DP Mean Query:');
    const meanResult = securityLayer.dp.mean(50000, datasetSize, epsilon);
    console.log(`   True mean: $${meanResult.trueValue.toLocaleString()}`);
    console.log(`   DP mean: $${meanResult.noisyValue.toLocaleString()}`);
    console.log(`   Noise: $${parseFloat(meanResult.noise).toLocaleString()}`);
    
    // DP Histogram
    console.log('\n4. DP Histogram Query:');
    const bins = {
      '0-25': 1500,
      '26-50': 3500,
      '51-75': 3000,
      '76-100': 2000
    };
    const histResult = securityLayer.dp.histogram(bins, epsilon);
    console.log(`   Bins: ${Object.keys(histResult.bins).length}`);
    console.log(`   Epsilon per bin: ${histResult.epsilonPerBin}`);
    Object.entries(histResult.bins).forEach(([bin, data]) => {
      console.log(`   ${bin}: ${data.trueCount} → ${data.noisyCount} (noise: ${data.noise})`);
    });
    
    return { countResult, sumResult, meanResult, histResult };
  },
  
  /**
   * Example 5: Zero Trust Security Flow
   */
  async zeroTrustFlow() {
    console.log('\n=== Example 5: Zero Trust Security ===\n');
    
    const userId = 'researcher@example.com';
    
    // Step 1: Generate JWT
    console.log('Step 1: Generating JWT...');
    const token = securityLayer.auth.generateToken(userId, 'researcher', {
      purpose: 'statistical_analysis',
      department: 'public_health'
    });
    console.log('✓ JWT generated');
    console.log(`  Token: ${token.substring(0, 50)}...`);
    
    // Step 2: Verify token
    console.log('\nStep 2: Verifying token...');
    const verification = securityLayer.auth.verifyToken(token);
    console.log(`✓ Token valid: ${verification.valid}`);
    if (verification.valid) {
      console.log(`  User: ${verification.decoded.userId}`);
      console.log(`  Role: ${verification.decoded.role}`);
      console.log(`  Purpose: ${verification.decoded.purpose}`);
    }
    
    // Step 3: Check role
    console.log('\nStep 3: Checking role authorization...');
    const roleCheck = securityLayer.auth.checkRole('researcher', ['admin', 'researcher']);
    console.log(`✓ Role authorized: ${roleCheck.allowed}`);
    
    // Step 4: Rate limit check
    console.log('\nStep 4: Checking rate limits...');
    const rateCheck = securityLayer.auth.checkRateLimit(userId, { ip: '192.168.1.1' });
    console.log(`✓ Rate limit OK: ${rateCheck.allowed}`);
    
    return { token, verification };
  },
  
  /**
   * Example 6: Purpose-Bound Consent
   */
  async consentManagement() {
    console.log('\n=== Example 6: Purpose-Bound Consent ===\n');
    
    const researcherId = 'researcher@example.com';
    
    // Step 1: Request consent
    console.log('Step 1: Requesting consent...');
    const consent = await securityLayer.consent.requestConsent(
      researcherId,
      'statistical_analysis',
      ['age', 'zip', 'income', 'condition'],
      {
        datasetId: 'dataset-123',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        aggregatesOnly: true,
        dpEpsilon: 1.0
      }
    );
    console.log('✓ Consent requested');
    console.log(`  ID: ${consent.id}`);
    console.log(`  Purpose: ${consent.purpose}`);
    console.log(`  Fields: ${consent.allowedFields.join(', ')}`);
    console.log(`  Status: ${consent.status}`);
    
    // Step 2: Approve consent
    console.log('\nStep 2: Approving consent...');
    const approved = await securityLayer.consent.approveConsent(
      consent.id,
      'admin@example.com',
      { riskScore: 45, notes: 'Approved for research use' }
    );
    console.log('✓ Consent approved');
    console.log(`  Status: ${approved.status}`);
    console.log(`  Approved by: ${approved.approvedBy}`);
    
    // Step 3: Validate access
    console.log('\nStep 3: Validating access request...');
    const accessValidation = securityLayer.consent.validateAccess(consent.id, {
      purpose: 'statistical_analysis',
      fields: ['age', 'income'],
      epsilon: 0.5
    });
    console.log(`✓ Access valid: ${accessValidation.valid}`);
    if (accessValidation.valid) {
      console.log(`  Allowed fields: ${accessValidation.allowedFields.join(', ')}`);
      console.log(`  Constraints:`, accessValidation.constraints);
    }
    
    return { consent, approved, accessValidation };
  },
  
  /**
   * Example 7: Query Firewall
   */
  async queryFirewallProtection() {
    console.log('\n=== Example 7: Query Firewall ===\n');
    
    const userId = 'researcher@example.com';
    
    // Example 1: Normal query
    console.log('Query 1: Normal aggregate query');
    const normalQuery = {
      type: 'aggregate',
      aggregate: 'count',
      fields: ['condition']
    };
    const result1 = securityLayer.firewall.validateQuery(userId, normalQuery, {
      datasetSize: 10000,
      estimatedResults: 10000
    });
    console.log(`  Allowed: ${result1.allowed}`);
    if (result1.warnings.length > 0) {
      console.log(`  Warnings: ${result1.warnings.join(', ')}`);
    }
    
    // Example 2: Too specific query
    console.log('\nQuery 2: Overly specific query');
    const specificQuery = {
      type: 'select',
      fields: ['name', 'ssn'],
      filters: {
        age: 35,
        zip: '12345'
      }
    };
    const result2 = securityLayer.firewall.validateQuery(userId, specificQuery, {
      datasetSize: 10000,
      estimatedResults: 2
    });
    console.log(`  Allowed: ${result2.allowed}`);
    console.log(`  Reason: ${result2.reason}`);
    
    // Example 3: Sequential ID enumeration (attack pattern)
    console.log('\nQuery 3: Potential enumeration attack');
    const enumQuery = {
      type: 'select',
      filters: { id: 1 }
    };
    // Simulate multiple similar queries
    for (let i = 0; i < 4; i++) {
      securityLayer.firewall.recordQuery(userId, {
        type: 'select',
        filters: { id: i }
      }, { estimatedResults: 1 });
    }
    const result3 = securityLayer.firewall.checkDifferencingAttack(userId, {
      type: 'select',
      filters: { id: 5 }
    });
    console.log(`  Attack detected: ${result3.detected}`);
    if (result3.detected) {
      console.log(`  Reason: ${result3.reason}`);
    }
    
    return { result1, result2, result3 };
  },
  
  /**
   * Example 8: Complete Release Pipeline
   */
  async completePipeline() {
    console.log('\n=== Example 8: Complete Release Pipeline ===\n');
    
    // Setup
    const datasetId = 'dataset-123';
    const rawData = [
      { id: 1, name: 'Alice', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 2, name: 'Bob', age: 38, zip: '12346', income: 82000, condition: 'hypertension' },
      { id: 3, name: 'Charlie', age: 42, zip: '12345', income: 68000, condition: 'diabetes' },
      { id: 4, name: 'David', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 5, name: 'Eve', age: 45, zip: '12347', income: 95000, condition: 'asthma' },
      { id: 6, name: 'Frank', age: 52, zip: '12348', income: 110000, condition: 'diabetes' },
      { id: 7, name: 'Grace', age: 29, zip: '12349', income: 65000, condition: 'hypertension' },
      { id: 8, name: 'Henry', age: 35, zip: '12345', income: 75000, condition: 'diabetes' },
      { id: 9, name: 'Ivy', age: 41, zip: '12350', income: 88000, condition: 'asthma' },
      { id: 10, name: 'Jack', age: 48, zip: '12351', income: 92000, condition: 'diabetes' }
    ];
    
    // Create and approve consent first
    const consent = await securityLayer.consent.requestConsent(
      'researcher@example.com',
      'statistical_analysis',
      ['age', 'zip', 'income', 'condition'],
      { aggregatesOnly: true, dpEpsilon: 1.0 }
    );
    await securityLayer.consent.approveConsent(consent.id, 'admin@example.com', { riskScore: 35 });
    
    console.log('Executing release pipeline...');
    console.log(`Dataset: ${rawData.length} records`);
    console.log(`Consent: ${consent.id}`);
    
    // Execute pipeline
    const result = await securityLayer.pipeline.execute(datasetId, rawData, consent.id, {
      k: 5,
      l: 2,
      maxRiskLevel: 'Medium'
    });
    
    if (result.success) {
      console.log('\n✓ Pipeline completed successfully');
      console.log(`  Release ID: ${result.releaseId}`);
      console.log(`  Execution ID: ${result.executionId}`);
      console.log(`  Execution time: ${result.executionTime}ms`);
      console.log(`  Stages completed: ${result.stagesCompleted.join(' → ')}`);
      console.log(`  Final risk: ${result.riskAssessment.overallRisk}/100 (${result.riskAssessment.riskLevel})`);
      console.log(`  k-anonymous: ${result.anonymization.kCompliant}`);
      console.log(`  l-diverse: ${result.anonymization.lCompliant}`);
      console.log(`  Records in release: ${result.recordCount}`);
    } else {
      console.log('\n✗ Pipeline failed');
      console.log(`  Error: ${result.error}`);
      console.log(`  Stages completed before failure: ${result.stagesCompleted.join(' → ')}`);
    }
    
    return result;
  },
  
  /**
   * Example 9: Audit Chain
   */
  async auditChainExample() {
    console.log('\n=== Example 9: Tamper-Proof Audit Chain ===\n');
    
    // Log various events
    console.log('Logging events...');
    
    await securityLayer.audit.log(
      securityLayer.auditEvents.USER_LOGIN,
      'user@example.com',
      { ip: '192.168.1.1', success: true }
    );
    
    await securityLayer.audit.logDataset(
      securityLayer.auditEvents.DATASET_INGESTED,
      'admin@example.com',
      'dataset-123',
      { recordCount: 10000 }
    );
    
    await securityLayer.audit.logConsent(
      securityLayer.auditEvents.CONSENT_APPROVED,
      'admin@example.com',
      'consent-456',
      { researcherId: 'user@example.com' }
    );
    
    await securityLayer.audit.logEvent(
      securityLayer.auditEvents.QUERY_EXECUTED,
      'user@example.com',
      { queryType: 'aggregate', resultCount: 5 }
    );
    
    console.log('✓ Events logged');
    
    // Validate chain
    console.log('\nValidating chain integrity...');
    const validation = securityLayer.audit.validateChain();
    console.log(`✓ Chain valid: ${validation.valid}`);
    console.log(`  Chain length: ${validation.chainLength} events`);
    console.log(`  Genesis hash: ${validation.firstEventHash?.substring(0, 20)}...`);
    console.log(`  Latest hash: ${validation.lastHash?.substring(0, 20)}...`);
    
    // Get statistics
    console.log('\nAudit Statistics:');
    const stats = securityLayer.audit.getStatistics();
    console.log(`  Total events: ${stats.chainLength}`);
    console.log(`  Event breakdown:`, stats.eventBreakdown);
    console.log(`  Unique users: ${stats.uniqueUsers}`);
    
    return validation;
  },
  
  /**
   * Example 10: Tokenization
   */
  tokenizationExample() {
    console.log('\n=== Example 10: Deterministic Tokenization ===\n');
    
    const sensitiveValues = [
      { type: 'email', value: 'john.doe@example.com' },
      { type: 'phone', value: '+1-555-123-4567' },
      { type: 'ssn', value: '123-45-6789' },
      { type: 'name', value: 'John Doe' }
    ];
    
    console.log('Tokenizing sensitive values...\n');
    
    sensitiveValues.forEach(({ type, value }) => {
      const token = securityLayer.crypto.tokenize(value, type);
      const token2 = securityLayer.crypto.tokenize(value, type); // Same input = same token
      
      console.log(`${type.toUpperCase()}:`);
      console.log(`  Original: ${value}`);
      console.log(`  Token: ${token}`);
      console.log(`  Deterministic: ${token === token2 ? '✓ Yes' : '✗ No'}`);
      
      // Verify
      const verified = securityLayer.crypto.verifyToken(value, token, type);
      console.log(`  Verification: ${verified ? '✓ Valid' : '✗ Invalid'}`);
      console.log();
    });
    
    return true;
  }
};

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     SAFE DATA ACCESS PLATFORM - SECURITY EXAMPLES          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Initialize security layer
    await securityLayer.initialize();
    
    // Run examples
    await examples.dataIngestionFlow();
    await examples.classificationAndRisk();
    await examples.multiLayerAnonymization();
    await examples.differentialPrivacyQueries();
    await examples.zeroTrustFlow();
    await examples.consentManagement();
    await examples.queryFirewallProtection();
    await examples.completePipeline();
    await examples.auditChainExample();
    examples.tokenizationExample();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ALL EXAMPLES COMPLETED ✓                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export examples for individual use
export { examples };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export default examples;
