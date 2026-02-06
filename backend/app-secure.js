/**
 * Quick Start Integration Script
 * 
 * This script shows how to integrate the security layer into the main app
 */

import express from 'express';
import { securityLayer } from './src/security/index.js';
import securityRoutes from './src/routes/security.js';

const app = express();

// Middleware
app.use(express.json());

// Initialize security layer on startup
async function initializeSecurity() {
  try {
    console.log('🔐 Initializing Security Layer...');
    const status = await securityLayer.initialize();
    console.log('✅ Security Layer Ready');
    console.log('Components:', Object.keys(status).join(', '));
    return true;
  } catch (error) {
    console.error('❌ Security initialization failed:', error.message);
    process.exit(1);
  }
}

// Mount security routes
app.use('/api', securityRoutes);

// Health check
app.get('/health', async (req, res) => {
  const status = securityLayer.getStatus();
  res.json({
    status: 'healthy',
    security: status
  });
});

// Example: Protected route with all security checks
app.post('/api/protected-query',
  // 1. Verify JWT
  async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    
    const token = authHeader.substring(7);
    const verification = securityLayer.auth.verifyToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = verification.decoded;
    next();
  },
  
  // 2. Check role
  async (req, res, next) => {
    const roleCheck = securityLayer.auth.checkRole(
      req.user.role, 
      ['admin', 'researcher']
    );
    
    if (!roleCheck.allowed) {
      return res.status(403).json({ error: roleCheck.reason });
    }
    next();
  },
  
  // 3. Query firewall
  async (req, res, next) => {
    const firewallResult = securityLayer.firewall.validateQuery(
      req.user.userId,
      req.body,
      { datasetSize: 10000 }
    );
    
    if (!firewallResult.allowed) {
      await securityLayer.audit.log(
        securityLayer.auditEvents.QUERY_BLOCKED,
        req.user.userId,
        { reason: firewallResult.reason }
      );
      return res.status(403).json({ error: firewallResult.reason });
    }
    next();
  },
  
  // 4. Execute query with DP
  async (req, res) => {
    try {
      // Your query logic here
      const result = { count: 1000 }; // Example
      
      // Apply DP
      const dpResult = securityLayer.dp.count(result.count, req.body.epsilon || 1.0);
      
      // Audit
      await securityLayer.audit.log(
        securityLayer.auditEvents.QUERY_EXECUTED,
        req.user.userId,
        { 
          queryType: 'count',
          epsilon: req.body.epsilon,
          noisyResult: dpResult.noisyValue
        }
      );
      
      res.json(dpResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;

initializeSecurity().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     SAFE DATA ACCESS PLATFORM - Security Enhanced          ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                             ║
║  Security: ACTIVE                                          ║
║  Audit Chain: VALIDATED                                    ║
║  Encryption: AES-256-GCM                                   ║
║  Privacy: k-Anon, l-Div, DP                                ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
});

export default app;
