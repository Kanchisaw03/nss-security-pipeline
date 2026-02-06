import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage Layer
 * 
 * Logical data stores with simulated encryption:
 * - rawStore: Encrypted raw data
 * - anonymizedStore: Encrypted anonymized data
 * - releasedStore: Encrypted released datasets
 * 
 * Uses AES-256-GCM for simulated encryption
 */

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 64
};

// Derive key from master secret
const deriveKey = (secret, salt) => {
  return crypto.pbkdf2Sync(
    secret || process.env.ENCRYPTION_KEY || 'default-master-secret-change-in-production',
    salt,
    100000,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );
};

/**
 * Encrypt data using AES-256-GCM
 */
const encrypt = (data) => {
  try {
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const key = deriveKey(process.env.ENCRYPTION_KEY, salt);
    
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      key,
      iv
    );
    
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ENCRYPTION_CONFIG.algorithm
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt data
 */
const decrypt = (encryptedPackage) => {
  try {
    const salt = Buffer.from(encryptedPackage.salt, 'hex');
    const iv = Buffer.from(encryptedPackage.iv, 'hex');
    const tag = Buffer.from(encryptedPackage.tag, 'hex');
    const key = deriveKey(process.env.ENCRYPTION_KEY, salt);
    
    const decipher = crypto.createDecipheriv(
      encryptedPackage.algorithm || ENCRYPTION_CONFIG.algorithm,
      key,
      iv
    );
    
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedPackage.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Logical data stores
 */
const stores = {
  raw: new Map(),      // rawStore - encrypted raw data
  anonymized: new Map(), // anonymizedStore - encrypted anonymized data
  released: new Map(),   // releasedStore - encrypted released datasets
  metadata: new Map()    // Metadata store (unencrypted for querying)
};

/**
 * Storage service
 */
export const storageService = {
  /**
   * Store raw dataset
   */
  storeRaw: (datasetId, data, metadata = {}) => {
    const encrypted = encrypt(data);
    
    const storageRecord = {
      id: datasetId,
      type: 'raw',
      encrypted,
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString(),
        encrypted: true,
        algorithm: ENCRYPTION_CONFIG.algorithm
      }
    };
    
    stores.raw.set(datasetId, storageRecord);
    stores.metadata.set(datasetId, {
      id: datasetId,
      type: 'raw',
      ...metadata,
      storedAt: new Date().toISOString()
    });
    
    return storageRecord;
  },
  
  /**
   * Store anonymized dataset
   */
  storeAnonymized: (datasetId, data, metadata = {}) => {
    const encrypted = encrypt(data);
    
    const storageRecord = {
      id: datasetId,
      type: 'anonymized',
      encrypted,
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString(),
        encrypted: true,
        algorithm: ENCRYPTION_CONFIG.algorithm
      }
    };
    
    stores.anonymized.set(datasetId, storageRecord);
    
    // Update metadata
    const existingMeta = stores.metadata.get(datasetId) || {};
    stores.metadata.set(datasetId, {
      ...existingMeta,
      type: 'anonymized',
      anonymizedAt: new Date().toISOString()
    });
    
    return storageRecord;
  },
  
  /**
   * Store released dataset
   */
  storeReleased: (releaseId, data, metadata = {}) => {
    const encrypted = encrypt(data);
    
    const storageRecord = {
      id: releaseId,
      type: 'released',
      encrypted,
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString(),
        encrypted: true,
        algorithm: ENCRYPTION_CONFIG.algorithm,
        released: true
      }
    };
    
    stores.released.set(releaseId, storageRecord);
    
    return storageRecord;
  },
  
  /**
   * Retrieve raw dataset (decrypted)
   */
  retrieveRaw: (datasetId) => {
    const record = stores.raw.get(datasetId);
    if (!record) {
      throw new Error('Raw dataset not found');
    }
    
    return decrypt(record.encrypted);
  },
  
  /**
   * Retrieve anonymized dataset (decrypted)
   */
  retrieveAnonymized: (datasetId) => {
    const record = stores.anonymized.get(datasetId);
    if (!record) {
      throw new Error('Anonymized dataset not found');
    }
    
    return decrypt(record.encrypted);
  },
  
  /**
   * Retrieve released dataset (decrypted)
   */
  retrieveReleased: (releaseId) => {
    const record = stores.released.get(releaseId);
    if (!record) {
      throw new Error('Released dataset not found');
    }
    
    return decrypt(record.encrypted);
  },
  
  /**
   * Get metadata (unencrypted)
   */
  getMetadata: (datasetId) => {
    return stores.metadata.get(datasetId) || null;
  },
  
  /**
   * List all datasets
   */
  listDatasets: () => {
    return Array.from(stores.metadata.values());
  },
  
  /**
   * Check if dataset exists
   */
  exists: (datasetId) => {
    return stores.metadata.has(datasetId);
  },
  
  /**
   * Delete dataset (all stores)
   */
  delete: (datasetId) => {
    stores.raw.delete(datasetId);
    stores.anonymized.delete(datasetId);
    stores.metadata.delete(datasetId);
    // Note: Released datasets are not deleted for audit purposes
    return true;
  },
  
  /**
   * Get storage statistics
   */
  getStats: () => {
    return {
      raw: stores.raw.size,
      anonymized: stores.anonymized.size,
      released: stores.released.size,
      totalMetadata: stores.metadata.size
    };
  },

  /**
   * Expose stores for internal use
   */
  stores
};

export { encrypt, decrypt, stores };
