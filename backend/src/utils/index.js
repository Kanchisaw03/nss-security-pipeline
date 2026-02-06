import crypto from 'crypto';

/**
 * Encryption Utilities
 * 
 * Helper functions for cryptographic operations
 */

// Configuration
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const ITERATIONS = 100000;

/**
 * Generate a cryptographically secure random string
 */
export const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a password using PBKDF2
 */
export const hashPassword = (password, salt = null) => {
  const useSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
  
  const hash = crypto.pbkdf2Sync(
    password,
    useSalt,
    ITERATIONS,
    64,
    'sha512'
  ).toString('hex');
  
  return {
    hash,
    salt: useSalt
  };
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = (password, hash, salt) => {
  const computed = hashPassword(password, salt);
  return computed.hash === hash;
};

/**
 * Generate secure token
 */
export const generateSecureToken = (length = 48) => {
  return crypto.randomBytes(length).toString('base64url');
};

/**
 * Encrypt sensitive configuration values
 */
export const encryptConfig = (value, masterKey) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(masterKey, 'hex'),
      iv
    );
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    throw new Error(`Config encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt sensitive configuration values
 */
export const decryptConfig = (encryptedPackage, masterKey) => {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(masterKey, 'hex'),
      Buffer.from(encryptedPackage.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedPackage.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedPackage.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Config decryption failed: ${error.message}`);
  }
};

/**
 * Hash data for integrity checks
 */
export const hashData = (data, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(JSON.stringify(data)).digest('hex');
};

/**
 * Generate HMAC for data authentication
 */
export const generateHMAC = (data, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
};

/**
 * Verify HMAC
 */
export const verifyHMAC = (data, secret, expectedHMAC) => {
  const computed = generateHMAC(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(expectedHMAC)
  );
};

/**
 * Sanitize string input
 */
export const sanitizeString = (input, maxLength = 255) => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>\"']/g, ''); // Remove potentially dangerous characters
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  
  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });
  
  return cloned;
};

/**
 * Remove sensitive fields from object
 */
export const removeSensitiveFields = (obj, sensitiveFields = []) => {
  const cleaned = { ...obj };
  const defaultSensitive = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard'];
  const allSensitive = [...defaultSensitive, ...sensitiveFields];
  
  allSensitive.forEach(field => {
    delete cleaned[field];
  });
  
  return cleaned;
};

/**
 * Format date to ISO string
 */
export const formatDate = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Parse CSV string to array
 */
export const parseCSVString = (csvString) => {
  const lines = csvString.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || '';
      return obj;
    }, {});
  });
};

/**
 * Convert array to CSV string
 */
export const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header] || '';
      // Escape values containing commas or quotes
      if (value.includes(',') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Rate limiting helper
 */
export const createRateLimiter = (windowMs = 60000, maxRequests = 100) => {
  const requests = new Map();
  
  return {
    check: (key) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      requests.forEach((timestamp, reqKey) => {
        if (timestamp < windowStart) {
          requests.delete(reqKey);
        }
      });
      
      // Count requests in current window
      const count = Array.from(requests.values()).filter(t => t > windowStart && t <= now).length;
      
      if (count >= maxRequests) {
        return { allowed: false, retryAfter: Math.ceil((requests.get(key) + windowMs - now) / 1000) };
      }
      
      requests.set(key, now);
      return { allowed: true };
    }
  };
};

/**
 * Mask sensitive data in logs
 */
export const maskSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const masked = {};
  const sensitivePatterns = [
    /password/i, /token/i, /secret/i, /key/i,
    /ssn/i, /social/i, /credit/i, /card/i,
    /email/i, /phone/i
  ];
  
  Object.entries(data).forEach(([key, value]) => {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    
    if (isSensitive && typeof value === 'string') {
      masked[key] = value.length > 8 
        ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
        : '****';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  });
  
  return masked;
};

export default {
  generateRandomString,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  encryptConfig,
  decryptConfig,
  hashData,
  generateHMAC,
  verifyHMAC,
  sanitizeString,
  deepClone,
  removeSensitiveFields,
  formatDate,
  parseCSVString,
  convertToCSV,
  isValidUUID,
  retryWithBackoff,
  createRateLimiter,
  maskSensitiveData
};
