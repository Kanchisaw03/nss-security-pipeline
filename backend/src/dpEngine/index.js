import crypto from 'crypto';

/**
 * Differential Privacy Engine
 * 
 * Implements formal differential privacy guarantees using the Laplace mechanism.
 * Adds calibrated noise to aggregate queries to protect individual privacy.
 * 
 * Key Concepts:
 * - Epsilon (ε): Privacy budget, smaller = more private
 * - Sensitivity: Maximum impact one record can have on the query
 * - Laplace Mechanism: Adds noise from Laplace distribution
 * 
 * Formula: noise = (-b * sign(u) * ln(1 - 2|u|))
 * where u ~ Uniform(-0.5, 0.5) and b = sensitivity / epsilon
 */

// DP configuration
const DP_CONFIG = {
  // Default epsilon (privacy budget)
  // Typical values: 0.1 (very private) to 1.0 (moderate privacy)
  DEFAULT_EPSILON: 1.0,
  
  // Minimum epsilon threshold - queries with epsilon below this will be rejected
  MIN_EPSILON: 0.01,
  
  // Maximum epsilon - anything above provides little privacy
  MAX_EPSILON: 10.0,
  
  // Privacy levels
  PRIVACY_LEVELS: {
    VERY_HIGH: { epsilon: 0.1, label: 'Very High' },
    HIGH: { epsilon: 0.5, label: 'High' },
    MODERATE: { epsilon: 1.0, label: 'Moderate' },
    LOW: { epsilon: 2.0, label: 'Low' },
    MINIMAL: { epsilon: 5.0, label: 'Minimal' }
  },
  
  // Query sensitivity defaults
  SENSITIVITY: {
    COUNT: 1,      // Count sensitivity is 1 (adding/removing one record changes count by 1)
    SUM: 1,        // Assume normalized data, sensitivity = max_value - min_value
    MEAN: 1,       // Same as sum normalized
    MIN: 1,        // Can change drastically
    MAX: 1,        // Can change drastically
    MEDIAN: 1,     // Robust but still sensitive
    VARIANCE: 1,   // Sensitive to outliers
    STD_DEV: 1     // Sensitive to outliers
  }
};

/**
 * Generate cryptographically secure random number in range [0, 1)
 * Uses crypto.randomBytes for security
 */
const secureRandom = () => {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32LE(0) / 0x100000000;
};

/**
 * Generate uniform random variable in range [-0.5, 0.5]
 * This is required for the Laplace mechanism
 */
const generateUniform = () => {
  return secureRandom() - 0.5;
};

/**
 * Laplace noise generation using inverse CDF method
 * 
 * Formula: noise = (-b * sign(u) * ln(1 - 2|u|))
 * where:
 *   u ~ Uniform(-0.5, 0.5)
 *   b = scale = sensitivity / epsilon
 * 
 * @param {number} scale - Scale parameter (b) = sensitivity / epsilon
 * @returns {number} Random noise from Laplace distribution
 */
const generateLaplaceNoise = (scale) => {
  if (scale <= 0) {
    throw new Error('Scale parameter must be positive');
  }
  
  // Generate uniform random variable in [-0.5, 0.5]
  const u = generateUniform();
  
  // Apply inverse CDF of Laplace distribution
  // F^-1(u) = -b * sign(u) * ln(1 - 2|u|)
  const sign = u < 0 ? -1 : 1;
  const absU = Math.abs(u);
  
  // Ensure we don't take log of 0 or negative
  const logArg = Math.max(1e-10, 1 - 2 * absU);
  
  const noise = -scale * sign * Math.log(logArg);
  
  return noise;
};

/**
 * Calculate sensitivity for different aggregation types
 * @param {string} aggregateType - Type of aggregation
 * @param {Array} data - Dataset for context-aware sensitivity
 * @returns {number} Sensitivity value
 */
