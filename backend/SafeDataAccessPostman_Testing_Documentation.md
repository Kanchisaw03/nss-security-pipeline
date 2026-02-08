# Safe Data Access Platform - Postman Testing Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [API Testing Workflows](#api-testing-workflows)
5. [Endpoint Reference](#endpoint-reference)
6. [Test Scenarios](#test-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The **Safe Data Access Platform** is a privacy-governed statistical data access system with an 11-layer defense-in-depth architecture:

| Layer | Purpose |
|-------|---------|
| Gateway | API entry point with security middleware |
| Identity | JWT authentication & role-based access control |
| Consent | Purpose-scoped consent management |
| Ingestion | Raw dataset intake (admin only) |
| Classification | Field sensitivity detection |
| Anonymization | Privacy transformations |
| Storage | Encrypted logical data stores |
| Release | Dataset release engine |
| Access | Controlled researcher access |
| Audit | Comprehensive activity logging |
| Risk | Privacy risk scoring |

### User Roles
- **Admin**: Full system access, data ingestion, user management
- **Researcher**: Data access, consent requests, query execution
- **Reviewer**: Consent approval, risk assessment

---

## Prerequisites

### Environment Setup
```bash
cd backend
npm install
npm start
```

### Default Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

### Base URL
```
http://localhost:3000
```

---

## Getting Started

### 1. Import the Collection
1. Open Postman
2. Click **Import** → **Upload Files**
3. Select `SafeDataAccessPlatform.postman_collection.json`
4. The collection includes pre-configured variables and test scripts

### 2. Collection Variables
The collection uses these variables:

| Variable | Description | Initial Value |
|----------|-------------|---------------|
| `baseUrl` | API base URL | `http://localhost:3000` |
| `token` | Current session token | (empty) |
| `adminToken` | Admin JWT token | (empty) |
| `researcherToken` | Researcher JWT token | (empty) |
| `dataset_id` | Active dataset ID | (empty) |
| `consent_id` | Active consent ID | (empty) |
| `release_id` | Active release ID | (empty) |
| `benchmark_id` | Benchmark run ID | (empty) |
| `attack_id` | Attack simulation ID | (empty) |
| `curve_id` | Privacy-utility curve ID | (empty) |

---

## API Testing Workflows

### Workflow 1: Complete Data Release Process

#### Step 1: Health Check
**Purpose**: Verify system is operational
```http
GET {{baseUrl}}/health
```
**Expected Response**: `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "layers": { "gateway": "active", ... }
}
```

#### Step 2: Admin Authentication
**Purpose**: Obtain admin access token
```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "userId": "admin",
  "password": "admin123"
}
```
**Expected Response**: `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "userId": "admin", "role": "admin" }
}
```
**Test Script**: Automatically saves token to `adminToken` variable

#### Step 3: Register Researcher (Optional)
**Purpose**: Create researcher account if not exists
```http
POST {{baseUrl}}/api/auth/register
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "userId": "researcher",
  "password": "researcher123",
  "role": "researcher",
  "purposeScope": ["medical-research", "statistical-analysis"]
}
```

#### Step 4: Researcher Authentication
**Purpose**: Obtain researcher access token
```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "userId": "researcher",
  "password": "researcher123"
}
```

#### Step 5: Data Ingestion (JSON)
**Purpose**: Upload raw dataset
```http
POST {{baseUrl}}/api/ingestion/json
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "dataset": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@email.com",
      "ssn": "123-45-6789",
      "age": 35,
      "zipcode": "12345",
      "gender": "male",
      "disease": "Hypertension",
      "income": 75000
    }
  ],
  "metadata": {
    "source": "Medical Records",
    "description": "Patient health data"
  }
}
```
**Expected Response**: `201 Created`
```json
{
  "success": true,
  "datasetId": "dataset_abc123",
  "stats": { "recordCount": 1, "fieldCount": 9 }
}
```

#### Step 6: Data Classification
**Purpose**: Identify sensitive fields
```http
POST {{baseUrl}}/api/classification/{{dataset_id}}
Authorization: Bearer {{adminToken}}
```
**Expected Response**: Classification report with:
- Direct identifiers (name, email, ssn)
- Quasi-identifiers (age, zipcode, gender)
- Sensitive attributes (disease, income)

#### Step 7: Risk Assessment
**Purpose**: Evaluate re-identification risk
```http
POST {{baseUrl}}/api/risk/assess/{{dataset_id}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "k": 5
}
```

#### Step 8: Consent Request
**Purpose**: Researcher requests data access
```http
POST {{baseUrl}}/api/consent/request
Authorization: Bearer {{researcherToken}}
Content-Type: application/json

{
  "datasetId": "{{dataset_id}}",
  "purpose": "Medical Research - Cardiovascular Disease Study",
  "allowedFields": ["age", "gender", "disease", "income"],
  "expiryDate": "2025-12-31"
}
```
**Expected Response**: `201 Created`
```json
{
  "success": true,
  "consent": {
    "id": "consent_xyz789",
    "status": "pending",
    "researcherId": "researcher"
  }
}
```

#### Step 9: Approve Consent
**Purpose**: Admin approves access request
```http
POST {{baseUrl}}/api/consent/{{consent_id}}/approve
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "riskScore": 25
}
```

#### Step 10: Dataset Release
**Purpose**: Execute full release pipeline
```http
POST {{baseUrl}}/api/release/{{dataset_id}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "consentId": "{{consent_id}}",
  "customStrategies": {
    "suppression": {
      "fields": ["name", "email", "ssn"],
      "placeholder": "[REDACTED]"
    },
    "generalization": {
      "age": { "type": "range", "bins": [20, 30, 40, 50, 60] },
      "zipcode": { "type": "mask", "digits": 3 }
    }
  }
}
```

#### Step 11: Query Released Data
**Purpose**: Researcher accesses anonymized data
```http
POST {{baseUrl}}/api/access/query/{{release_id}}
Authorization: Bearer {{researcherToken}}
Content-Type: application/json

{
  "filters": {
    "disease": ["Hypertension", "Diabetes"]
  },
  "aggregations": [
    { "field": "income", "function": "avg" },
    { "field": "*", "function": "count" }
  ],
  "groupBy": ["disease"],
  "limit": 100
}
```

---

## Endpoint Reference

### 0. Health & Status
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | System health check |
| GET | `/api/status` | No | Platform status & stats |

### 1. Authentication
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/login` | No | Any | User login |
| POST | `/api/auth/register` | Yes | Admin | Register new user |
| GET | `/api/auth/users` | Yes | Admin | List all users |

### 2. Data Ingestion (Admin Only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/ingestion/json` | Yes | Ingest JSON dataset |
| POST | `/api/ingestion/csv` | Yes | Ingest CSV dataset |
| GET | `/api/ingestion/datasets` | Yes | List all datasets |
| GET | `/api/ingestion/datasets/:id/metadata` | Yes | Get dataset metadata |

### 3. Classification (Admin/Reviewer)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/classification/:datasetId` | Yes | Classify dataset fields |
| POST | `/api/classification/field/:fieldName` | Yes | Classify single field |

### 4. Consent Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/consent/request` | Yes | Researcher | Request data access |
| POST | `/api/consent/:id/approve` | Yes | Admin/Reviewer | Approve consent |
| POST | `/api/consent/:id/reject` | Yes | Admin/Reviewer | Reject consent |
| GET | `/api/consent/my` | Yes | Researcher | Get my consents |
| GET | `/api/consent/:id` | Yes | Any | Get consent details |
| GET | `/api/consent` | Yes | Admin/Reviewer | List all consents |

### 5. Risk Assessment (Admin/Reviewer)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/risk/assess/:datasetId` | Yes | Assess dataset risk |
| POST | `/api/risk/compare/:datasetId` | Yes | Compare before/after anonymization |
| POST | `/api/risk/k-anonymity/:datasetId` | Yes | Check k-anonymity compliance |

### 6. Dataset Release (Admin Only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/release/:datasetId` | Yes | Execute release pipeline |
| GET | `/api/release` | Yes | List releases |

### 7. Researcher Access (Researcher Only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/access/query/:releaseId` | Yes | Query released dataset |
| GET | `/api/access/summary/:releaseId` | Yes | Get dataset summary |
| GET | `/api/access/datasets` | Yes | List accessible datasets |
| GET | `/api/access/history` | Yes | Get query history |

### 8. Audit & Compliance (Admin Only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audit` | Yes | Query audit logs |
| GET | `/api/audit/user/:userId` | Yes | Get user activity |
| GET | `/api/audit/dataset/:datasetId` | Yes | Get dataset activity |
| GET | `/api/audit/consent/:consentId` | Yes | Get consent lifecycle |
| GET | `/api/audit/report` | Yes | Generate compliance report |
| GET | `/api/audit/export` | Yes | Export audit logs |

---

## Test Scenarios

### Scenario 1: Unauthorized Access
**Test**: Access admin endpoint without authentication
```http
GET {{baseUrl}}/api/ingestion/datasets
```
**Expected**: `401 Unauthorized`
```json
{
  "error": "Access token required"
}
```

### Scenario 2: Insufficient Permissions
**Test**: Researcher attempts admin operation
```http
POST {{baseUrl}}/api/ingestion/json
Authorization: Bearer {{researcherToken}}
```
**Expected**: `403 Forbidden`
```json
{
  "error": "Insufficient permissions"
}
```

### Scenario 3: Invalid Credentials
**Test**: Login with wrong password
```http
POST {{baseUrl}}/api/auth/login
{
  "userId": "admin",
  "password": "wrongpassword"
}
```
**Expected**: `401 Unauthorized`

### Scenario 4: Invalid Dataset Format
**Test**: Ingest non-array data
```http
POST {{baseUrl}}/api/ingestion/json
{
  "dataset": { "invalid": "format" }
}
```
**Expected**: `400 Bad Request`
```json
{
  "error": "Invalid dataset",
  "message": "Dataset must be an array"
}
```

### Scenario 5: Missing Consent
**Test**: Release dataset without consent
```http
POST {{baseUrl}}/api/release/{{dataset_id}}
{
  "consentId": "invalid-consent-id"
}
```
**Expected**: `400 Bad Request`

### Scenario 6: Query Without Access
**Test**: Query dataset researcher doesn't have access to
```http
POST {{baseUrl}}/api/access/query/unauthorized-release-id
```
**Expected**: `403 Forbidden`

---

## Testing Best Practices

### 1. Run Tests in Sequence
Use the "Complete Workflow" folder which contains ordered requests with proper test scripts that save variables between steps.

### 2. Verify Variable Persistence
After running authentication requests, verify variables are set:
- Open the collection's **Variables** tab
- Check that `adminToken` and `researcherToken` are populated

### 3. Test Error Handling
For each endpoint, test:
- Missing required fields
- Invalid data types
- Unauthorized access
- Non-existent resources

### 4. Validate Responses
Use Postman tests to validate:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has required fields", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success', true);
    pm.expect(jsonData).to.have.property('data');
});
```

### 5. Clean Up Test Data
After testing:
1. Delete test datasets
2. Revoke test consents
3. Remove test users (except default admin)

---

## Troubleshooting

### Issue: Token Expired
**Symptom**: `401 Unauthorized` with "Token expired" message
**Solution**: Re-run the login request to get a fresh token

### Issue: Collection Variables Not Set
**Symptom**: Requests fail with undefined variables like `{{dataset_id}}`
**Solution**: 
1. Run requests in the "Complete Workflow" folder sequentially
2. Check Console for variable assignment logs
3. Manually set variables if needed

### Issue: Port Already in Use
**Symptom**: `EADDRINUSE` error when starting server
**Solution**: 
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

### Issue: CORS Errors
**Symptom**: Browser blocks requests from different origin
**Solution**: The API includes CORS middleware. If testing from browser, ensure requests include proper headers.

### Issue: Rate Limiting
**Symptom**: `429 Too Many Requests`
**Solution**: The API has rate limiting. Wait a few seconds between requests or adjust rate limits in gateway configuration.

---

## Sample Test Data

### Minimal Dataset (5 records)
```json
{
  "dataset": [
    {"id": 1, "name": "John", "age": 35, "disease": "Hypertension"},
    {"id": 2, "name": "Jane", "age": 28, "disease": "Diabetes"},
    {"id": 3, "name": "Bob", "age": 45, "disease": "Heart Disease"},
    {"id": 4, "name": "Alice", "age": 52, "disease": "Cancer"},
    {"id": 5, "name": "Charlie", "age": 31, "disease": "Asthma"}
  ]
}
```

### CSV Sample
```csv
id,name,age,gender,disease,income
1,John Doe,35,male,Hypertension,75000
2,Jane Smith,28,female,Diabetes,68000
3,Bob Johnson,45,male,Heart Disease,92000
```

---

## Additional Resources

- **API Documentation**: Check `backend/README.md`
- **Postman Collection**: `SafeDataAccessPlatform.postman_collection.json`
- **Architecture Details**: See source code in `backend/src/`

---

## Contact & Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the API response messages
3. Check server logs in the terminal running the backend

**Server Log Location**: Console output from `npm start`

---

*Document Version: 1.0.0*  
*Last Updated: February 2026*
