# SafeData Governance Orchestrator - Frontend

A cyber governance command interface for the Safe Data Access Platform - a privacy-preserving national statistical data system.

## Overview

This is the **visual control system** for a defense-in-depth privacy architecture. The interface is designed to communicate:
- **Authority** - Government-grade security infrastructure
- **Security Depth** - 9-layer protection system
- **Scientific Privacy Engineering** - k-anonymity, l-diversity, t-closeness, differential privacy
- **Policy Enforcement** - DPDP Act 2023 compliance
- **Real-time Risk Intelligence** - Live attack simulation and vulnerability assessment

## Technology Stack

- **React 19** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Custom cyber governance theme
- **Framer Motion** - Micro-interactions and animations
- **Recharts** - Technical data visualizations
- **Axios** - API communication layer
- **React Router** - Navigation and routing

## Visual Design

### Theme: Cyber Governance / SOC / Intelligence System

**Colors:**
- Background: `#0A0F1C`
- Panels: `#121A2B`
- Borders: `#1F2A44`
- Primary Accent: `#00D1FF` (Cyber Blue)
- Risk Warning: `#FF4D4D` (Alert Red)
- Privacy Safe: `#00FFAA` (Secure Green)
- Sensitive: `#B388FF` (Data Purple)

**Typography:**
- Titles: Inter / Space Grotesk
- Data/Numbers: JetBrains Mono

**Design Principles:**
- Thin borders everywhere
- Subtle grid background texture
- Sharp rectangular panels (no rounded corners)
- Minimal glow effects for risk metrics
- No soft SaaS look - this is infrastructure

## Architecture

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│              Top Command Bar                        │
├──────────┬────────────────────────────┬─────────────┤
│          │                            │             │
│   Left   │   Main Data Intelligence   │   Right     │
│ System   │        Workspace           │  Context    │
│Navigation│                            │   Panel     │
│          │                            │  (Live)     │
│          │                            │  Metrics    │
└──────────┴────────────────────────────┴─────────────┘
```

### Module Structure

**Navigation Modules:**
1. **Governance Command** - System overview and hero dashboard
2. **Ingestion** - Secure dataset intake with encryption
3. **Classification** - Field sensitivity mapping visualizer
4. **Risk Engine** - 5-factor privacy risk assessment
5. **Attack Lab** - Re-identification attack simulation
6. **Anonymization Control** - Privacy transformation tuning
7. **Release Pipeline** - 7-stage secure release execution
8. **DP Monitor** - Differential privacy budget tracking
9. **Audit Chain** - Tamper-proof blockchain-style audit
10. **Compliance** - DPDP Act 2023 mapping
11. **Reports** - Privacy-utility analysis reports

### Context State Management

**AuthContext** - Authentication and user management
- JWT token handling
- Role-based access control (admin, reviewer, researcher, auditor)

**SystemContext** - Global system state
- Real-time privacy scores
- Active consents monitoring
- DP budget tracking
- Attack surface status
- Audit chain validation

**NavigationContext** - Module navigation
- Active module state
- Breadcrumb management
- Module accessibility based on roles

## Key Features

### Governance Command Center (Hero Screen)
- System Privacy Score with trend indicators
- Interactive Privacy-Utility Curve
- Attack Simulation Panel (linkage, homogeneity, background)
- Active Consent Monitor
- DP Budget Tracker
- Real-time system metrics

### Attack Lab (Judge-Winning Feature)
- Linkage attack simulation
- Homogeneity vulnerability detection
- Background knowledge exploitation testing
- Vulnerability heatmap
- Defense recommendations (immediate, short-term, long-term)

### Anonymization Control
- Interactive sliders for k, l, t parameters
- Real-time privacy-utility tradeoff curve
- Before/after data preview
- Generalization visualization

### DPDP Compliance Map
- All 7 principles mapped to system mechanisms
- 100% compliance tracking
- Certificate generation

## API Integration

The frontend connects to the SafeData Access Platform backend API:

**Base URL:** `http://localhost:3000`

**Key Endpoints:**
- `GET /api/risk/summary` - Privacy posture score
- `GET /api/attack-simulation/status` - Attack surface metrics
- `GET /api/consent/active` - Active consent grants
- `GET /api/dp/budget` - Differential privacy budget
- `GET /api/audit/chain` - Blockchain audit trail
- `GET /api/compliance/dpdp` - DPDP compliance mapping

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend API running (see backend README)

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
VITE_API_URL=http://localhost:3000
VITE_ENABLE_MOCK_API=true
```

### Default Credentials

| Role | User ID | Password |
|------|---------|----------|
| Admin | `admin` | `admin123` |
| Researcher | `researcher` | `researcher123` |

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── charts/         # Recharts visualizations
│   │   ├── layout/         # Layout components (CommandBar, Navigation, etc.)
│   │   └── screens/        # Module screens
│   ├── contexts/           # React Context providers
│   ├── services/           # API layer (Axios)
│   ├── App.jsx            # Main application
│   ├── index.css          # Tailwind + custom styles
│   └── main.jsx           # Entry point
├── dist/                   # Production build
├── package.json
├── tailwind.config.js      # Custom theme configuration
└── vite.config.js         # Vite configuration
```

## Design Philosophy

This is **NOT a dashboard**. This is a **Data Governance Command Infrastructure UI**.

The interface must make judges think: *"This is not a project. This is infrastructure."*

- **Authority**: Government-grade visual language
- **Security**: Every element communicates protection depth
- **Science**: Privacy engineering principles visualized
- **Policy**: Compliance as a core feature, not an afterthought
- **Intelligence**: Real-time threat awareness

## Security Features

- JWT-based authentication
- Role-based access control
- Automatic token refresh
- Route protection
- Secure API communication

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance

- Vite-powered fast builds
- Optimized chunk splitting
- Lazy loading for routes (future enhancement)
- Efficient re-renders with React Context

## License

MIT License - See LICENSE file

## Support

For support, email: support@safedataaccess.com

---

**Built with 🔒 by the SafeData Governance Team**

**Version:** 2.1.0  
**Last Updated:** 2024