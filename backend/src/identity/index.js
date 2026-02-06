import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Identity & Access Layer
 * 
 * Implements Zero-Trust request validation.
 * Manages authentication and authorization with role-based access control.
 */

// Roles definition
export const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  REVIEWER: 'reviewer'
};

// Permission matrix
const PERMISSIONS = {
  [ROLES.ADMIN]: [
    'ingest:data',
    'classify:data',
    'anonymize:data',
    'release:data',
    'approve:consent',
    'reject:consent',
    'view:audit',
    'view:risk'
  ],
  [ROLES.RESEARCHER]: [
    'request:consent',
    'view:released',
    'query:data'
  ],
  [ROLES.REVIEWER]: [
    'view:consent',
    'approve:consent',
    'reject:consent',
    'view:risk'
  ]
};

// Mock user store (replace with database in production)
const users = new Map();

// Initialize with default admin
const adminPassword = bcrypt.hashSync('admin123', 10);
users.set('admin', {
  id: uuidv4(),
  userId: 'admin',
  password: adminPassword,
  role: ROLES.ADMIN,
  purposeScope: ['all'],
  createdAt: new Date().toISOString()
});

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secure-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token
 */
export const generateToken = (user) => {
  const payload = {
    userId: user.userId,
    role: user.role,
    purposeScope: user.purposeScope,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 */
export const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      purposeScope: decoded.purposeScope
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please log in again'
      });
    }
    
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed'
    });
  }
};

/**
 * Require specific role middleware
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Required role: ${allowedRoles.join(' or ')}`,
        currentRole: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (user, permission) => {
  const userPermissions = PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
};

/**
 * Authentication service
 */
export const authService = {
  /**
   * Register new user (admin only)
   */
  register: async (userId, password, role, purposeScope = []) => {
    if (users.has(userId)) {
      throw new Error('User already exists');
    }
    
    if (!Object.values(ROLES).includes(role)) {
      throw new Error('Invalid role');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      userId,
      password: hashedPassword,
      role,
      purposeScope,
      createdAt: new Date().toISOString()
    };
    
    users.set(userId, user);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
  
  /**
   * Login user
   */
  login: async (userId, password) => {
    const user = users.get(userId);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    const token = generateToken(user);
    
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  },
  
  /**
   * Get user by ID
   */
  getUser: (userId) => {
    const user = users.get(userId);
    if (!user) return null;
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
  
  /**
   * List all users (admin only)
   */
  listUsers: () => {
    return Array.from(users.values()).map(user => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }
};

export { JWT_SECRET };
