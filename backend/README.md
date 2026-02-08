# Safe Data Access Platform

## Privacy-Governed Statistical Data Access System with Defense-in-Depth Architecture

[![Security](https://img.shields.io/badge/Security-9%20Layers-blue)](SECURITY_ARCHITECTURE.md)
[![Crypto](https://img.shields.io/badge/Crypto-AES--256--GCM-green)](src/crypto/index.js)
[![Privacy](https://img.shields.io/badge/Privacy-k--Anon%2C%20l--Div%2C%20DP-orange)](src/anonymization/engine.js)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎯 Overview

A comprehensive **privacy-by-design** data access platform implementing **9 security layers** for handling sensitive government-style survey data. This system ensures raw data never leaves the system - only **aggregates** and **differentially-private results** are provided to researchers.

### Key Features

- 🔐 **Military-Grade Encryption**: AES-256-GCM with DEK/KEK hierarchy
- 🛡️ **Multi-Layer Anonymization**: k-Anonymity (k≥5), l-Diversity (l≥2), t-Closeness
- 📊 **Differential Privacy**: Laplace mechanism with formal (ε) privacy guarantees
- 🎭 **Purpose-Bound Consent**: Strict purpose limitation with field-level access control
- 🔥 **Query Firewall**: Real-time protection against differencing & reconstruction attacks
- ⛓️ **Tamper-Proof Audit**: Cryptographically chained audit logs (SHA256)
- 🚫 **Zero Trust**: JWT authentication with role-based access control
- 📈 **Risk Scoring**: 5-factor algorithm (0-100 scale)
- 🔄 **7-Stage Pipeline**: Automated data release with privacy validation
- 🏛️ **Stage 2 Governance**: NSO Benchmarking, Privacy-Utility Reports, Attack Simulation, DPDP Compliance, Privacy-Utility Curves

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repository-url>
cd "nss prototype 3/backend"

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your secure secrets
```

### Environment Configuration

Edit `.env` file:

```bash
# Required: Minimum 32 characters each
ENCRYPTION_MASTER_KEY=your-secure-32-char-master-key
HASH_SECRET=your-secure-32-char-hash-secret
JWT_SECRET=your-secure-32-char-jwt-secret

# Optional: Privacy settings
DEFAULT_K_ANONYMITY=5
DEFAULT_L_DIVERSITY=2
DEFAULT_DP_EPSILON=1.0
MAX_RISK_SCORE=60
```

### Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start

# Run tests
node src/tests/security-tests.js

# Run examples
node src/examples/security-examples.js
```

### Default Credentials

| Role | User ID | Password |
|------|---------|----------|
| **Admin** | `admin` | `admin123` |
| **Researcher** | `researcher` | `researcher123` |

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000
```

### 🔐 Authentication

All endpoints require JWT token except `/health`.

```http
Authorization: Bearer <token>
```

### Endpoints Overview

#### 0. Health & Status
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Health check | ❌ No |
| `GET` | `/api/status` | System status | ❌ No |
| `GET` | `/api/security/status` | Security layer status | ✅ Admin |

#### 1. Authentication
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `POST` | `/api/auth/login` | Login & get JWT | Any |
| `POST` | `/api/auth/register` | Register new user | Admin |
| `GET` | `/api/auth/users` | List all users | Admin |

#### 2. Data Ingestion (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingestion/dataset` | Ingest & encrypt dataset |
| `GET` | `/api/ingestion/datasets` | List all datasets |
| `GET` | `/api/ingestion/datasets/:id/metadata` | Get dataset metadata |

#### 3. Classification & Risk (Admin/Reviewer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/classification/:datasetId` | Classify dataset |
| `POST` | `/api/classification/field/:fieldName` | Classify single field |
| `POST` | `/api/risk/assess/:datasetId` | Assess risk score |
| `POST` | `/api/risk/compare/:datasetId` | Compare before/after anonymization |
| `POST` | `/api/risk/k-anonymity/:datasetId` | Check k-anonymity |

#### 4. Consent Management
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| `POST` | `/api/consent/request` | Request consent | Researcher |
| `POST` | `/api/consent/:id/approve` | Approve consent | Admin/Reviewer |
| `POST` | `/api/consent/:id/reject` | Reject consent | Admin/Reviewer |
| `POST` | `/api/consent/:id/revoke` | Revoke consent | Admin/Reviewer |
| `GET` | `/api/consent/my` | Get my consents | Researcher |
| `GET` | `/api/consent` | List all consents | Admin/Reviewer |
| `GET` | `/api/consent/:id` | Get consent details | Any |

#### 5. Release Pipeline (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/release/:datasetId` | Execute release pipeline |
| `GET` | `/api/release` | List releases |

#### 6. Secure Queries (Researcher)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query/:releaseId` | Query with firewall + consent |
| `POST` | `/api/dp/count/:releaseId` | DP count query |
| `POST` | `/api/dp/sum/:releaseId` | DP sum query |
| `POST` | `/api/dp/mean/:releaseId` | DP mean query |
| `POST` | `/api/dp/histogram/:releaseId` | DP histogram query |

#### 7. Audit & Compliance (Admin/Auditor)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit/chain` | Validate chain integrity |
| `GET` | `/api/audit/events` | Query audit events |
| `GET` | `/api/audit/user/:userId` | Get user activity |
| `GET` | `/api/audit/dataset/:datasetId` | Get dataset activity |
| `GET` | `/api/audit/consent/:consentId` | Get consent lifecycle |
| `GET` | `/api/audit/export` | Export audit log |

#### 8. Stage 2 Governance & Reporting (Admin/Reviewer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/benchmark/:datasetId` | Run NSO benchmark comparison |
| `GET` | `/api/report/benchmark/:datasetId` | Get benchmark history |
| `GET` | `/api/report/privacy-utility/:releaseId` | Privacy-utility report |
| `GET` | `/api/compliance/dpdp` | Full DPDP compliance map |
| `GET` | `/api/compliance/dpdp/:principle` | Specific principle compliance |
| `GET` | `/api/compliance/summary` | Compliance certificate |
| `POST` | `/api/attack-simulation/:releaseId` | Run attack simulation |
| `GET` | `/api/attack-simulation/result/:attackId` | Get attack results |
| `POST` | `/api/curve/:datasetId` | Generate privacy-utility curve |
| `GET` | `/api/curve/visualization/:curveId` | Curve visualization data |
| `GET` | `/api/governance/dashboard/:releaseId` | Governance dashboard |

---

## 🏗️ Architecture

### 9-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 9: Release Pipeline                                  │
│  Decrypt → Classify → Risk Assess → Anonymize → Validate    │
│  → Encrypt → Store                                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 8: Audit Chain                                       │
│  SHA256(previousHash + event) - Tamper-proof logging        │
├─────────────────────────────────────────────────────────────┤
│  Layer 7: Query Firewall                                    │
│  Attack detection: Differencing, Reconstruction, Enumeration│
├─────────────────────────────────────────────────────────────┤
│  Layer 6: Purpose-Bound Consent                             │
│  Purpose binding, Field restrictions, Time limits           │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Zero Trust                                        │
│  JWT auth, Role hierarchy, Rate limiting                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Risk Scoring                                      │
│  5-factor algorithm: Uniqueness, k-violations, etc.         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Differential Privacy                              │
│  Laplace mechanism: noise = (-b * sign(u) * ln(1 - 2|u|))   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Multi-Layer Anonymization                         │
│  k-Anonymity ≥ 5, l-Diversity ≥ 2, t-Closeness              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Cryptography                                      │
│  AES-256-GCM + DEK/KEK hierarchy, HMAC-SHA256 tokenization  │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
backend/src/
├── crypto/                    # AES-256-GCM, DEK/KEK encryption
├── anonymization/             # k-anon, l-div, t-close
│   ├── engine.js             # Enhanced privacy engine
│   └── index.js              # Original service
├── dpEngine/                  # Differential privacy
├── riskEngine/                # Risk scoring
├── zeroTrust/                 # JWT, roles, rate limiting
├── consentEngine/             # Purpose-bound consent
├── queryFirewall/             # Attack defense
├── auditChain/                # Tamper-proof audit
├── releasePipeline/           # Release orchestration
├── benchmarkMode/             # NSO Benchmark (Stage 2)
├── reporting/                 # Privacy-Utility Reports (Stage 2)
├── attackSimulation/          # Attack Simulator (Stage 2)
├── compliance/                # DPDP Compliance (Stage 2)
├── governance/                # Governance Integration (Stage 2)
├── security/                  # Integration layer
├── routes/                    # API routes
├── examples/                  # Usage examples
└── tests/                     # Unit tests
```

---

## 🔒 Security Features

### 1. Encryption (Layer 1)

**DEK/KEK Hierarchy:**
```javascript
import { cryptoService } from './security/index.js';

// Encrypt dataset with unique DEK
const encrypted = cryptoService.encrypt(dataset);
// Returns: { encryptedData, encryptedDEK, iv, authTag }

// Tokenize PII (deterministic)
const token = cryptoService.tokenize('john@email.com', 'email');
// Same input = Same output (for linkability)
```

### 2. Anonymization (Layer 2)

**Hierarchical Generalization:**
- **Age**: exact → decade (30-39) → quarter (25-49) → suppressed
- **ZIP**: 5-digit → 4-digit → 3-digit (123XX) → suppressed  
- **Income**: exact → tens-of-thousands → Low/Medium/High → suppressed

```javascript
// Achieve k-anonymity with l-diversity
const result = securityLayer.anonymization.anonymize(data, classification, k=5, l=2);
```

### 3. Differential Privacy (Layer 3)

**Laplace Mechanism:**
```javascript
// DP count query
const dpCount = securityLayer.dp.count(1000, epsilon=1.0);
// Returns noisy count with privacy guarantee

// DP histogram
const histogram = securityLayer.dp.histogram(bins, epsilon=1.0);
// Epsilon split across bins (basic composition)
```

### 4. Risk Scoring (Layer 4)

**Formula:**
```
Risk Score = (Uniqueness × 0.30) + (k-Violations × 0.25) + 
             (Rare Values × 0.20) + (Quasi Count × 0.15) + 
             (Size Factor × 0.10)
```

**Levels:**
- 🟢 Low (0-30): Safe for release
- 🟡 Medium (31-60): Requires review
- 🔴 High (61-100): Blocked

### 5. Zero Trust (Layer 5)

**Role Hierarchy:**
- `admin` (4): Full system access
- `reviewer` (3): Approve/review consents
- `researcher` (2): Query released data
- `auditor` (1): Read-only audit access

### 6. Consent Engine (Layer 6)

**Purpose Binding:**
```javascript
// Request must match consent purpose exactly
const validation = consentEngine.validateAccess(consentId, {
  purpose: 'research',           // Must match
  fields: ['age', 'income'],     // Must be subset
  epsilon: 0.5                   // Must be ≤ consent limit
});
```

### 7. Query Firewall (Layer 7)

**Attack Detection:**
- ❌ Filters returning < 5 records
- ❌ 3+ similar queries within 5 minutes (differencing)
- ❌ Sequential ID enumeration
- ❌ Overly specific filters (specificity > 80%)

### 8. Audit Chain (Layer 8)

**Cryptographic Chain:**
```
hash = SHA256(previousHash + JSON.stringify(event))
```

- 🔗 Each event links to previous
- ✅ Automatic integrity validation
- 📤 Export with cryptographic proof

### 9. Release Pipeline (Layer 9)

**7-Stage Process:**
```
1. DECRYPT    ← Decrypt with KEK
2. CLASSIFY   ← Identify field types
3. RISK_ASSESS← Calculate risk score
4. ANONYMIZE  ← Apply k-anon, l-div
5. VALIDATE   ← Verify privacy models
6. ENCRYPT    ← Encrypt release package
7. STORE      ← Store in released store
```

---

## 🧪 Testing

### Run All Tests
```bash
node src/tests/security-tests.js
```

**Coverage:** 54 unit tests across 9 modules

### Run Examples
```bash
node src/examples/security-examples.js
```

**10 Examples:**
1. Data ingestion with encryption
2. Classification & risk assessment
3. Multi-layer anonymization
4. Differential privacy queries
5. Zero trust security flow
6. Purpose-bound consent
7. Query firewall protection
8. Complete release pipeline
9. Audit chain demonstration
10. Tokenization

### Run Backend Integration Tests
```bash
node test-backend.js
```

**Coverage:** 32 integration tests across all 9 phases including Stage 2 Governance

---

## 🏛️ Stage 2 Governance & Reporting

The Stage 2 Governance Upgrade adds 5 new modules for enhanced privacy governance, regulatory compliance, and benchmarking.

### NSO Benchmark Mode

Compare baseline vs enhanced anonymization modes:
- **Baseline**: Direct identifier removal + basic generalization
- **Enhanced**: k-Anonymity (k≥5), l-Diversity (l≥2), t-Closeness
- **Automatic Winner Selection** based on risk/utility tradeoff

```bash
POST /api/benchmark/:datasetId
```

### Privacy-Utility Report Engine

Generate comprehensive reports with:
- **Privacy Metrics**: k-anonymity, l-diversity, uniqueness, entropy
- **Utility Metrics**: Mean/variance difference, KL divergence, suppression rate
- **Risk Scores**: Before and after anonymization

```bash
GET /api/report/privacy-utility/:releaseId
```

### Attack Simulation Engine

Test dataset resilience against 3 attack types:
- **Linkage Attack**: Record re-identification via quasi-identifiers
- **Homogeneity Attack**: Sensitive value inference
- **Background Knowledge Attack**: External data exploitation

```bash
POST /api/attack-simulation/:releaseId
```

### DPDP Act Compliance Map

Map privacy controls to India's Digital Personal Data Protection Act 2023:
- 7 core principles mapped
- Control-verification matrix
- Automatic compliance scoring
- Compliance certificate generation

```bash
GET /api/compliance/dpdp
GET /api/compliance/summary
```

### Privacy-Utility Curve

Simulate privacy-utility tradeoffs across epsilon values:
- Multi-point simulation (ε = 0.1, 0.5, 1.0, 2.0, 5.0)
- Optimal epsilon recommendation
- Visualization data for charts

```bash
POST /api/curve/:datasetId
GET /api/curve/visualization/:curveId
```

### Governance Dashboard

Unified view of all governance activities:
```bash
GET /api/governance/dashboard/:releaseId
```

---

## 📖 Usage Examples

### Complete Workflow

```javascript
import { securityLayer } from './security/index.js';

// 1. Initialize
await securityLayer.initialize();

// 2. Ingest data (encrypted automatically)
const encrypted = securityLayer.crypto.encrypt(dataset);
storageService.storeRaw(datasetId, encrypted);

// 3. Classify & assess risk
const classification = classificationService.classifyDataset(data);
const risk = securityLayer.risk.calculateRiskScore(data, classification);

// 4. Request & approve consent
const consent = await securityLayer.consent.requestConsent(
  researcherId,
  'research',
  ['age', 'income'],
  { aggregatesOnly: true, dpEpsilon: 1.0 }
);
await securityLayer.consent.approveConsent(consent.id, adminId, { riskScore: 30 });

// 5. Execute release pipeline
const release = await securityLayer.pipeline.execute(
  datasetId, data, consent.id, { k: 5, l: 2 }
);

// 6. Query with DP
const result = await securityLayer.dp.count(1000, 0.5);
```

---

## 🔧 Configuration

### Privacy Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `DEFAULT_K_ANONYMITY` | 5 | Minimum records per group |
| `DEFAULT_L_DIVERSITY` | 2 | Minimum distinct sensitive values |
| `DEFAULT_DP_EPSILON` | 1.0 | Privacy budget (lower = more private) |
| `MAX_RISK_SCORE` | 60 | Maximum risk for release |
| `MIN_K_RECORDS` | 5 | Minimum query results |
| `MAX_QUERIES_PER_MINUTE` | 20 | Rate limit |

### Security Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | 900000 | 15 minutes |
| `BLOCK_DURATION_MS` | 1800000 | 30 minutes block |
| `AUDIT_PERSISTENCE` | false | Persist to disk |
| `AUDIT_PATH` | ./audit-logs | Audit storage path |

---

## 📊 Performance

- **Encryption**: ~1ms per 1KB
- **Anonymization**: ~10ms per 1000 records
- **DP Noise Generation**: ~0.1ms per value
- **Risk Assessment**: ~5ms per 1000 records
- **Audit Logging**: ~0.5ms per event

---

## 🛡️ Security Guarantees

1. ✅ **Raw data never leaves system** - Only encrypted at rest
2. ✅ **DEK never stored with data** - Protected by KEK
3. ✅ **k-anonymity enforced** - Minimum 5 records per group
4. ✅ **l-diversity enforced** - Minimum 2 distinct sensitive values
5. ✅ **DP guarantees** - Formal (ε) privacy budget
6. ✅ **Purpose binding** - Query purpose must match consent
7. ✅ **Tamper-proof audit** - Cryptographic chain integrity
8. ✅ **Attack detection** - Automatic blocking of suspicious patterns
9. ✅ **NSO Benchmarking** - Baseline vs enhanced mode comparison
10. ✅ **DPDP Compliance** - India's data protection act mapping
11. ✅ **Attack Simulation** - Test resilience against linkage attacks
12. ✅ **Privacy-Utility Optimization** - Epsilon curve generation

---

## 📚 Documentation

- [Security Architecture](SECURITY_ARCHITECTURE.md) - Detailed security design
- [API Documentation](SafeDataAccessPostman_Testing_Documentation.md) - Postman collection
- [Postman Collection](SafeDataAccessPlatform.postman_collection.json) - Importable collection v2.1.0
- [Unit Tests](src/tests/security-tests.js) - 54 comprehensive tests
- [Integration Tests](test-backend.js) - 32 end-to-end tests
- [Usage Examples](src/examples/security-examples.js) - 10 working examples

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **k-Anonymity**: Sweeney, L. (2002)
- **l-Diversity**: Machanavajjhala et al. (2007)
- **t-Closeness**: Li et al. (2007)
- **Differential Privacy**: Dwork & McSherry (2006)
- **DPDP Act 2023**: Government of India

---

## 📞 Support

For support, email: support@safedataaccess.com

---

**Built with 🔒 by the Safe Data Access Team**

---

## 🔗 Quick Links

- [Health Check](http://localhost:3000/health)
- [API Status](http://localhost:3000/api/status)
- [Security Status](http://localhost:3000/api/security/status) (requires auth)
- [DPDP Compliance](http://localhost:3000/api/compliance/dpdp) (requires auth)

**Total Lines of Code:** ~18,000
**Security Layers:** 9
**Governance Modules:** 5
**Unit Tests:** 54
**Integration Tests:** 32
**API Endpoints:** 52+
