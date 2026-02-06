/**
 * Data Classification Layer
 * 
 * Classifies fields into sensitivity categories:
 * - Direct Identifier: name, phone, email, SSN
 * - Quasi Identifier: age, zipcode, birthdate
 * - Sensitive Attribute: income, disease, medical history
 * - Non-Sensitive: gender (when not combined with other fields)
 */

// Classification patterns
const CLASSIFICATION_PATTERNS = {
  direct: {
    fields: [
      'name', 'first_name', 'last_name', 'fullname', 'full_name',
      'phone', 'phone_number', 'mobile', 'email', 'email_address',
      'ssn', 'social_security', 'passport', 'id_number', 'national_id',
      'address', 'street_address', 'home_address', 'ip_address', 'device_id'
    ],
    patterns: [
      /^.*_id$/i,
      /^.*name.*$/i,
      /^.*phone.*$/i,
      /^.*email.*$/i,
      /^.*address.*$/i,
      /^ssn$/i,
      /^ip.*$/i
    ]
  },
  quasi: {
    fields: [
      'age', 'birthdate', 'birth_date', 'dob', 'date_of_birth',
      'zipcode', 'zip_code', 'postal_code', 'pincode', 'city', 'state',
      'country', 'gender', 'sex', 'race', 'ethnicity', 'language',
      'education', 'occupation', 'employer', 'job_title',
      'transaction_date', 'visit_date', 'admission_date'
    ],
    patterns: [
      /^.*date.*$/i,
      /^.*age.*$/i,
      /^.*zip.*$/i,
      /^.*postal.*$/i,
      /^.*location.*$/i,
      /^lat(itude)?$/i,
      /^lon(gitude)?$/i
    ]
  },
  sensitive: {
    fields: [
      'income', 'salary', 'wage', 'earnings',
      'disease', 'diagnosis', 'condition', 'medical_history',
      'health_status', 'treatment', 'medication', 'allergy',
      'credit_score', 'credit_rating', 'debt', 'loan_amount',
      'political_affiliation', 'religion', 'sexual_orientation',
      'biometric', 'fingerprint', 'dna', 'genetic'
    ],
    patterns: [
      /^.*income.*$/i,
      /^.*salary.*$/i,
      /^.*disease.*$/i,
      /^.*diagnosis.*$/i,
      /^.*medical.*$/i,
      /^.*health.*$/i,
      /^.*credit.*$/i,
      /^.*financial.*$/i,
      /^.*biometric.*$/i
    ]
  }
};

// Classification types
export const CLASSIFICATION_TYPES = {
  DIRECT: 'direct_identifier',
  QUASI: 'quasi_identifier',
  SENSITIVE: 'sensitive_attribute',
  NON_SENSITIVE: 'non_sensitive'
};

/**
 * Classify a single field
 */
const classifyField = (fieldName) => {
  const lowerField = fieldName.toLowerCase();
  
  // Check direct identifiers
  if (CLASSIFICATION_PATTERNS.direct.fields.includes(lowerField)) {
    return CLASSIFICATION_TYPES.DIRECT;
  }
  
  for (const pattern of CLASSIFICATION_PATTERNS.direct.patterns) {
    if (pattern.test(fieldName)) {
      return CLASSIFICATION_TYPES.DIRECT;
    }
  }
  
  // Check quasi identifiers
  if (CLASSIFICATION_PATTERNS.quasi.fields.includes(lowerField)) {
    return CLASSIFICATION_TYPES.QUASI;
  }
  
  for (const pattern of CLASSIFICATION_PATTERNS.quasi.patterns) {
    if (pattern.test(fieldName)) {
      return CLASSIFICATION_TYPES.QUASI;
    }
  }
  
  // Check sensitive attributes
  if (CLASSIFICATION_PATTERNS.sensitive.fields.includes(lowerField)) {
    return CLASSIFICATION_TYPES.SENSITIVE;
  }
  
  for (const pattern of CLASSIFICATION_PATTERNS.sensitive.patterns) {
    if (pattern.test(fieldName)) {
      return CLASSIFICATION_TYPES.SENSITIVE;
    }
  }
  
  // Default to non-sensitive
  return CLASSIFICATION_TYPES.NON_SENSITIVE;
};

/**
 * Analyze value distribution for quasi-identifiers
 */
const analyzeQuasiIdentifier = (data, fieldName) => {
  const values = data.map(record => record[fieldName]).filter(v => v !== null && v !== undefined);
  const uniqueValues = [...new Set(values)];
  
  // Calculate frequency distribution
  const frequency = {};
  values.forEach(value => {
    frequency[value] = (frequency[value] || 0) + 1;
  });
  
  // Sort by frequency (descending)
  const sortedFreq = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 values
  
  return {
    totalValues: values.length,
    uniqueValues: uniqueValues.length,
    uniquenessRatio: uniqueValues.length / values.length,
    topValues: sortedFreq.map(([value, count]) => ({ value, count })),
    riskLevel: uniqueValues.length / values.length > 0.8 ? 'high' : 
                uniqueValues.length / values.length > 0.5 ? 'medium' : 'low'
  };
};

