/**
 * Attack Simulation Engine
 * 
 * Simulates privacy attacks on anonymized datasets:
 * A. Linkage Attack - Match on quasi-identifiers
 * B. Homogeneity Attack - Check sensitive attribute consistency
 * C. Background Knowledge Attack - Probabilistic re-identification
 */

import { v4 as uuidv4 } from 'uuid';

// Store attack results
const attackResults = new Map();

/**
 * Create quasi-key for matching
 */
const createQuasiKey = (record, quasiFields) => {
  return quasiFields
    .map(field => String(record[field] || ''))
    .join('|');
};

/**
 * A. Linkage Attack Simulation
 * 
 * Input: anonymized dataset + auxiliary dataset
 * Match on quasi-identifiers
 * uniqueMatchRate = matchesWithSingleCandidate / totalRecords
 */
const simulateLinkageAttack = (anonymizedData, auxiliaryData, quasiFields) => {
  try {
    if (!quasiFields || quasiFields.length === 0) {
      throw new Error('Quasi-fields required for linkage attack');
    }
    
    // Build index of anonymized dataset by quasi-key
    const anonIndex = new Map();
    anonymizedData.forEach((record, idx) => {
      const key = createQuasiKey(record, quasiFields);
      if (!anonIndex.has(key)) {
        anonIndex.set(key, []);
      }
      anonIndex.get(key).push({ record, index: idx });
    });
    
    // Attempt linkage using auxiliary data
    let totalAttempts = 0;
    let successfulMatches = 0;
    let uniqueMatches = 0;
    let ambiguousMatches = 0;
    let noMatches = 0;
    
    const matchDetails = [];
    
    auxiliaryData.forEach((auxRecord, auxIdx) => {
      // Check if aux record has same quasi-identifiers
      const hasAllQuasi = quasiFields.every(field => auxRecord[field] !== undefined);
      if (!hasAllQuasi) return;
      
      totalAttempts++;
      const key = createQuasiKey(auxRecord, quasiFields);
      const candidates = anonIndex.get(key) || [];
      
      if (candidates.length === 0) {
        noMatches++;
        matchDetails.push({
          auxIndex: auxIdx,
          result: 'no_match',
          candidates: 0
        });
      } else if (candidates.length === 1) {
        uniqueMatches++;
        successfulMatches++;
        matchDetails.push({
          auxIndex: auxIdx,
          result: 'unique_match',
          candidates: 1,
          matchedRecord: candidates[0].index
        });
      } else {
        ambiguousMatches++;
        successfulMatches++;
        matchDetails.push({
          auxIndex: auxIdx,
          result: 'ambiguous',
          candidates: candidates.length
        });
      }
    });
    
    // Calculate rates
    const uniqueMatchRate = totalAttempts > 0 
      ? (uniqueMatches / totalAttempts) * 100 
      : 0;
    
    const reidentificationRisk = totalAttempts > 0
      ? (uniqueMatches / anonymizedData.length) * 100
      : 0;
    
    return {
      attackType: 'linkage',
      totalAttempts,
      successfulMatches,
      uniqueMatches,
      ambiguousMatches,
      noMatches,
      uniqueMatchRate: Math.round(uniqueMatchRate * 100) / 100,
      reidentificationRisk: Math.round(reidentificationRisk * 100) / 100,
      matchConfidence: totalAttempts > 0 
        ? Math.round((uniqueMatches / totalAttempts) * 100) / 100
        : 0,
      details: matchDetails.slice(0, 100) // Limit details
    };
    
  } catch (error) {
    throw new Error(`Linkage attack simulation failed: ${error.message}`);
  }
};

/**
 * B. Homogeneity Attack Simulation
 * 
 * Check if sensitive attribute is same across quasi-identifier groups
 * If a group has all same sensitive values, attacker can infer with certainty
 */
const simulateHomogeneityAttack = (anonymizedData, quasiFields, sensitiveFields) => {
  try {
    if (!sensitiveFields || sensitiveFields.length === 0) {
      throw new Error('Sensitive fields required for homogeneity attack');
    }
    
    // Group by quasi-identifiers
    const groups = {};
    anonymizedData.forEach(record => {
      const key = createQuasiKey(record, quasiFields);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });
    
    // Check homogeneity in each group
    let vulnerableGroups = 0;
    let totalGroups = 0;
    const homogeneityDetails = [];
    
    Object.entries(groups).forEach(([key, records]) => {
      totalGroups++;
      const groupSize = records.length;
      
      sensitiveFields.forEach(sensitiveField => {
        const values = records.map(r => r[sensitiveField]);
        const uniqueValues = new Set(values);
        
        // If only 1 unique value in group, it's homogeneous
        if (uniqueValues.size === 1) {
          vulnerableGroups++;
          homogeneityDetails.push({
            quasiKey: key,
            groupSize,
            sensitiveField,
            sensitiveValue: values[0],
            vulnerability: 'certain_inference'
          });
        } else if (uniqueValues.size <= 2) {
          // Low diversity - partial vulnerability
          homogeneityDetails.push({
            quasiKey: key,
            groupSize,
            sensitiveField,
            uniqueValues: uniqueValues.size,
            vulnerability: 'probable_inference'
          });
        }
      });
    });
    
    // Calculate attack success rate
    const homogeneityRate = totalGroups > 0
      ? (vulnerableGroups / (totalGroups * sensitiveFields.length)) * 100
      : 0;
    
    return {
      attackType: 'homogeneity',
      totalGroups,
      vulnerableGroups,
      homogeneityRate: Math.round(homogeneityRate * 100) / 100,
      riskLevel: homogeneityRate > 20 ? 'High' : homogeneityRate > 10 ? 'Medium' : 'Low',
      details: homogeneityDetails.slice(0, 100)
    };
    
  } catch (error) {
    throw new Error(`Homogeneity attack simulation failed: ${error.message}`);
  }
};

