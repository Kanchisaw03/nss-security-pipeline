# Safe Data Access Platform - Security Architecture

## 🎯 Overview

Complete defense-in-depth privacy-governed statistical data access platform implementing:
- **Cryptographic Security**: AES-256-GCM encryption with DEK/KEK hierarchy
- **Privacy Models**: k-Anonymity, l-Diversity, t-Closeness
- **Differential Privacy**: Laplace mechanism for aggregate queries
- **Access Control**: Zero Trust with JWT, roles, consent
- **Attack Defense**: Query firewall against differencing/reconstruction attacks
- **Audit**: Tamper-proof blockchain-style audit chain

## 📁 Directory Structure

```
backend/src/
├── crypto/                 # Cryptography Layer
│   └── index.js           # DEK/KEK encryption, tokenization
├── anonymization/          # Multi-layer Anonymization
│   ├── index.js           # Original anonymization service
│   └── engine.js          # Enhanced k-anon, l-div, t-close
├── dpEngine/              # Differential Privacy Engine
│   └── index.js           # Laplace mechanism, budget management
├── riskEngine/            # Risk Scoring Engine
│   └── index.js           # 5-factor risk scoring (0-100)
├── zeroTrust/             # Zero Trust Middleware
│   └── index.js           # JWT, roles, rate limiting
├── consentEngine/         # Purpose-Bound Consent
│   └── index.js           # Consent lifecycle, purpose binding
├── queryFirewall/         # Attack Defense
│   └── index.js           # Differencing detection, rate limits
├── auditChain/            # Tamper-Proof Audit
│   └── index.js           # SHA256 chain, integrity validation
├── releasePipeline/       # Release Orchestration
│   └── index.js           # 7-stage pipeline
├── security/              # Integration Layer
│   └── index.js           # Unified security interface
├── routes/                # API Routes
│   └── security.js        # Enhanced secure routes
├── examples/              # Usage Examples
│   └── security-examples.js
└── tests/                 # Unit Tests
    └── security-tests.js
```

## 🔐 Security Layers

### 1. Cryptography Layer (`crypto/`)

**Features:**
- AES-256-GCM for data encryption
- AES-256-ECB for DEK encryption with KEK
- Random 256-bit DEK per dataset
- Deterministic HMAC-SHA256 tokenization
- Key rotation support

**Usage:**
```javascript
import { cryptoService } from './crypto/index.js';

// Encrypt dataset
const encrypted = cryptoService.encrypt(dataset);
// Returns: { encryptedData, encryptedDEK, iv, authTag }

// Decrypt
const decrypted = cryptoService.decrypt(encrypted);

// Tokenize direct identifier
const token = cryptoService.tokenize('john@example.com', 'email');
// Returns: TKN_abc123... (deterministic)
```

### 2. Anonymization Engine (`anonymization/engine.js`)

**Features:**
- k-Anonymity with hierarchical generalization
- l-Diversity for sensitive attributes
- t-Closeness for distribution similarity
- Field hierarchies: age, ZIP, income

**Usage:**
```javascript
import { anonymizationEngine } from './anonymization/engine.js';

// Anonymize dataset
const result = anonymizationEngine.anonymize(data, classification, k=5, l=2);

// Check k-anonymity
const kCheck = anonymizationEngine.checkKAnonymity(data, quasiFields, 5);

// Check l-diversity
const lCheck = anonymizationEngine.checkLDiversity(data, quasiFields, sensitiveFields, 2);
```

**Hierarchies:**
- Age: exact → decade → quarter-century → binary → suppressed
- ZIP: 5-digit → 4-digit → 3-digit → 2-digit → suppressed
- Income: exact → tens-of-thousands → Low/Medium/High → suppressed

### 3. Differential Privacy Engine (`dpEngine/`)

**Features:**
- Laplace mechanism: `noise = (-b * sign(u) * ln(1 - 2|u|))`
- Privacy budget management
- Query types: count, sum, mean, histogram, groupBy
- Epsilon composition tracking

**Usage:**
```javascript
import { dpEngine } from './dpEngine/index.js';

// DP count
const dpCount = dpEngine.count(1000, epsilon=1.0);
// Returns: { trueValue, noisyValue, noise, epsilon, privacyGuarantee }

// DP sum
const dpSum = dpEngine.sum(50000, epsilon=1.0, sensitivity=1000);

// DP histogram
const bins = { 'A': 100, 'B': 200 };
const dpHist = dpEngine.histogram(bins, epsilon=1.0);

// Privacy budget
const budget = dpEngine.budgetManager.checkBudget(datasetId, epsilon);
```

### 4. Risk Scoring Engine (`riskEngine/`)

**Formula:**
```
risk = (uniquenessScore * 0.3) +
       (kViolations * 0.25) +
       (rareSensitiveRatio * 0.2) +
       (quasiCount * 0.15) +
       (datasetSizeFactor * 0.1)
```

**Risk Levels:**
- Low: 0-30
- Medium: 31-60
- High: 61-100