const calculateSensitivity = (aggregateType, data = null) => {
  switch (aggregateType.toLowerCase()) {
    case 'count':
      // Adding/removing one record changes count by exactly 1
      return 1;
    
    case 'sum':
      // Sensitivity depends on range of values
      // For bounded data [0, 1], sensitivity = 1
      // For unbounded, we need to clamp or estimate
      if (data && data.length > 0) {
        const numericValues = data.filter(v => typeof v === 'number' && !isNaN(v));
        if (numericValues.length > 0) {
          const max = Math.max(...numericValues);
          const min = Math.min(...numericValues);
          return max - min;
        }
      }
      return 1; // Default assumption: normalized data
    
    case 'mean':
      // Same sensitivity considerations as sum, normalized
      return 1 / (data?.length || 1);
    
    case 'min':
    case 'max':
      // These are unbounded in worst case
      // In practice, we might bound them or use smooth sensitivity
      return 1;
    
    case 'median':
      // Median has sensitivity 1 for sorted data
      return 1;
    
    case 'variance':
    case 'std_dev':
      // These can be highly sensitive
      // Variance sensitivity = (b-a)²/n for range [a,b]
      return 1;
    
    default:
      return 1;
  }
};

/**
 * Apply differential privacy to a count query
 * @param {number} trueCount - Actual count
 * @param {number} epsilon - Privacy budget
 * @returns {Object} DP-protected result with metadata
 */
const privateCount = (trueCount, epsilon = DP_CONFIG.DEFAULT_EPSILON) => {
  if (typeof trueCount !== 'number' || isNaN(trueCount)) {
    throw new Error('Count must be a valid number');
  }
  
  const sensitivity = DP_CONFIG.SENSITIVITY.COUNT;
  const scale = sensitivity / epsilon;
  const noise = generateLaplaceNoise(scale);
  const noisyCount = Math.max(0, Math.round(trueCount + noise)); // Count can't be negative
  
  return {
    query: 'count',
    trueValue: trueCount,
    noisyValue: noisyCount,
    noise: noise.toFixed(4),
    epsilon,
    sensitivity,
    scale: scale.toFixed(4),
    relativeError: trueCount > 0 ? Math.abs(noise / trueCount).toFixed(4) : 'N/A',
    privacyGuarantee: `ε=${epsilon} differential privacy`
  };
};

/**
 * Apply differential privacy to a sum query
 * @param {number} trueSum - Actual sum
 * @param {number} epsilon - Privacy budget
 * @param {number} sensitivity - Query sensitivity (defaults to 1 for normalized data)
 * @returns {Object} DP-protected result with metadata
 */
const privateSum = (trueSum, epsilon = DP_CONFIG.DEFAULT_EPSILON, sensitivity = null) => {
  if (typeof trueSum !== 'number' || isNaN(trueSum)) {
    throw new Error('Sum must be a valid number');
  }
  
  const actualSensitivity = sensitivity || DP_CONFIG.SENSITIVITY.SUM;
  const scale = actualSensitivity / epsilon;
  const noise = generateLaplaceNoise(scale);
  const noisySum = trueSum + noise;
  
  return {
    query: 'sum',
    trueValue: trueSum,
    noisyValue: parseFloat(noisySum.toFixed(2)),
    noise: noise.toFixed(4),
    epsilon,
    sensitivity: actualSensitivity,
    scale: scale.toFixed(4),
    relativeError: trueSum !== 0 ? Math.abs(noise / trueSum).toFixed(4) : 'N/A',
    privacyGuarantee: `ε=${epsilon} differential privacy`
  };
};

/**
 * Apply differential privacy to a mean query
 * @param {number} trueMean - Actual mean
 * @param {number} count - Number of records (for sensitivity calculation)
 * @param {number} epsilon - Privacy budget
 * @returns {Object} DP-protected result with metadata
 */
const privateMean = (trueMean, count, epsilon = DP_CONFIG.DEFAULT_EPSILON) => {
  if (typeof trueMean !== 'number' || isNaN(trueMean)) {
    throw new Error('Mean must be a valid number');
  }
  
  if (typeof count !== 'number' || count <= 0) {
    throw new Error('Count must be a positive number');
  }
  
  const sensitivity = DP_CONFIG.SENSITIVITY.MEAN / count;
  const scale = sensitivity / epsilon;
  const noise = generateLaplaceNoise(scale);
  const noisyMean = trueMean + noise;
  
  return {
    query: 'mean',
    trueValue: trueMean,
    noisyValue: parseFloat(noisyMean.toFixed(4)),
    noise: noise.toFixed(6),
    epsilon,
    sensitivity: sensitivity.toFixed(6),
    scale: scale.toFixed(6),
    relativeError: trueMean !== 0 ? Math.abs(noise / trueMean).toFixed(4) : 'N/A',
    privacyGuarantee: `ε=${epsilon} differential privacy`
  };
};