/**
 * C. Background Knowledge Attack Simulation
 * 
 * Assume attacker knows 2 quasi-identifiers + 1 sensitive value
 * Compute probability of narrowing to single record
 */
const simulateBackgroundKnowledgeAttack = (anonymizedData, quasiFields, sensitiveFields) => {
  try {
    if (!quasiFields || quasiFields.length < 2) {
      throw new Error('At least 2 quasi-fields required for background knowledge attack');
    }
    
    if (!sensitiveFields || sensitiveFields.length === 0) {
      throw new Error('Sensitive fields required');
    }
    
    // Simulate attacker with knowledge of 2 quasi + 1 sensitive
    const sampleQuasiPairs = [];
    for (let i = 0; i < Math.min(quasiFields.length - 1, 3); i++) {
      sampleQuasiPairs.push([quasiFields[i], quasiFields[i + 1]]);
    }
    
    let totalSimulations = 0;
    let successfulNarrowing = 0;
    let narrowedToSingle = 0;
    const attackDetails = [];
    
    // Run simulations
    sampleQuasiPairs.forEach(([field1, field2]) => {
      // Sample records to simulate attacker knowing about them
      const sampleSize = Math.min(anonymizedData.length, 50);
      const samples = anonymizedData.slice(0, sampleSize);
      
      samples.forEach(targetRecord => {
        const knownValues = {
          [field1]: targetRecord[field1],
          [field2]: targetRecord[field2],
          sensitive: targetRecord[sensitiveFields[0]]
        };
        
        // Find candidates matching known quasi-ids
        const candidates = anonymizedData.filter(r => 
          r[field1] === knownValues[field1] && 
          r[field2] === knownValues[field2]
        );
        
        totalSimulations++;
        
        if (candidates.length === 1) {
          narrowedToSingle++;
          successfulNarrowing++;
        } else if (candidates.length > 1) {
          // Check if sensitive value helps narrow further
          const withSensitive = candidates.filter(r => 
            r[sensitiveFields[0]] === knownValues.sensitive
          );
          
          if (withSensitive.length === 1) {
            narrowedToSingle++;
            successfulNarrowing++;
          } else if (withSensitive.length < candidates.length) {
            successfulNarrowing++;
          }
        }
        
        attackDetails.push({
          knownQuasiFields: [field1, field2],
          knownSensitiveField: sensitiveFields[0],
          candidatesBeforeSensitive: candidates.length,
          reidentificationProbability: candidates.length === 1 ? 1.0 : 1.0 / candidates.length
        });
      });
    });
    
    // Calculate attack metrics
    const narrowingSuccessRate = totalSimulations > 0
      ? (successfulNarrowing / totalSimulations) * 100
      : 0;
    
    const uniqueIdentificationRate = totalSimulations > 0
      ? (narrowedToSingle / totalSimulations) * 100
      : 0;
    
    // Calculate overall attack risk score (0-100)
    const attackRiskScore = Math.min(100, 
      (uniqueIdentificationRate * 0.6) + (narrowingSuccessRate * 0.4)
    );
    
    return {
      attackType: 'background_knowledge',
      totalSimulations,
      successfulNarrowing,
      narrowedToSingle,
      narrowingSuccessRate: Math.round(narrowingSuccessRate * 100) / 100,
      uniqueIdentificationRate: Math.round(uniqueIdentificationRate * 100) / 100,
      attackRiskScore: Math.round(attackRiskScore * 100) / 100,
      riskLevel: attackRiskScore > 50 ? 'High' : attackRiskScore > 25 ? 'Medium' : 'Low',
      details: attackDetails.slice(0, 100)
    };
    
  } catch (error) {
    throw new Error(`Background knowledge attack simulation failed: ${error.message}`);
  }
};

/**
 * Run all attack simulations
 */
