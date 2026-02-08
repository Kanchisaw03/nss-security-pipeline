import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication
export const authAPI = {
  login: (userId, password) => api.post('/api/auth/login', { userId, password }),
  register: (userData) => api.post('/api/auth/register', userData),
  getUsers: () => api.get('/api/auth/users'),
};

// System Status
export const systemAPI = {
  getHealth: () => api.get('/health'),
  getStatus: () => api.get('/api/status'),
  getSecurityStatus: () => api.get('/api/security/status'),
};

// Risk & Governance
export const riskAPI = {
  getSummary: () => api.get('/api/risk/summary'),
  assessDataset: (datasetId) => api.post(`/api/risk/assess/${datasetId}`),
  compareRisk: (datasetId) => api.post(`/api/risk/compare/${datasetId}`),
  checkKAnonymity: (datasetId) => api.post(`/api/risk/k-anonymity/${datasetId}`),
};

// Privacy-Utility Curve
export const curveAPI = {
  getCurve: (datasetId, params) => api.post(`/api/curve/${datasetId}`, params),
  getVisualization: (curveId) => api.get(`/api/curve/visualization/${curveId}`),
};

// Attack Simulation
export const attackAPI = {
  getStatus: () => api.get('/api/attack-simulation/status'),
  runSimulation: (releaseId, params) => api.post(`/api/attack-simulation/${releaseId}`, params),
  getResult: (attackId) => api.get(`/api/attack-simulation/result/${attackId}`),
};

// Consent Management
export const consentAPI = {
  getActive: () => api.get('/api/consent/active'),
  getMyConsents: () => api.get('/api/consent/my'),
  getAllConsents: () => api.get('/api/consent'),
  getConsent: (id) => api.get(`/api/consent/${id}`),
  requestConsent: (data) => api.post('/api/consent/request', data),
  approveConsent: (id, data) => api.post(`/api/consent/${id}/approve`, data),
  rejectConsent: (id, data) => api.post(`/api/consent/${id}/reject`, data),
  revokeConsent: (id, data) => api.post(`/api/consent/${id}/revoke`, data),
};

// Differential Privacy
export const dpAPI = {
  getBudget: () => api.get('/api/dp/budget'),
  query: (releaseId, params) => api.post(`/api/query/${releaseId}`, params),
  count: (releaseId, params) => api.post(`/api/dp/count/${releaseId}`, params),
  sum: (releaseId, params) => api.post(`/api/dp/sum/${releaseId}`, params),
  mean: (releaseId, params) => api.post(`/api/dp/mean/${releaseId}`, params),
  histogram: (releaseId, params) => api.post(`/api/dp/histogram/${releaseId}`, params),
};

// Data Ingestion
export const ingestionAPI = {
  uploadDataset: (data) => api.post('/api/ingestion/dataset', data),
  getDatasets: () => api.get('/api/ingestion/datasets'),
  getMetadata: (id) => api.get(`/api/ingestion/datasets/${id}/metadata`),
  getDatasetData: (id, page = 1, limit = 50) => api.get(`/api/ingestion/datasets/${id}/data`, { params: { page, limit } }),
  deleteDataset: (id) => api.delete(`/api/ingestion/datasets/${id}`),
  clearAllDatasets: () => api.delete('/api/ingestion/datasets'),
};

// Classification
export const classificationAPI = {
  classifyDataset: (datasetId) => api.post(`/api/classification/${datasetId}`),
  classifyField: (fieldName, data) => api.post(`/api/classification/field/${fieldName}`, data),
};

// Release Pipeline
export const releaseAPI = {
  execute: (datasetId, data) => api.post(`/api/release/${datasetId}`, data),
  getReleases: () => api.get('/api/release'),
};

// Audit Chain
export const auditAPI = {
  validateChain: () => api.get('/api/audit/chain'),
  getEvents: (params) => api.get('/api/audit/events', { params }),
  getUserActivity: (userId) => api.get(`/api/audit/user/${userId}`),
  getDatasetActivity: (datasetId) => api.get(`/api/audit/dataset/${datasetId}`),
  getConsentLifecycle: (consentId) => api.get(`/api/audit/consent/${consentId}`),
  exportAudit: () => api.get('/api/audit/export'),
};

// Compliance
export const complianceAPI = {
  getDPDP: () => api.get('/api/compliance/dpdp'),
  getDPDPPrinciple: (principle) => api.get(`/api/compliance/dpdp/${principle}`),
  getSummary: () => api.get('/api/compliance/summary'),
};

// Reporting
export const reportAPI = {
  getBenchmark: (datasetId) => api.get(`/api/report/benchmark/${datasetId}`),
  getPrivacyUtility: (releaseId) => api.get(`/api/report/privacy-utility/${releaseId}`),
};

// Benchmark
export const benchmarkAPI = {
  run: (datasetId, params) => api.post(`/api/benchmark/${datasetId}`, params),
};

// Governance Dashboard
export const governanceAPI = {
  getDashboard: (releaseId) => api.get(`/api/governance/dashboard/${releaseId}`),
};

export default api;