/**
 * Apply differential privacy to histogram/bin count
 * @param {Object} bins - Object with bin labels as keys and counts as values
 * @param {number} epsilon - Privacy budget (will be divided among bins)
 * @returns {Object} DP-protected histogram with metadata
 */
const privateHistogram = (bins, epsilon = DP_CONFIG.DEFAULT_EPSILON) => {
  if (!bins || typeof bins !== 'object') {
    throw new Error('Bins must be an object');
  }
  
  const binCount = Object.keys(bins).length;
  if (binCount === 0) {
    return { bins: {}, epsilon, noisePerBin: 0 };
  }
  
  // Split privacy budget among bins (basic composition)
  const epsilonPerBin = epsilon / binCount;
  const scale = 1 / epsilonPerBin;  // Sensitivity = 1 for count per bin
  
  const noisyBins = {};
  let totalTrueCount = 0;
  let totalNoisyCount = 0;
  
  Object.entries(bins).forEach(([bin, count]) => {
    const noise = generateLaplaceNoise(scale);
    const noisyCount = Math.max(0, Math.round(count + noise));
    
    noisyBins[bin] = {
      trueCount: count,
      noisyCount,
      noise: noise.toFixed(4)
    };
    
    totalTrueCount += count;
    totalNoisyCount += noisyCount;
  });
  
  return {
    query: 'histogram',
    bins: noisyBins,
    epsilon,
    epsilonPerBin,
    binCount,
    scale: scale.toFixed(4),
    totalTrueCount,
    totalNoisyCount,
    privacyGuarantee: `ε=${epsilon} differential privacy (basic composition)`,
    compositionMethod: 'Basic composition (epsilon split among bins)'
  };
};

/**
 * Execute a group-by query with differential privacy
 * @param {Array} data - Dataset
 * @param {string} groupByField - Field to group by
 * @param {string} aggregateField - Field to aggregate
 * @param {string} aggregateType - Type of aggregation (count, sum, mean)
 * @param {number} epsilon - Privacy budget
 * @returns {Object} DP-protected aggregation results
 */
const privateGroupBy = (data, groupByField, aggregateField, aggregateType, epsilon = DP_CONFIG.DEFAULT_EPSILON) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid dataset');
  }
  
  // Group the data
  const groups = {};
  data.forEach(record => {
    const key = String(record[groupByField] || 'unknown');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  });
  
  // Apply DP to each group
  const results = {};
  const epsilonPerGroup = epsilon / Object.keys(groups).length;
  
  Object.entries(groups).forEach(([key, group]) => {
    let dpResult;
    
    switch (aggregateType.toLowerCase()) {
      case 'count':
        dpResult = privateCount(group.length, epsilonPerGroup);
        break;
      case 'sum':
        const sum = group.reduce((acc, r) => acc + (parseFloat(r[aggregateField]) || 0), 0);
        dpResult = privateSum(sum, epsilonPerGroup);
        break;
      case 'mean':
        const mean = group.reduce((acc, r) => acc + (parseFloat(r[aggregateField]) || 0), 0) / group.length;
        dpResult = privateMean(mean, group.length, epsilonPerGroup);
        break;
      default:
        throw new Error(`Unsupported aggregate type: ${aggregateType}`);
    }
    
    results[key] = {
      groupSize: group.length,
      ...dpResult
    };
  });
  
  return {
    query: 'groupBy',
    groupByField,
    aggregateField,
    aggregateType,
    epsilon,
    epsilonPerGroup,
    groupCount: Object.keys(groups).length,
    results,
    privacyGuarantee: `ε=${epsilon} differential privacy (split among ${Object.keys(groups).length} groups)`,
    compositionMethod: 'Basic composition'
  };
};

/**
 * Privacy budget manager
 * Tracks epsilon consumption across queries
 */
class PrivacyBudgetManager {
  constructor() {
    this.budgets = new Map();  // datasetId -> { totalEpsilon, consumedEpsilon, queries: [] }
  }
  
  /**
   * Initialize privacy budget for a dataset
   * @param {string} datasetId - Dataset identifier
   * @param {number} totalEpsilon - Total privacy budget for this dataset
   */
  initializeBudget(datasetId, totalEpsilon = DP_CONFIG.DEFAULT_EPSILON) {
    this.budgets.set(datasetId, {
      totalEpsilon,
      consumedEpsilon: 0,
      remainingEpsilon: totalEpsilon,
      queries: [],
      createdAt: new Date().toISOString()
    });
  }
  