const runAllAttacks = (anonymizedData, auxiliaryData, classification) => {
  try {
    const attackId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Extract fields from classification
    const quasiFields = classification.summary?.quasiIdentifiers || [];
    const sensitiveFields = classification.summary?.sensitiveAttributes || [];
    
    if (quasiFields.length === 0) {
      throw new Error('No quasi-identifiers found in dataset');
    }
    
    // Run individual attacks
    const linkageResult = simulateLinkageAttack(
      anonymizedData, 
      auxiliaryData || anonymizedData, // Use same data if no aux provided
      quasiFields
    );
    
    const homogeneityResult = sensitiveFields.length > 0
      ? simulateHomogeneityAttack(anonymizedData, quasiFields, sensitiveFields)
      : { attackType: 'homogeneity', skipped: true, reason: 'No sensitive fields' };
    
    const backgroundResult = simulateBackgroundKnowledgeAttack(
      anonymizedData,
      quasiFields,
      sensitiveFields.length > 0 ? sensitiveFields : quasiFields.slice(0, 1)
    );
    
    // Calculate composite risk score
    const linkageWeight = 0.4;
    const homogeneityWeight = sensitiveFields.length > 0 ? 0.3 : 0;
    const backgroundWeight = sensitiveFields.length > 0 ? 0.3 : 0.6;
    
    const compositeScore = 
      (linkageResult.uniqueMatchRate || 0) * linkageWeight +
      (homogeneityResult.homogeneityRate || 0) * homogeneityWeight +
      (backgroundResult.attackRiskScore || 0) * backgroundWeight;
    
    const result = {
      attackId,
      timestamp,
      datasetSize: anonymizedData.length,
      attacks: {
        linkage: linkageResult,
        homogeneity: homogeneityResult,
        backgroundKnowledge: backgroundResult
      },
      summary: {
        compositeRiskScore: Math.round(compositeScore * 100) / 100,
        riskLevel: compositeScore > 50 ? 'High' : compositeScore > 25 ? 'Medium' : 'Low',
        mostDangerousAttack: Math.max(
          { type: 'linkage', score: linkageResult.uniqueMatchRate || 0 },
          { type: 'homogeneity', score: homogeneityResult.homogeneityRate || 0 },
          { type: 'background', score: backgroundResult.attackRiskScore || 0 },
          (a, b) => a.score - b.score
        ).type,
        recommendations: generateAttackRecommendations(linkageResult, homogeneityResult, backgroundResult)
      }
    };
    
    // Store result
    attackResults.set(attackId, result);
    
    return result;
    
  } catch (error) {
    throw new Error(`Attack simulation failed: ${error.message}`);
  }
};

/**
 * Generate recommendations based on attack results
 */
const generateAttackRecommendations = (linkage, homogeneity, background) => {
  const recommendations = [];
  
  if (linkage.uniqueMatchRate > 20) {
    recommendations.push('High unique match rate: Increase generalization level or add suppression');
  }
  
  if (homogeneity.homogeneityRate > 15) {
    recommendations.push('Homogeneity detected: Apply l-diversity constraints to sensitive fields');
  }
  
  if (background.attackRiskScore > 30) {
    recommendations.push('Background knowledge attack vulnerable: Consider t-closeness or stronger anonymization');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Dataset appears resilient to simulated attacks');
  }
  
  return recommendations;
};

/**
 * Get attack result by ID
 */
const getAttackResult = (attackId) => {
  return attackResults.get(attackId) || null;
};

/**
 * List attack results
 */
const listAttackResults = (filters = {}) => {
  let results = Array.from(attackResults.values());
  
  if (filters.riskLevel) {
    results = results.filter(r => r.summary.riskLevel === filters.riskLevel);
  }
  
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/**
 * Attack Simulation Engine Interface
 */
export const attackSimulation = {
  runAllAttacks,
  simulateLinkageAttack,
  simulateHomogeneityAttack,
  simulateBackgroundKnowledgeAttack,
  getAttackResult,
  listAttackResults,
  
  // Get overall attack surface status
  getAttackSurfaceStatus: () => {
    const results = listAttackResults();
    if (results.length === 0) {
      return {
        overallRisk: 0,
        linkageRisk: 0,
        homogeneityRisk: 0,
        backgroundKnowledgeRisk: 0,
        trend: 'stable',
        lastUpdated: new Date().toISOString()
      };
    }
    
    const latest = results[0];
    return {
      overallRisk: Math.round(latest.summary.compositeRiskScore),
      linkageRisk: Math.round(latest.attacks.linkage.uniqueMatchRate),
      homogeneityRisk: Math.round(latest.attacks.homogeneity.homogeneityRate),
      backgroundKnowledgeRisk: Math.round(latest.attacks.backgroundKnowledge.attackRiskScore),
      trend: 'stable',
      lastUpdated: latest.timestamp
    };
  }
};

export {
  runAllAttacks,
  simulateLinkageAttack,
  simulateHomogeneityAttack,
  simulateBackgroundKnowledgeAttack,
  getAttackResult,
  listAttackResults
};
