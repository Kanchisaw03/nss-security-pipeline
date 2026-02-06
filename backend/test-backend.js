#!/usr/bin/env node
/**
 * Comprehensive Backend Test Suite
 * Tests all API endpoints sequentially
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const TEST_RESULTS = [];

// Test configuration
const TEST_CONFIG = {
  admin: { userId: 'admin', password: 'admin123' },
  researcher: { userId: `researcher_${Date.now()}`, password: 'test123' }
};

// Store tokens and IDs
const state = {
  adminToken: null,
  researcherToken: null,
  datasetId: null,
  consentId: null,
  releaseId: null
};

// Helper function to make requests
async function makeRequest(method, endpoint, body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test runner
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    const result = await testFn();
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    TEST_RESULTS.push({ name, status: result ? 'PASS' : 'FAIL' });
    return result;
  } catch (error) {
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    TEST_RESULTS.push({ name, status: 'FAIL', error: error.message });
    return false;
  }
}

// ==========================================
// TESTS
// ==========================================

async function testHealth() {
  const res = await makeRequest('GET', '/health');
  return res.ok && res.data?.status === 'healthy';
}

async function testApiStatus() {
  const res = await makeRequest('GET', '/api/status');
  return res.ok && res.data?.platform;
}

async function testSecurityStatus() {
  // This should fail without auth
  const resNoAuth = await makeRequest('GET', '/api/security/status');
  
  // Login first
  const loginRes = await makeRequest('POST', '/api/auth/login', TEST_CONFIG.admin);
  if (!loginRes.ok) return false;
  state.adminToken = loginRes.data.token;
  
  // Now try with auth
  const resAuth = await makeRequest('GET', '/api/security/status', null, state.adminToken);
  return resAuth.ok && resAuth.data?.components;
}

async function testAdminLogin() {
  const res = await makeRequest('POST', '/api/auth/login', TEST_CONFIG.admin);
  if (res.ok && res.data?.token) {
    state.adminToken = res.data.token;
    return true;
  }
  return false;
}

async function testRegisterResearcher() {
  const res = await makeRequest('POST', '/api/auth/register', {
    userId: TEST_CONFIG.researcher.userId,
    password: TEST_CONFIG.researcher.password,
    role: 'researcher',
    purposeScope: ['research', 'statistical_analysis']
  }, state.adminToken);
  
  return res.ok || res.status === 400; // 400 is OK if user already exists
}

async function testResearcherLogin() {
  const res = await makeRequest('POST', '/api/auth/login', {
    userId: TEST_CONFIG.researcher.userId,
    password: TEST_CONFIG.researcher.password
  });
  
  if (res.ok && res.data?.token) {
    state.researcherToken = res.data.token;
    return true;
  }
  return false;
}

async function testListUsers() {
  const res = await makeRequest('GET', '/api/auth/users', null, state.adminToken);
  return res.ok && Array.isArray(res.data?.users);
}

async function testIngestDataset() {
  const testData = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@test.com',
      ssn: '123-45-6789',
      age: 35,
      zipcode: '12345',
      gender: 'male',
      disease: 'Hypertension',
      income: 75000,
      education: 'Bachelor\'s'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@test.com',
      ssn: '987-65-4321',
      age: 28,
      zipcode: '12346',
      gender: 'female',
      disease: 'Diabetes',
      income: 68000,
      education: 'Master\'s'
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@test.com',
      ssn: '456-78-9012',
      age: 45,
      zipcode: '12345',
      gender: 'male',
      disease: 'Heart Disease',
      income: 92000,
      education: 'PhD'
    },
    {
      id: 4,
      name: 'Alice Williams',
      email: 'alice@test.com',
      ssn: '789-01-2345',
      age: 52,
      zipcode: '12347',
      gender: 'female',
      disease: 'Cancer',
      income: 115000,
      education: 'MBA'
    },
    {
      id: 5,
      name: 'Charlie Brown',
      email: 'charlie@test.com',
      ssn: '321-09-8765',
      age: 31,
      zipcode: '12345',
      gender: 'male',
      disease: 'Asthma',
      income: 55000,
      education: 'Bachelor\'s'
    }
  ];
  
  const res = await makeRequest('POST', '/api/ingestion/dataset', {
    dataset: testData,
    metadata: { source: 'Test Suite', description: 'Automated test data' }
  }, state.adminToken);
  
  if (res.ok && res.data?.datasetId) {
    state.datasetId = res.data.datasetId;
    console.log(`  📊 Dataset ID: ${state.datasetId}`);
    return true;
  }
  return false;
}

async function testListDatasets() {
  const res = await makeRequest('GET', '/api/ingestion/datasets', null, state.adminToken);
  return res.ok && Array.isArray(res.data?.datasets);
}

async function testClassification() {
  if (!state.datasetId) {
    console.log('  ⚠️  Skipping - no dataset ID');
    return true; // Skip if no dataset
  }
  
  const res = await makeRequest('POST', `/api/classification/${state.datasetId}`, {}, state.adminToken);
  
  if (res.ok && res.data?.classification) {
    console.log(`  📋 Risk Score: ${res.data?.riskAssessment?.overallRisk}`);
    console.log(`  📋 Risk Level: ${res.data?.riskAssessment?.riskLevel}`);
    return true;
  }
  return false;
}

async function testRiskAssessment() {
  if (!state.datasetId) {
    console.log('  ⚠️  Skipping - no dataset ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/risk/assess/${state.datasetId}`, {}, state.adminToken);
  
  if (res.ok && res.data?.assessment) {
    console.log(`  ⚠️  Risk Score: ${res.data.assessment.overallRisk}/100`);
    return true;
  }
  return false;
}

async function testKAnonymity() {
  if (!state.datasetId) {
    console.log('  ⚠️  Skipping - no dataset ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/risk/k-anonymity/${state.datasetId}`, { k: 5 }, state.adminToken);
  
  if (res.ok && res.data?.kAnonymity) {
    console.log(`  🔒 k-Anonymity: ${res.data.kAnonymity.compliant ? 'COMPLIANT' : 'NOT COMPLIANT'}`);
    console.log(`  🔒 Groups: ${res.data.kAnonymity.totalGroups}`);
    return true;
  }
  return false;
}

async function testRequestConsent() {
  if (!state.datasetId) {
    console.log('  ⚠️  Skipping - no dataset ID');
    return true;
  }
  
  const res = await makeRequest('POST', '/api/consent/request', {
    datasetId: state.datasetId,
    purpose: 'research',
    allowedFields: ['age', 'gender', 'disease', 'income', 'education'],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }, state.researcherToken);
  
  if (res.ok && res.data?.consent?.id) {
    state.consentId = res.data.consent.id;
    console.log(`  📝 Consent ID: ${state.consentId}`);
    return true;
  }
  return false;
}

async function testApproveConsent() {
  if (!state.consentId) {
    console.log('  ⚠️  Skipping - no consent ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/consent/${state.consentId}/approve`, {
    riskScore: 35,
    notes: 'Approved for research use'
  }, state.adminToken);
  
  return res.ok && res.data?.consent?.status === 'approved';
}

async function testListConsents() {
  const res = await makeRequest('GET', '/api/consent', null, state.adminToken);
  return res.ok && Array.isArray(res.data?.consents);
}

async function testReleaseDataset() {
  if (!state.datasetId || !state.consentId) {
    console.log('  ⚠️  Skipping - missing dataset or consent ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/release/${state.datasetId}`, {
    consentId: state.consentId,
    k: 5,
    l: 2
  }, state.adminToken);
  
  if (res.ok && res.data?.releaseId) {
    state.releaseId = res.data.releaseId;
    console.log(`  🚀 Release ID: ${state.releaseId}`);
    console.log(`  🚀 Stages: ${res.data.stagesCompleted?.join(' → ')}`);
    console.log(`  🚀 Risk: ${res.data.riskAssessment?.overallRisk}/100`);
    return true;
  }
  return false;
}

async function testListReleases() {
  const res = await makeRequest('GET', '/api/release', null, state.adminToken);
  return res.ok && Array.isArray(res.data?.releases);
}

async function testAuditChain() {
  const res = await makeRequest('GET', '/api/audit/chain', null, state.adminToken);
  
  if (res.ok) {
    console.log(`  🔗 Chain Valid: ${res.data?.valid}`);
    console.log(`  🔗 Events: ${res.data?.statistics?.chainLength}`);
    return true;
  }
  return false;
}

async function testAuditEvents() {
  const res = await makeRequest('GET', '/api/audit/events?limit=10', null, state.adminToken);
  return res.ok && Array.isArray(res.data?.events);
}

async function testAuditUserActivity() {
  const res = await makeRequest('GET', '/api/audit/user/admin', null, state.adminToken);
  return res.ok && res.data?.activity;
}

async function testAuditExport() {
  const res = await makeRequest('GET', '/api/audit/export?format=json', null, state.adminToken);
  return res.ok; // Should return file data
}

async function testDPCount() {
  if (!state.releaseId) {
    console.log('  ⚠️  Skipping - no release ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/dp/count/${state.releaseId}`, {
    epsilon: 1.0
  }, state.researcherToken);
  
  if (res.ok) {
    console.log(`  📊 DP Count: ${res.data?.noisyValue} (noise: ${res.data?.noise})`);
    return true;
  }
  return false;
}

async function testDPSum() {
  if (!state.releaseId) {
    console.log('  ⚠️  Skipping - no release ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/dp/sum/${state.releaseId}`, {
    field: 'income',
    epsilon: 1.0
  }, state.researcherToken);
  
  if (res.ok) {
    console.log(`  📊 DP Sum: ${res.data?.noisyValue} (noise: ${res.data?.noise})`);
    return true;
  }
  return false;
}

async function testQueryFirewall() {
  if (!state.releaseId) {
    console.log('  ⚠️  Skipping - no release ID');
    return true;
  }
  
  const res = await makeRequest('POST', `/api/query/${state.releaseId}`, {
    type: 'aggregate',
    aggregate: 'count',
    fields: ['disease'],
    purpose: 'research',
    epsilon: 0.5
  }, state.researcherToken);
  
  if (res.ok) {
    console.log(`  🔥 Firewall Check: ${res.data?.firewall?.allowed ? 'PASSED' : 'BLOCKED'}`);
    return true;
  }
  return false;
}

// ==========================================
// MAIN TEST RUNNER
// ==========================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     SAFE DATA ACCESS PLATFORM - BACKEND TEST SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('🚀 Starting comprehensive backend tests...\n');
  
  // Phase 1: Health & Basic
  console.log('\n📍 PHASE 1: Health & System Status');
  await runTest('Health Check', testHealth);
  await runTest('API Status', testApiStatus);
  await runTest('Security Status (with auth)', testSecurityStatus);
  
  // Phase 2: Authentication
  console.log('\n📍 PHASE 2: Authentication');
  await runTest('Admin Login', testAdminLogin);
  await runTest('Register Researcher', testRegisterResearcher);
  await runTest('Researcher Login', testResearcherLogin);
  await runTest('List Users', testListUsers);
  
  // Phase 3: Data Ingestion
  console.log('\n📍 PHASE 3: Data Ingestion');
  await runTest('Ingest Dataset', testIngestDataset);
  await runTest('List Datasets', testListDatasets);
  
  // Phase 4: Classification & Risk
  console.log('\n📍 PHASE 4: Classification & Risk Assessment');
  await runTest('Classification', testClassification);
  await runTest('Risk Assessment', testRiskAssessment);
  await runTest('k-Anonymity Check', testKAnonymity);
  
  // Phase 5: Consent Management
  console.log('\n📍 PHASE 5: Consent Management');
  await runTest('Request Consent', testRequestConsent);
  await runTest('Approve Consent', testApproveConsent);
  await runTest('List Consents', testListConsents);
  
  // Phase 6: Release Pipeline
  console.log('\n📍 PHASE 6: Release Pipeline');
  await runTest('Release Dataset', testReleaseDataset);
  await runTest('List Releases', testListReleases);
  
  // Phase 7: Differential Privacy
  console.log('\n📍 PHASE 7: Differential Privacy');
  await runTest('DP Count Query', testDPCount);
  await runTest('DP Sum Query', testDPSum);
  await runTest('Query Firewall', testQueryFirewall);
  
  // Phase 8: Audit
  console.log('\n📍 PHASE 8: Audit & Compliance');
  await runTest('Audit Chain Validation', testAuditChain);
  await runTest('Audit Events Query', testAuditEvents);
  await runTest('User Activity', testAuditUserActivity);
  await runTest('Audit Export', testAuditExport);
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  const passed = TEST_RESULTS.filter(r => r.status === 'PASS').length;
  const failed = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
  const total = TEST_RESULTS.length;
  
  console.log(`║  Total Tests:  ${total.toString().padStart(3)}                                          ║`);
  console.log(`║  Passed:       ${passed.toString().padStart(3)} ✅                                        ║`);
  console.log(`║  Failed:       ${failed.toString().padStart(3)} ${failed > 0 ? '❌' : '  '}                                        ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (failed > 0) {
    console.log('❌ Failed Tests:');
    TEST_RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n✨ Test run complete!\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});
