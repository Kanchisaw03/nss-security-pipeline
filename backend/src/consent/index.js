import { consentEngine, CONSENT_STATUS } from '../consentEngine/index.js';

export { CONSENT_STATUS };

export const consentService = {
  requestConsent: async (researcherId, purpose, allowedFields, expiryDate, datasetId) => {
    return await consentEngine.requestConsent(researcherId, purpose, allowedFields, {
      datasetId,
      expiryDate
    });
  },

  approveConsent: async (consentId, approverId, riskScore) => {
    return await consentEngine.approveConsent(consentId, approverId, { riskScore });
  },

  rejectConsent: async (consentId, rejectorId, reason) => {
    return await consentEngine.rejectConsent(consentId, rejectorId, reason);
  },

  getConsent: (consentId) => {
    return consentEngine.getConsent(consentId);
  },

  getConsentsByResearcher: (researcherId) => {
    return consentEngine.getConsentsByResearcher(researcherId);
  },

  getConsentsByDataset: (datasetId) => {
    return consentEngine.getConsentsByDataset(datasetId);
  },

  getPendingConsents: () => {
    return consentEngine.getPendingConsents();
  },

  isConsentValid: (consentId) => {
    const result = consentEngine.isConsentValid(consentId);
    return result.valid;
  },

  validateConsentForAccess: (consentId, requestedFields) => {
    return consentEngine.validateAccess(consentId, { fields: requestedFields });
  },

  listAllConsents: () => {
    return consentEngine.listAllConsents();
  }
};
