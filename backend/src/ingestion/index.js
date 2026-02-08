import { v4 as uuidv4 } from 'uuid';
import csv from 'csv-parser';
import { Readable } from 'stream';

/**
 * Data Ingestion Layer
 * 
 * Admin-only layer for raw dataset intake.
 * Handles data validation, schema enforcement, and storage triggering.
 */

// Schema validation rules
const SCHEMA_RULES = {
  requiredFields: ['id'],
  maxFieldLength: 500,
  maxRecordSize: 10000, // 10KB per record
  maxDatasetSize: 100 * 1024 * 1024 // 100MB per dataset
};

/**
 * Validate dataset schema
 */
const validateSchema = (data) => {
  const errors = [];
  
  if (!Array.isArray(data) || data.length === 0) {
    errors.push('Dataset must be a non-empty array');
    return { valid: false, errors };
  }
  
  // Check first record for required fields
  const firstRecord = data[0];
  const missingRequired = SCHEMA_RULES.requiredFields.filter(
    field => !(field in firstRecord)
  );
  
  if (missingRequired.length > 0) {
    errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
  }
  
  // Validate each record
  let totalSize = 0;
  const fieldNames = Object.keys(firstRecord);
  
  data.forEach((record, index) => {
    const recordSize = JSON.stringify(record).length;
    totalSize += recordSize;
    
    if (recordSize > SCHEMA_RULES.maxRecordSize) {
      errors.push(`Record ${index} exceeds maximum size`);
    }
    
    // Check for extra fields
    const recordFields = Object.keys(record);
    const extraFields = recordFields.filter(f => !fieldNames.includes(f));
    
    if (extraFields.length > 0) {
      errors.push(`Record ${index} has inconsistent fields: ${extraFields.join(', ')}`);
    }
    
    // Validate field values
    Object.entries(record).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > SCHEMA_RULES.maxFieldLength) {
        errors.push(`Record ${index}, field '${key}' exceeds max length`);
      }
    });
  });
  
  if (totalSize > SCHEMA_RULES.maxDatasetSize) {
    errors.push('Dataset exceeds maximum size limit');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    stats: {
      recordCount: data.length,
      fieldCount: fieldNames.length,
      fields: fieldNames,
      totalSize
    }
  };
};

/**
 * Parse CSV to JSON
 */
const parseCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    const stream = Readable.from([csvContent]);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

/**
 * Ingestion service
 */
export const ingestionService = {
  /**
   * Ingest JSON dataset
   */
  ingestJSON: async (dataset, metadata = {}) => {
    const validation = validateSchema(dataset);
    
    if (!validation.valid) {
      throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
    }
    
    const datasetId = uuidv4();
    const ingestionRecord = {
      id: datasetId,
      type: 'json',
      data: dataset,
      metadata: {
        ...metadata,
        ingestedAt: new Date().toISOString(),
        recordCount: validation.stats.recordCount,
        fieldCount: validation.stats.fieldCount,
        fields: validation.stats.fields,
        totalSize: validation.stats.totalSize
      },
      status: 'raw',
      classificationStatus: 'pending',
      anonymized: false,
      released: false
    };
    
    return ingestionRecord;
  },
  
  /**
   * Ingest CSV dataset
   */
  ingestCSV: async (csvContent, metadata = {}) => {
    try {
      const data = await parseCSV(csvContent);
      
      if (data.length === 0) {
        throw new Error('CSV file is empty');
      }
      
      // Convert string values to appropriate types and auto-generate IDs
      const processedData = data.map((record, index) => {
        const processed = {};
        
        // Auto-generate ID if not present
        if (!record.id) {
          processed.id = `record_${index + 1}`;
        }
        
        Object.entries(record).forEach(([key, value]) => {
          // Try to convert to number
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && isFinite(numValue)) {
            processed[key] = numValue;
          } else {
            processed[key] = value;
          }
        });
        return processed;
      });
      
      return ingestionService.ingestJSON(processedData, {
        ...metadata,
        originalFormat: 'csv'
      });
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  },
  
  /**
   * Get ingestion stats
   */
  getStats: (data) => {
    return validateSchema(data).stats;
  }
};

export { validateSchema, SCHEMA_RULES };
