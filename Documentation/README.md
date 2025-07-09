# Jídelníček Project - Pre-Coding Documentation

## Project Overview
Jídelníček is a specialized meal planning web application designed for outdoor enthusiasts (long-distance hikers, runners) and scout expedition leaders (5-20 participants) to plan, organize, and manage meals for multi-day trips with precise nutritional tracking.

## Documentation Structure

### 📋 Requirements & Planning
- **[[jidelnicek_US]]** - 21 User Stories defining all features
- **[[jidelnicek_PRD]]** - Product Requirements Document with business logic
- **[[jidelnicek_Project Management]]** - Development phases, team structure, timeline

### 🧪 Testing & Quality
- **[[jidelnicek_Acceptance Tests]]** - 114 test cases covering all user stories
- **[[jidelnicek_Test Strategy]]** - Comprehensive testing approach with SQLite/PostgreSQL
- **[[jidelnicek_Data Validation Rules]]** - Field validation and business logic constraints

### 🔧 Technical Architecture
- **[[jidelnicek_Technical Architecture]]** - Python/FastAPI backend, PostgreSQL database
- **[[jidelnicek_OpenAPI Spec]]** - Complete API specification (73 endpoints)
- **[[jidelnicek_CI-CD Pipeline]]** - GitHub Actions, Docker, deployment automation

### 🎨 Design & UX
- **[[jidelnicek_Component Library]]** - UI design system and components
- **[[jidelnicek_User Documentation Plan]]** - Documentation strategy and content plan

### 🔒 Security & Infrastructure
- **[[jidelnicek_Security Threat Model]]** - 42 threats identified with mitigations
- **[[jidelnicek_CI-CD Pipeline]]** - Includes Docker/Kubernetes configurations

### ✅ Project Readiness
- **[[jidelnicek_Integration Review Checklist]]** - 240+ verification points
- **[[jidelnicek_Pre-Coding Sign-off]]** - Final readiness assessment

### 📚 Additional Resources
- **[[jidelnicek_Pre-Coding Master Plan]]** - Parallel execution strategy
- **[[Sub-Agent Task Specifications]]** - Detailed task breakdowns

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11)
- **Database**: PostgreSQL 15 (in Docker)
- **ORM**: SQLAlchemy 2.0
- **Task Queue**: Celery (if needed)
- **Cache**: Redis (optional)

### Frontend
- **Framework**: React/Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand/Context API

### Infrastructure
- **Hosting**: vpsFree.cz (4GB VPS)
- **Container**: Docker Compose
- **Proxy**: Caddy (automatic HTTPS)
- **CI/CD**: GitHub Actions
- **Monitoring**: Simple health checks

## Key Features
- Recipe creation with comprehensive nutritional tracking
- Multi-day trip planning for up to 20 participants
- Participant coefficients for portion adjustment
- Recipe marketplace with version control
- Fuel calculations for camping stoves
- Export capabilities (shopping lists, packing lists)
- Bilingual support (English/Czech)

## Project Timeline
- **Total Duration**: 12-18 months (solo developer)
- **Phase 1 (MVP)**: Months 1-4
- **Phase 2 (Multi-User)**: Months 5-7
- **Phase 3 (Community)**: Months 8-10
- **Phase 4 (Advanced)**: Months 11-13
- **Launch**: Month 14-18

## Deployment
- **Target**: 100 users total (~10 concurrent)
- **Hosting**: vpsFree.cz (300 CZK/month)
- **Architecture**: Single VPS with Docker Compose
- **Backups**: Automatic daily snapshots

## Getting Started
1. Review the [[jidelnicek_Pre-Coding Sign-off]] for project readiness
2. Check the [[jidelnicek_Project Management]] for team roles and sprint planning
3. Reference the [[jidelnicek_Technical Architecture]] for system design
4. Use the [[jidelnicek_Integration Review Checklist]] during development

## Status
✅ **Pre-coding phase complete** - All documentation and planning deliverables are ready. The project is prepared to enter the development phase upon stakeholder sign-off.