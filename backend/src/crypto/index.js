import crypto from 'crypto';

/**
 * Enhanced Cryptography Layer
 * 
 * Defense-in-depth encryption with:
 * - Dataset Encryption at Rest (DEK/KEK model)
 * - AES-256-GCM for data encryption
 * - AES-256-ECB for DEK encryption
 * - Deterministic tokenization for direct identifiers
 * 
 * Security Model:
 * - Each dataset gets a unique Data Encryption Key (DEK)
 * - DEK is encrypted with Key Encryption Key (KEK) derived from master secret
 * - Master key never stored with data
 * - Supports key rotation
 */

// Cryptographic constants
const CRYPTO_CONFIG = {
  // DEK (Data Encryption Key) - AES-256 requires 32 bytes
  DEK_LENGTH: 32,
  
  // IV for AES-GCM - 12 bytes recommended for performance
  IV_LENGTH: 12,
  
  // Auth tag for GCM - 16 bytes
  AUTH_TAG_LENGTH: 16,
  
  // Salt length for PBKDF2
  SALT_LENGTH: 32,
  
  // PBKDF2 iterations
  PBKDF2_ITERATIONS: 100000,
  
  // Algorithms
  DATA_ALGORITHM: 'aes-256-gcm',
  DEK_ALGORITHM: 'aes-256-ecb',  // ECB is safe for encrypting single blocks (DEKs)
  HASH_ALGORITHM: 'sha256',
  HMAC_ALGORITHM: 'sha256'
};

/**
 * Validate environment configuration
 */
const validateConfig = () => {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  const hashSecret = process.env.HASH_SECRET;
  
  if (!masterKey || masterKey.length < 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must be set and at least 32 characters');
  }
  
  if (!hashSecret || hashSecret.length < 32) {
    throw new Error('HASH_SECRET must be set and at least 32 characters');
  }
  
  return true;
};

/**
 * Derive Key Encryption Key (KEK) from master secret
 * Uses SHA-256 to derive 256-bit key
 */
const deriveKEK = () => {
  validateConfig();
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  
  // Derive KEK using SHA-256
  return crypto.createHash(CRYPTO_CONFIG.HASH_ALGORITHM)
    .update(masterKey)
    .digest();
};

/**
 * Generate random Data Encryption Key (DEK)
 * Returns 256-bit random key
 */
const generateDEK = () => {
  return crypto.randomBytes(CRYPTO_CONFIG.DEK_LENGTH);
};

/**
 * Encrypt DEK using KEK (AES-256-ECB)
 * ECB is acceptable here because we're encrypting a single fixed-size block
 */