/**
 * Classification service
 */
export const classificationService = {
  /**
   * Classify all fields in a dataset
   */
  classifyDataset: (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid dataset');
    }
    
    const fields = Object.keys(data[0]);
    const classification = {
      datasetId: null,
      classifiedAt: new Date().toISOString(),
      recordCount: data.length,
      fields: {},
      summary: {
        directIdentifiers: [],
        quasiIdentifiers: [],
        sensitiveAttributes: [],
        nonSensitive: []
      },
      riskIndicators: []
    };
    
    // Classify each field
    fields.forEach(fieldName => {
      const type = classifyField(fieldName);
      
      classification.fields[fieldName] = {
        type,
        description: getClassificationDescription(type)
      };
      
      // Add to summary
      if (type === CLASSIFICATION_TYPES.DIRECT) {
        classification.summary.directIdentifiers.push(fieldName);
      } else if (type === CLASSIFICATION_TYPES.QUASI) {
        classification.summary.quasiIdentifiers.push(fieldName);
        // Analyze quasi-identifier
        classification.fields[fieldName].analysis = analyzeQuasiIdentifier(data, fieldName);
      } else if (type === CLASSIFICATION_TYPES.SENSITIVE) {
        classification.summary.sensitiveAttributes.push(fieldName);
      } else {
        classification.summary.nonSensitive.push(fieldName);
      }
    });
    
    // Generate risk indicators
    classification.riskIndicators = generateRiskIndicators(classification);
    
    return classification;
  },
  
  /**
   * Get classification for specific field
   */
  classifyField: (fieldName) => {
    return {
      field: fieldName,
      type: classifyField(fieldName),
      description: getClassificationDescription(classifyField(fieldName))
    };
  },
  
  /**
   * Check if field is identifier
   */
  isIdentifier: (fieldName) => {
    const type = classifyField(fieldName);
    return type === CLASSIFICATION_TYPES.DIRECT || type === CLASSIFICATION_TYPES.QUASI;
  },
  
  /**
   * Check if field is sensitive
   */
  isSensitive: (fieldName) => {
    const type = classifyField(fieldName);
    return type === CLASSIFICATION_TYPES.SENSITIVE;
  },
  
  CLASSIFICATION_TYPES
};

/**
 * Get description for classification type
 */
const getClassificationDescription = (type) => {
  switch (type) {
    case CLASSIFICATION_TYPES.DIRECT:
      return 'Direct identifier - Can directly identify an individual (e.g., name, email, phone)';
    case CLASSIFICATION_TYPES.QUASI:
      return 'Quasi-identifier - Can identify individuals when combined with other fields (e.g., age, zipcode)';
    case CLASSIFICATION_TYPES.SENSITIVE:
      return 'Sensitive attribute - Contains confidential information (e.g., income, health data)';
    default:
      return 'Non-sensitive - General information with low privacy risk';
  }
};

/**
 * Generate risk indicators based on classification
 */
const generateRiskIndicators = (classification) => {
  const indicators = [];
  
  // Check for high-risk combinations
  if (classification.summary.directIdentifiers.length > 0) {
    indicators.push({
      level: 'high',
      message: `Direct identifiers present: ${classification.summary.directIdentifiers.join(', ')}. Suppression required.`,
      recommendation: 'Remove or hash direct identifiers before release'
    });
  }
  
  if (classification.summary.quasiIdentifiers.length >= 3) {
    indicators.push({
      level: 'high',
      message: `Multiple quasi-identifiers detected (${classification.summary.quasiIdentifiers.length}). Risk of re-identification.`,
      recommendation: 'Apply generalization or k-anonymity techniques'
    });
  }
  
  if (classification.summary.sensitiveAttributes.length > 0) {
    indicators.push({
      level: 'medium',
      message: `Sensitive attributes present: ${classification.summary.sensitiveAttributes.join(', ')}`,
      recommendation: 'Consider differential privacy or access controls'
    });
  }
  
  // Check uniqueness of quasi-identifiers
  const highRiskQuasi = Object.entries(classification.fields)
    .filter(([_, info]) => info.type === CLASSIFICATION_TYPES.QUASI && info.analysis?.riskLevel === 'high')
    .map(([field, _]) => field);
  
  if (highRiskQuasi.length > 0) {
    indicators.push({
      level: 'high',
      message: `High uniqueness quasi-identifiers: ${highRiskQuasi.join(', ')}`,
      recommendation: 'Apply strong generalization or suppression'
    });
  }
  
  return indicators;
};

export { classifyField, CLASSIFICATION_PATTERNS };