**Usage:**
```javascript
import { riskEngine } from './riskEngine/index.js';

// Calculate risk
const assessment = riskEngine.calculateRiskScore(data, classification);
// Returns: { overallRisk, riskLevel, componentScores, recommendations }

// Check release eligibility
const eligible = riskEngine.checkReleaseEligibility(assessment, 'Medium');

// Compare before/after
const comparison = riskEngine.compareRisk(originalData, anonymizedData, classification);
```

### 5. Zero Trust Middleware (`zeroTrust/`)

**Features:**
- JWT authentication with role hierarchy
- Rate limiting per user/IP
- Request validation chain
- Client fingerprinting

**Roles:**
- `admin` (4): Full access
- `reviewer` (3): Approve/review
- `researcher` (2): Query released data
- `auditor` (1): Read-only audit access

**Usage:**
```javascript
import { zeroTrust, ROLES } from './zeroTrust/index.js';

// Generate token
const token = zeroTrust.generateToken(userId, 'researcher', { purpose: 'research' });

// Verify token
const verification = zeroTrust.verifyToken(token);

// Middleware
app.post('/api/dataset', 
  zeroTrust.requireRole(ROLES.ADMIN),
  async (req, res) => { ... }
);
```

### 6. Purpose-Bound Consent Engine (`consentEngine/`)

**Features:**
- Purpose limitation enforcement
- Field-level access control
- Expiration tracking
- Constraints (aggregates-only, DP epsilon limits)

**Lifecycle:**
```
pending → approved → active → expired/revoked
```

**Valid Purposes:**
- `research`
- `statistical_analysis`
- `public_health`
- `policy_evaluation`
- `audit`
- `quality_improvement`

**Usage:**
```javascript
import { consentEngine, VALID_PURPOSES } from './consentEngine/index.js';

// Request consent
const consent = await consentEngine.requestConsent(
  researcherId,
  'research',
  ['age', 'income', 'condition'],
  { 
    datasetId: 'ds-123',
    aggregatesOnly: true,
    dpEpsilon: 1.0
  }
);

// Approve
await consentEngine.approveConsent(consent.id, approverId, { riskScore: 45 });

// Validate access
const access = consentEngine.validateAccess(consent.id, {
  purpose: 'research',
  fields: ['age'],
  epsilon: 0.5
});
```

### 7. Query Firewall (`queryFirewall/`)

**Attack Detection:**
- Differencing attacks (A - B = individual)
- Reconstruction attacks (field enumeration)
- Sequential ID enumeration
- Overly specific filters

**Protections:**
- Minimum k-record threshold (default: 5)
- Rate limiting (20 queries/minute)
- Query fingerprinting
- Filter specificity scoring

**Usage:**
```javascript
import { queryFirewall } from './queryFirewall/index.js';

// Validate query
const result = queryFirewall.validateQuery(userId, query, {
  datasetSize: 10000,
  estimatedResults: 100
});

// Check for attacks
const attack = queryFirewall.checkDifferencingAttack(userId, query);
```

### 8. Tamper-Proof Audit Chain (`auditChain/`)

**Features:**
- SHA256 cryptographic chain
- Formula: `hash = SHA256(previousHash + JSON.stringify(event))`
- Automatic integrity validation
- Export with proof

**Event Types:**
- Authentication: USER_LOGIN, USER_LOGOUT
- Dataset: DATASET_INGESTED, DATASET_RELEASED
- Consent: CONSENT_REQUESTED, CONSENT_APPROVED
- Access: ACCESS_GRANTED, ACCESS_DENIED, QUERY_EXECUTED
- Security: ATTACK_DETECTED, RATE_LIMIT_EXCEEDED

**Usage:**
```javascript
import { auditChainService, AUDIT_EVENTS } from './auditChain/index.js';

// Log event
await auditChainService.log(AUDIT_EVENTS.DATASET_RELEASED, userId, { datasetId: 'ds-123' });

// Validate chain
const validation = auditChainService.validateChain();
// Returns: { valid, chainLength, error }

// Export
const exportData = auditChainService.export('json');
```

### 9. Release Pipeline (`releasePipeline/`)

**7-Stage Pipeline:**
```
1. DECRYPT    → Decrypt raw data with KEK
2. CLASSIFY   → Classify all fields
3. RISK_ASSESS→ Calculate risk score
4. ANONYMIZE  → Apply k-anon, l-div
5. VALIDATE   → Verify privacy models
6. ENCRYPT    → Encrypt release package
7. STORE      → Store in released store
```

**Usage:**
```javascript
import { releasePipeline } from './releasePipeline/index.js';

// Execute pipeline
const result = await releasePipeline.execute(
  datasetId,
  rawData,
  consentId,
  { k: 5, l: 2, maxRiskLevel: 'Medium' }
);
// Returns: { success, releaseId, executionId, riskAssessment, stagesCompleted }
```

## 🔧 Integration Layer (`security/`)

**Unified Interface:**
```javascript
import { securityLayer } from './security/index.js';

// Initialize all modules
await securityLayer.initialize();

// Get status
const status = securityLayer.getStatus();

// Execute secure query
const result = await securityLayer.executeSecureQuery(userId, query, context);
```