const encryptDEK = (dek) => {
  try {
    const kek = deriveKEK();
    
    // Create ECB cipher
    const cipher = crypto.createCipheriv(
      CRYPTO_CONFIG.DEK_ALGORITHM,
      kek,
      Buffer.alloc(0)  // ECB doesn't use IV
    );
    
    // Encrypt DEK (must be exact block size)
    let encrypted = cipher.update(dek);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return encrypted.toString('base64');
  } catch (error) {
    throw new Error(`DEK encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt DEK using KEK (AES-256-ECB)
 */
const decryptDEK = (encryptedDEK) => {
  try {
    const kek = deriveKEK();
    const encryptedBuffer = Buffer.from(encryptedDEK, 'base64');
    
    // Create ECB decipher
    const decipher = crypto.createDecipheriv(
      CRYPTO_CONFIG.DEK_ALGORITHM,
      kek,
      Buffer.alloc(0)  // ECB doesn't use IV
    );
    
    // Decrypt DEK
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  } catch (error) {
    throw new Error(`DEK decryption failed: ${error.message}`);
  }
};

/**
 * Encrypt dataset using DEK (AES-256-GCM)
 * Returns encrypted payload with all necessary components
 */
const encryptDataset = (data, dek) => {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(CRYPTO_CONFIG.IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      CRYPTO_CONFIG.DATA_ALGORITHM,
      dek,
      iv
    );
    
    // Convert data to JSON string
    const jsonData = JSON.stringify(data);
    
    // Encrypt data
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: CRYPTO_CONFIG.DATA_ALGORITHM
    };
  } catch (error) {
    throw new Error(`Dataset encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt dataset using DEK (AES-256-GCM)
 */
const decryptDataset = (encryptedPayload, dek) => {
  try {
    const { encryptedData, iv, authTag, algorithm } = encryptedPayload;
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      algorithm || CRYPTO_CONFIG.DATA_ALGORITHM,
      dek,
      Buffer.from(iv, 'base64')
    );
    
    // Set authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Dataset decryption failed: ${error.message}`);
  }
};

/**
 * Full encryption pipeline for a dataset
 * Returns encrypted data + encrypted DEK + metadata
 */
const encryptDataWithKeyHierarchy = (data) => {
  try {
    // Generate new DEK for this dataset
    const dek = generateDEK();
    
    // Encrypt dataset with DEK
    const encryptedPayload = encryptDataset(data, dek);
    
    // Encrypt DEK with KEK
    const encryptedDEK = encryptDEK(dek);
    
    return {
      encryptedData: encryptedPayload.encryptedData,
      encryptedDEK: encryptedDEK,
      iv: encryptedPayload.iv,
      authTag: encryptedPayload.authTag,
      algorithm: encryptedPayload.algorithm,
      keyVersion: 1,  // For future key rotation
      encryptedAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Full encryption pipeline failed: ${error.message}`);
  }
};

/**
 * Full decryption pipeline
 * Takes encrypted package and returns original data
 */
const decryptDataWithKeyHierarchy = (encryptedPackage) => {
  try {
    // Decrypt DEK
    const dek = decryptDEK(encryptedPackage.encryptedDEK);
    
    // Decrypt dataset
    const decryptedData = decryptDataset({
      encryptedData: encryptedPackage.encryptedData,
      iv: encryptedPackage.iv,
      authTag: encryptedPackage.authTag,
      algorithm: encryptedPackage.algorithm
    }, dek);
    
    return decryptedData;
  } catch (error) {
    throw new Error(`Full decryption pipeline failed: ${error.message}`);
  }
};

/**
 * Deterministic Tokenization using HMAC-SHA256
 * Same input always produces same output (for linkability)
 * Used for direct identifiers: name, email, phone, etc.
 * 
 * @param {string} value - Value to tokenize
 * @param {string} context - Context/category (e.g., 'email', 'phone') for additional salt
 * @returns {string} Deterministic token
 */
const tokenize = (value, context = 'default') => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  try {
    validateConfig();
    const hashSecret = process.env.HASH_SECRET;
    
    // Create HMAC with context-specific key derivation
    const hmac = crypto.createHmac(CRYPTO_CONFIG.HMAC_ALGORITHM, hashSecret);
    
    // Include context to prevent cross-context attacks
    hmac.update(`${context}:${String(value).toLowerCase().trim()}`);
    
    // Return first 32 chars of hex digest for readability
    const token = hmac.digest('hex').substring(0, 32);
    
    return `TKN_${token}`;
  } catch (error) {
    throw new Error(`Tokenization failed: ${error.message}`);
  }
};

/**
 * Verify that a value matches a token
 * Used for lookup without revealing actual values
 */
const verifyToken = (value, token, context = 'default') => {
  if (!value || !token) return false;
  
  try {
    const computedToken = tokenize(value, context);
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(computedToken),
      Buffer.from(token)
    );
  } catch (error) {
    return false;
  }
};

/**
 * One-way hash for non-reversible operations
 * Different from tokenization - cannot be reversed or verified without original value
 */
const hashOneWay = (value, salt = '') => {
  if (value === null || value === undefined) return null;
  
  try {
    const hash = crypto.createHash(CRYPTO_CONFIG.HASH_ALGORITHM);
    hash.update(String(value));
    if (salt) hash.update(salt);
    return `HASH_${hash.digest('hex').substring(0, 32)}`;
  } catch (error) {
    throw new Error(`Hashing failed: ${error.message}`);
  }
};

/**
 * Generate cryptographically secure random ID
 */
const generateSecureId = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Secure comparison of secrets (timing-safe)
 */
const secureCompare = (a, b) => {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (error) {
    return false;
  }
};

/**
 * Key rotation helper
 * Re-encrypts DEK with new KEK
 */
const rotateDEK = (encryptedDEK, oldMasterKey, newMasterKey) => {
  try {
    // Temporarily set old key to decrypt
    const originalKey = process.env.ENCRYPTION_MASTER_KEY;
    process.env.ENCRYPTION_MASTER_KEY = oldMasterKey;
    
    // Decrypt DEK
    const dek = decryptDEK(encryptedDEK);
    
    // Set new key
    process.env.ENCRYPTION_MASTER_KEY = newMasterKey;
    
    // Re-encrypt DEK
    const newEncryptedDEK = encryptDEK(dek);
    
    // Restore original
    process.env.ENCRYPTION_MASTER_KEY = originalKey;
    
    return newEncryptedDEK;
  } catch (error) {
    throw new Error(`Key rotation failed: ${error.message}`);
  }
};

/**
 * Export cryptographic service
 */
export const cryptoService = {
  // Full encryption/decryption pipelines
  encrypt: encryptDataWithKeyHierarchy,
  decrypt: decryptDataWithKeyHierarchy,
  
  // Component functions
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptDataset,
  decryptDataset,
  
  // Tokenization
  tokenize,
  verifyToken,
  hashOneWay,
  
  // Utilities
  generateSecureId,
  secureCompare,
  rotateDEK,
  
  // Configuration
  CRYPTO_CONFIG,
  validateConfig
};

export {
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptDataset,
  decryptDataset,
  encryptDataWithKeyHierarchy,
  decryptDataWithKeyHierarchy,
  tokenize,
  verifyToken,
  hashOneWay,
  generateSecureId,
  secureCompare,
  rotateDEK
};
