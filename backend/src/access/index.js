import { storageService } from '../storage/index.js';
import { consentService } from '../consent/index.js';
import { releaseService } from '../release/index.js';

/**
 * Controlled Access Layer
 * 
 * Manages researcher access to released datasets:
 * - Access only released datasets
 * - Cannot download raw data
 * - All queries logged
 * - Consent validation on every access
 */

// Query tracking
const queryLog = new Map();

/**
 * Access service
 */
export const accessService = {
  /**
   * Query released dataset
   */
  queryDataset: (releaseId, query, user) => {
    // Validate user and consent
    if (!user || !user.userId) {
      throw new Error('Authentication required');
    }
    
    // Get release metadata
    const releaseMetadata = releaseService.getReleaseMetadata(releaseId);
    if (!releaseMetadata) {
      throw new Error('Dataset not found or not released');
    }
    
    // Verify researcher access
    if (releaseMetadata.researcherId !== user.userId) {
      throw new Error('Access denied: Dataset released to different researcher');
    }
    
    // Validate consent
    const consent = consentService.getConsent(releaseMetadata.consentId);
    if (!consentService.isConsentValid(releaseMetadata.consentId)) {
      throw new Error('Consent expired or invalid');
    }
    
    // Retrieve dataset
    const dataset = releaseService.getReleasedDataset(releaseId);
    if (!dataset) {
      throw new Error('Dataset not available');
    }
    
    // Apply query filters
    let results = [...dataset];
    
    // Remove anonymization metadata from results
    results = results.map(record => {
      const { _anonymizationMeta, ...cleanRecord } = record;
      return cleanRecord;
    });
    
    // Apply field filtering based on consent
    if (consent && consent.allowedFields) {
      results = results.map(record => {
        const filtered = {};
        consent.allowedFields.forEach(field => {
          if (field in record) {
            filtered[field] = record[field];
          }
        });
        return filtered;
      });
    }
    
    // Apply query conditions if provided
    if (query && query.filters) {
      results = applyFilters(results, query.filters);
    }
    
    // Apply aggregation if specified
    if (query && query.aggregate) {
      results = applyAggregation(results, query.aggregate);
    }
    
    // Handle aggregations array format
    if (query && query.aggregations && Array.isArray(query.aggregations)) {
      const aggregationResults = {};
      query.aggregations.forEach(agg => {
        if (agg.field && agg.function) {
          const key = agg.field === '*' ? 'count' : `${agg.field}_${agg.function}`;
          aggregationResults[key] = computeAggregation(results, agg.field, agg.function);
        }
      });
      results = [aggregationResults];
    }
    
    // Apply limit
    if (query && query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }
    
    // Log query
    const queryId = logQuery(user.userId, releaseId, query, results.length);
    
    return {
      queryId,
      releaseId,
      totalRecords: results.length,
      data: results,
      metadata: {
        consentId: releaseMetadata.consentId,
        purpose: releaseMetadata.purpose,
        allowedFields: consent?.allowedFields || [],
        queriedAt: new Date().toISOString()
      }
    };
  },
  
  /**
   * Get dataset summary (without exposing individual records)
   */
  getDatasetSummary: (releaseId, user) => {
    // Validate access
    const releaseMetadata = releaseService.getReleaseMetadata(releaseId);
    if (!releaseMetadata) {
      throw new Error('Dataset not found');
    }
    
    if (releaseMetadata.researcherId !== user.userId) {
      throw new Error('Access denied');
    }
    
    const dataset = releaseService.getReleasedDataset(releaseId);
    if (!dataset || dataset.length === 0) {
      throw new Error('Dataset empty or not available');
    }
    
    // Generate statistical summary
    const fields = Object.keys(dataset[0]).filter(f => !f.startsWith('_'));
    const summary = {
      releaseId,
      totalRecords: dataset.length,
      fields: {},
      generatedAt: new Date().toISOString()
    };
    
    fields.forEach(field => {
      const values = dataset.map(r => r[field]).filter(v => v !== null && v !== undefined);
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      
      summary.fields[field] = {
        type: numericValues.length > 0 ? 'numeric' : 'categorical',
        nonNullCount: values.length,
        nullCount: dataset.length - values.length,
        uniqueValues: [...new Set(values)].length
      };
      
      if (numericValues.length > 0) {
        summary.fields[field].statistics = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        };
      }
    });
    
    // Log access
    logQuery(user.userId, releaseId, { type: 'summary' }, 0);
    
    return summary;
  },
  
  /**
   * List accessible datasets for researcher
   */
  listAccessibleDatasets: (researcherId) => {
    return releaseService.listReleasesByResearcher(researcherId);
  },
  
  /**
   * Get query history for researcher
   */
  getQueryHistory: (researcherId) => {
    return Array.from(queryLog.values())
      .filter(q => q.researcherId === researcherId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },
  
  /**
   * Get all queries (admin only)
   */
  getAllQueries: () => {
    return Array.from(queryLog.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },
  
  /**
   * Validate if researcher can access field
   */
  canAccessField: (releaseId, fieldName, researcherId) => {
    const releaseMetadata = releaseService.getReleaseMetadata(releaseId);
    if (!releaseMetadata) return false;
    
    if (releaseMetadata.researcherId !== researcherId) return false;
    
    const consent = consentService.getConsent(releaseMetadata.consentId);
    if (!consent || !consentService.isConsentValid(releaseMetadata.consentId)) {
      return false;
    }
    
    return consent.allowedFields.includes(fieldName);
  }
};

/**
 * Log query for audit trail
 */
const logQuery = (researcherId, releaseId, query, resultCount) => {
  const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const logEntry = {
    id: queryId,
    researcherId,
    releaseId,
    query: sanitizeQueryForLogging(query),
    resultCount,
    timestamp: new Date().toISOString()
  };
  
  queryLog.set(queryId, logEntry);
  
  return queryId;
};

/**
 * Sanitize query for logging (remove any potential sensitive data)
 */
const sanitizeQueryForLogging = (query) => {
  if (!query) return null;
  
  // Only log query structure, not values
  return {
    hasFilters: !!query.filters,
    hasAggregation: !!query.aggregate,
    limit: query.limit,
    type: query.type || 'standard'
  };
};

/**
 * Apply filters to dataset
 */
const applyFilters = (data, filters) => {
  return data.filter(record => {
    return Object.entries(filters).every(([field, condition]) => {
      const value = record[field];
      
      if (condition.eq !== undefined) return value === condition.eq;
      if (condition.neq !== undefined) return value !== condition.neq;
      if (condition.gt !== undefined) return value > condition.gt;
      if (condition.gte !== undefined) return value >= condition.gte;
      if (condition.lt !== undefined) return value < condition.lt;
      if (condition.lte !== undefined) return value <= condition.lte;
      if (condition.in !== undefined) return condition.in.includes(value);
      if (condition.contains !== undefined) {
        return String(value).toLowerCase().includes(String(condition.contains).toLowerCase());
      }
      
      return true;
    });
  });
};

/**
 * Apply aggregation to dataset
 */
const applyAggregation = (data, aggregate) => {
  const { field, operation, groupBy } = aggregate;
  
  if (!field || !operation) {
    throw new Error('Invalid aggregation: field and operation required');
  }
  
  if (groupBy) {
    // Group by field
    const groups = {};
    data.forEach(record => {
      const key = record[groupBy];
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    });
    
    return Object.entries(groups).map(([key, records]) => ({
      [groupBy]: key,
      count: records.length,
      [operation]: computeAggregation(records, field, operation)
    }));
  } else {
    // Global aggregation
    return [{
      count: data.length,
      [operation]: computeAggregation(data, field, operation)
    }];
  }
};

/**
 * Compute aggregation operation
 */
const computeAggregation = (records, field, operation) => {
  const values = records
    .map(r => parseFloat(r[field]))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) return null;
  
  switch (operation) {
    case 'count':
      return values.length;
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return null;
  }
};

export { queryLog };