**Components:**
- `securityLayer.crypto` - Encryption/tokenization
- `securityLayer.anonymization` - k-anon, l-div, t-close
- `securityLayer.dp` - Differential privacy
- `securityLayer.risk` - Risk scoring
- `securityLayer.auth` - Zero trust auth
- `securityLayer.consent` - Consent management
- `securityLayer.firewall` - Query firewall
- `securityLayer.audit` - Audit chain
- `securityLayer.pipeline` - Release pipeline

## 🚀 API Routes (`routes/security.js`)

### Authentication
- `POST /api/auth/login` - Generate JWT

### Data Ingestion
- `POST /api/ingestion/dataset` - Ingest and encrypt dataset

### Classification & Risk
- `POST /api/classification/:datasetId` - Classify and assess risk

### Consent Management
- `POST /api/consent/request` - Request consent
- `POST /api/consent/:consentId/approve` - Approve consent

### Release Pipeline
- `POST /api/release/:datasetId` - Execute release pipeline

### Secure Queries
- `POST /api/query/:releaseId` - Query with firewall + consent
- `POST /api/dp/count/:releaseId` - DP count query
- `POST /api/dp/sum/:releaseId` - DP sum query
- `POST /api/dp/mean/:releaseId` - DP mean query
- `POST /api/dp/histogram/:releaseId` - DP histogram query

### Audit
- `GET /api/audit/chain` - Validate chain integrity
- `GET /api/audit/events` - Query events
- `GET /api/audit/export` - Export audit log

### Security Status
- `GET /api/security/status` - Get security layer status

## 📊 Examples (`examples/security-examples.js`)

Run examples:
```bash
node src/examples/security-examples.js
```

Examples include:
1. Data ingestion with encryption
2. Classification and risk assessment
3. Multi-layer anonymization
4. Differential privacy queries
5. Zero trust security flow
6. Purpose-bound consent
7. Query firewall protection
8. Complete release pipeline
9. Audit chain demonstration
10. Tokenization examples

## 🧪 Tests (`tests/security-tests.js`)

Run tests:
```bash
node src/tests/security-tests.js
```

Test coverage:
- ✅ Cryptography (6 tests)
- ✅ Anonymization (6 tests)
- ✅ Differential Privacy (7 tests)
- ✅ Risk Engine (6 tests)
- ✅ Zero Trust (6 tests)
- ✅ Consent Engine (8 tests)
- ✅ Query Firewall (6 tests)
- ✅ Audit Chain (6 tests)
- ✅ Release Pipeline (3 tests)

**Total: 54 tests**

## ⚙️ Configuration (`.env`)

```bash
# Required
ENCRYPTION_MASTER_KEY=minimum-32-character-secret-key
HASH_SECRET=minimum-32-character-hash-secret
JWT_SECRET=minimum-32-character-jwt-secret

# Privacy
DEFAULT_K_ANONYMITY=5
DEFAULT_L_DIVERSITY=2
DEFAULT_DP_EPSILON=1.0
MAX_RISK_SCORE=60

# Security
MIN_K_RECORDS=5
MAX_QUERIES_PER_MINUTE=20
RATE_LIMIT_MAX_REQUESTS=100
```

## 📈 Architecture Flow

```
Raw Data
    ↓
[1] Encrypt (DEK/KEK)
    ↓
[2] Store in rawStore
    ↓
[3] Classify Fields
    ↓
[4] Risk Assessment (0-100)
    ↓
[5] Request Consent
    ↓
[6] Approve Consent
    ↓
[7] Execute Release Pipeline
    ├─ Decrypt
    ├─ Classify
    ├─ Risk Assess
    ├─ Anonymize (k-anon, l-div)
    ├─ Validate
    ├─ Encrypt
    └─ Store in releasedStore
    ↓
[8] Bind Release ↔ Consent
    ↓
[9] Secure Query
    ├─ JWT Verification
    ├─ Consent Validation
    ├─ Purpose Binding
    ├─ Query Firewall
    ├─ DP Application
    └─ Audit Logging
    ↓
Researcher gets DP-protected aggregates only
```

## 🔒 Security Guarantees

1. **Raw data never leaves system** - Only encrypted at rest
2. **DEK never stored with data** - Protected by KEK
3. **k-anonymity enforced** - Minimum 5 records per group
4. **l-diversity enforced** - Minimum 2 distinct sensitive values
5. **DP guarantees** - Formal (ε) privacy budget
6. **Purpose binding** - Query purpose must match consent
7. **Tamper-proof audit** - Cryptographic chain integrity
8. **Attack detection** - Automatic blocking of suspicious patterns

## 📚 Documentation

- API Documentation: Postman collection included
- Usage Examples: `examples/security-examples.js`
- Unit Tests: `tests/security-tests.js`
- Configuration: `.env.example`

## 🎯 Next Steps

1. Copy `.env.example` to `.env` and configure secrets
2. Run tests: `node src/tests/security-tests.js`
3. Run examples: `node src/examples/security-examples.js`
4. Start server: `npm start`
5. Use Postman collection for API testing

---

**Total Files Created: 15**
**Total Lines of Code: ~15,000**
**Architecture: Defense-in-depth with 9 security layers**