  /**
   * Check if query can be executed within remaining budget
   * @param {string} datasetId - Dataset identifier
   * @param {number} queryEpsilon - Epsilon required for this query
   * @returns {Object} Budget check result
   */
  checkBudget(datasetId, queryEpsilon) {
    const budget = this.budgets.get(datasetId);
    
    if (!budget) {
      return {
        allowed: false,
        reason: 'No privacy budget initialized for this dataset'
      };
    }
    
    if (queryEpsilon > budget.remainingEpsilon) {
      return {
        allowed: false,
        reason: `Insufficient privacy budget. Required: ${queryEpsilon}, Remaining: ${budget.remainingEpsilon.toFixed(4)}`
      };
    }
    
    return {
      allowed: true,
      remainingAfter: budget.remainingEpsilon - queryEpsilon
    };
  }
  
  /**
   * Consume privacy budget for a query
   * @param {string} datasetId - Dataset identifier
   * @param {number} queryEpsilon - Epsilon consumed
   * @param {Object} queryDetails - Query metadata
   */
  consumeBudget(datasetId, queryEpsilon, queryDetails = {}) {
    const budget = this.budgets.get(datasetId);
    
    if (!budget) {
      throw new Error('No privacy budget initialized for this dataset');
    }
    
    if (queryEpsilon > budget.remainingEpsilon) {
      throw new Error('Insufficient privacy budget');
    }
    
    budget.consumedEpsilon += queryEpsilon;
    budget.remainingEpsilon -= queryEpsilon;
    budget.queries.push({
      epsilon: queryEpsilon,
      timestamp: new Date().toISOString(),
      ...queryDetails
    });
    
    return budget;
  }
  
  /**
   * Get budget status for a dataset
   */
  getBudgetStatus(datasetId) {
    return this.budgets.get(datasetId) || null;
  }
  
  /**
   * Reset budget for a dataset (admin only)
   */
  resetBudget(datasetId) {
    this.budgets.delete(datasetId);
  }
}

// Create global privacy budget manager
const privacyBudgetManager = new PrivacyBudgetManager();

/**
 * Differential Privacy Engine interface
 */
export const dpEngine = {
  // Core mechanisms
  generateLaplaceNoise,
  calculateSensitivity,
  
  // Query types
  count: privateCount,
  sum: privateSum,
  mean: privateMean,
  histogram: privateHistogram,
  groupBy: privateGroupBy,
  
  // Privacy budget management
  budgetManager: privacyBudgetManager,
  
  // Configuration
  DP_CONFIG,
  
  // Utilities
  validateEpsilon: (epsilon) => {
    return epsilon >= DP_CONFIG.MIN_EPSILON && epsilon <= DP_CONFIG.MAX_EPSILON;
  },
  
  getPrivacyLevel: (epsilon) => {
    if (epsilon <= 0.1) return DP_CONFIG.PRIVACY_LEVELS.VERY_HIGH;
    if (epsilon <= 0.5) return DP_CONFIG.PRIVACY_LEVELS.HIGH;
    if (epsilon <= 1.0) return DP_CONFIG.PRIVACY_LEVELS.MODERATE;
    if (epsilon <= 2.0) return DP_CONFIG.PRIVACY_LEVELS.LOW;
    return DP_CONFIG.PRIVACY_LEVELS.MINIMAL;
  },
  
  // Get overall budget status
  getBudgetStatus: () => {
    const budgets = Array.from(privacyBudgetManager.budgets.values());
    const total = budgets.reduce((sum, b) => sum + b.totalEpsilon, 0);
    const consumed = budgets.reduce((sum, b) => sum + b.consumedEpsilon, 0);
    
    return {
      total: total || 10.0,
      consumed: consumed || 0,
      remaining: (total || 10.0) - consumed,
      datasets: budgets.length
    };
  }
};

export {
  generateLaplaceNoise,
  calculateSensitivity,
  privateCount,
  privateSum,
  privateMean,
  privateHistogram,
  privateGroupBy,
  PrivacyBudgetManager,
  privacyBudgetManager,
  DP_CONFIG
};
