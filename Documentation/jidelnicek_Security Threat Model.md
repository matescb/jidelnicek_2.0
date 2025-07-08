# Jídelníček Security Threat Model

## Executive Summary

This document provides a security threat model for the Jídelníček meal planning application, designed for small-scale deployment on a single VPS serving approximately 100 users. The analysis focuses on practical security measures appropriate for a personal project with limited attack surface.

**Key Findings:**
- Small user base (100 users) significantly reduces threat profile
- Single VPS deployment eliminates distributed system complexities
- Primary concerns: Basic authentication security, SQL injection prevention, and HTTPS
- Estimated implementation effort: 2-3 weeks for essential security measures

## 1. Asset Identification

### 1.1 User Data Assets

#### Personal Identifiable Information (PII)
- **Email addresses** - Used for authentication and communication
- **Names** - User display names and participant names
- **OAuth tokens** - Social login credentials
- **IP addresses** - Logged for security monitoring
- **User preferences** - Language, units, dietary requirements

#### Authentication Credentials
- **Password hashes** - Bcrypt-encrypted passwords
- **JWT tokens** - Session authentication tokens
- **Refresh tokens** - Long-lived authentication tokens
- **Password reset tokens** - Temporary recovery tokens
- **Email verification tokens** - Account activation tokens

#### User-Generated Content
- **Personal recipes** - Including nutritional data and instructions
- **Trip plans** - Multi-day expedition data with participant info
- **Ingredient databases** - Custom nutritional information
- **Snack lists** - Personal food preferences
- **Meal ratings and notes** - Personal feedback data
- **Recipe images** - Uploaded food photos

### 1.2 Application Data Assets

#### Recipe Marketplace Data
- **Public recipes** - Community-shared content
- **Recipe ratings** - 1-5 star ratings
- **Recipe reviews** - User comments
- **Fork relationships** - Recipe derivation tracking
- **Replication counts** - Popularity metrics

#### Trip Planning Data
- **Trip configurations** - Dates, participants, coefficients
- **Meal assignments** - Recipe-to-day mappings
- **Nutritional calculations** - Computed values
- **Shopping lists** - Aggregated ingredient requirements
- **Packing lists** - Day-by-day food organization
- **Fuel calculations** - Stove efficiency data

#### System Data
- **Global ingredient database** - Fixed nutritional reference data
- **User activity logs** - Audit trail data
- **Session data** - Active user sessions in Redis
- **Cached calculations** - Performance optimization data
- **Export files** - Generated PDFs and spreadsheets

### 1.3 Infrastructure Assets

#### Single VPS Environment
- **PostgreSQL database** - Main data store on same VPS
- **Redis cache** - Session storage (if implemented)
- **SQLite test DB** - Development/testing data

#### Application Services
- **FastAPI backend** - Single process serving all endpoints
- **Local file storage** - Recipe images stored on VPS disk
- **Basic email service** - Password resets via SMTP

#### External Dependencies
- **OAuth providers** - Google authentication (optional)
- **Let's Encrypt** - Free SSL certificates

### 1.4 Business Assets

#### Intellectual Property
- **Source code** - Application implementation
- **Database schemas** - Data structure designs
- **API specifications** - Interface definitions
- **Business logic** - Calculation algorithms

#### Reputation Assets
- **User trust** - Data privacy expectations
- **Service reliability** - Uptime and performance
- **Data accuracy** - Nutritional calculation precision
- **Community quality** - Marketplace content standards

## 2. Threat Actors

### 2.1 Realistic Threat Profile (100 Users)

#### Automated Scanners & Bots
- **Motivation**: Finding easy targets for spam/malware
- **Capabilities**: Port scanning, common vulnerability checks
- **Targets**: Default passwords, outdated software, open ports
- **Likelihood**: High (constant background noise)
- **Impact**: Low (easily mitigated)

#### Casual Attackers
- **Motivation**: Practice, curiosity
- **Capabilities**: Basic SQL injection, XSS attempts
- **Targets**: Input fields, authentication
- **Likelihood**: Low (small target)
- **Impact**: Low to Medium

#### Malicious Users
- **Motivation**: Free service abuse, data vandalism
- **Capabilities**: Legitimate account access
- **Targets**: Recipe spam, resource consumption
- **Likelihood**: Low (small community)
- **Impact**: Low

### 2.2 Negligible Threats (Not Worth Addressing)

- **Advanced Persistent Threats**: 100 users of meal planning is not a target
- **DDoS Attacks**: Small user base unlikely to attract attention
- **Ransomware**: No financial incentive with free service
- **Insider Threats**: Single developer/admin scenario

## 3. Attack Vectors & Threats

### 3.1 Authentication and Session Management

#### Brute Force Attacks
- **Vector**: Login endpoints repeatedly attempted
- **Method**: Automated password guessing
- **Target**: User accounts with weak passwords
- **Current Controls**: Account lockout after 5 attempts
- **Gaps**: No CAPTCHA, rate limiting per IP only

#### Credential Stuffing
- **Vector**: Reuse of leaked credentials from other breaches
- **Method**: Automated login attempts with known email/password pairs
- **Target**: Users who reuse passwords
- **Current Controls**: 2FA implementation (TOTP-based)
- **Gaps**: No breach monitoring

#### Session Hijacking
- **Vector**: JWT token theft via XSS or network sniffing
- **Method**: Token replay attacks
- **Target**: Active user sessions
- **Current Controls**: HTTPS enforcement
- **Gaps**: No token binding, no session fingerprinting

#### Password Reset Exploitation
- **Vector**: Weak reset token generation or validation
- **Method**: Token prediction or enumeration
- **Target**: Any user account
- **Current Controls**: Random token generation
- **Gaps**: Token lifetime not specified, no rate limiting

### 3.2 Injection Attacks

#### SQL Injection
- **Vector**: User input fields (recipe names, instructions, search)
- **Method**: Malicious SQL in input parameters
- **Target**: Database queries
- **Current Controls**: SQLAlchemy ORM with parameterized queries
- **Gaps**: Custom queries may bypass ORM

#### Cross-Site Scripting (XSS)
- **Vector**: Recipe instructions, reviews, user names
- **Method**: JavaScript injection in user content
- **Target**: Other users viewing content
- **Current Controls**: Content sanitization mentioned
- **Gaps**: Markdown rendering, image alt text

#### XML External Entity (XXE)
- **Vector**: Excel/XML export uploads (future feature)
- **Method**: Malicious XML processing
- **Target**: Server file system
- **Current Controls**: None (feature not implemented)
- **Gaps**: Library default configurations

#### Command Injection
- **Vector**: Image processing, PDF generation
- **Method**: Shell command injection
- **Target**: Server execution environment
- **Current Controls**: Library usage (Pillow, ReportLab)
- **Gaps**: Filename sanitization

### 3.3 API Security (Simplified)

#### Basic Rate Limiting
- **Vector**: Repeated requests from single IP
- **Method**: Simple request flooding
- **Target**: VPS resource consumption
- **Mitigation**: nginx rate limiting (built-in, free)
- **Implementation**: 5 minutes configuration

#### Token Security
- **Vector**: JWT token theft
- **Method**: XSS or insecure storage
- **Target**: Session hijacking
- **Mitigation**: HTTP-only cookies, proper CORS
- **Implementation**: Already built into FastAPI

### 3.4 Data Exposure

#### Insecure Direct Object References (IDOR)
- **Vector**: Sequential IDs in URLs
- **Method**: ID enumeration and access
- **Target**: Private recipes, trips, user data
- **Current Controls**: UUID usage for IDs
- **Gaps**: Authorization checks on all endpoints

#### Information Disclosure
- **Vector**: Error messages, API responses, logs
- **Method**: Information gathering
- **Target**: System internals, user existence
- **Current Controls**: Production error handling
- **Gaps**: Stack traces in development

#### Insufficient Access Controls
- **Vector**: Missing authorization checks
- **Method**: Direct API calls
- **Target**: Other users' private data
- **Current Controls**: Role-based access mentioned
- **Gaps**: Granular permission validation

#### Data Leakage in Exports
- **Vector**: PDF/Excel generation
- **Method**: Metadata extraction
- **Target**: User information, system paths
- **Current Controls**: None specified
- **Gaps**: Metadata stripping

### 3.5 File Upload Vulnerabilities

#### Malicious File Upload
- **Vector**: Recipe image uploads
- **Method**: Executable disguised as image
- **Target**: Server execution, storage
- **Current Controls**: File size limits (5MB)
- **Gaps**: File type validation, content scanning

#### Path Traversal
- **Vector**: Filename manipulation
- **Method**: Directory traversal sequences
- **Target**: File system access
- **Current Controls**: S3 storage planned
- **Gaps**: Filename sanitization

#### Storage Exhaustion
- **Vector**: Large file uploads
- **Method**: Repeated uploads to fill storage
- **Target**: Storage capacity
- **Current Controls**: Per-file limits, 10 images per recipe
- **Gaps**: Per-user total storage limits

#### Image Processing Exploits
- **Vector**: Malformed image files
- **Method**: Buffer overflow in processing
- **Target**: Server memory/execution
- **Current Controls**: Pillow library usage
- **Gaps**: Library version management

### 3.6 Business Logic Attacks

#### Recipe Manipulation
- **Vector**: Nutritional value tampering
- **Method**: False data entry
- **Target**: Calculation accuracy, user safety
- **Current Controls**: User-entered data
- **Gaps**: Validation ranges, anomaly detection

#### Coefficient Exploitation
- **Vector**: Extreme coefficient values
- **Method**: Integer overflow, resource exhaustion
- **Target**: Calculation engine
- **Current Controls**: None specified
- **Gaps**: Input validation ranges

#### Marketplace Pollution
- **Vector**: Bulk recipe publishing
- **Method**: Automated spam recipes
- **Target**: Marketplace quality
- **Current Controls**: Auto-approval system
- **Gaps**: Rate limiting, quality checks

#### Fork Bomb
- **Vector**: Recursive recipe forking
- **Method**: Automated forking loops
- **Target**: Database storage, relationships
- **Current Controls**: Fork tracking
- **Gaps**: Fork rate limiting

## 4. Risk Assessment (STRIDE Methodology)

### 4.1 Spoofing

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| Account Takeover via Credential Stuffing | Reused passwords | High | High | **CRITICAL** | P0 |
| OAuth Token Theft | XSS, Malware | Medium | High | **HIGH** | P1 |
| Email Spoofing | Weak email validation | Medium | Medium | **MEDIUM** | P2 |
| Session Replay | Token interception | Low | High | **MEDIUM** | P2 |
| Admin Impersonation | Privilege escalation | Low | Critical | **HIGH** | P1 |
| API Key Theft | Client exposure | Medium | High | **HIGH** | P1 |

### 4.2 Tampering

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| SQL Injection | Input fields | Medium | Critical | **CRITICAL** | P0 |
| Recipe Data Manipulation | Malicious updates | High | Medium | **HIGH** | P1 |
| XSS in User Content | Recipe instructions | High | Medium | **HIGH** | P1 |
| Calculation Tampering | API manipulation | Medium | High | **HIGH** | P1 |
| Export File Modification | Man-in-the-middle | Low | Low | **LOW** | P3 |
| Cache Poisoning | Redis manipulation | Low | High | **MEDIUM** | P2 |
| Trip Data Corruption | Concurrent updates | Medium | Medium | **MEDIUM** | P2 |

### 4.3 Repudiation

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| Audit Log Tampering | Database access | Low | High | **MEDIUM** | P2 |
| Transaction Denial | Missing logs | Medium | Medium | **MEDIUM** | P2 |
| Recipe Change Denial | Version control gaps | Medium | Low | **LOW** | P3 |
| User Action Denial | Insufficient logging | High | Low | **MEDIUM** | P2 |
| Export Generation Denial | No audit trail | Medium | Low | **LOW** | P3 |

### 4.4 Information Disclosure

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| IDOR - Private Recipes | Direct object access | High | High | **CRITICAL** | P0 |
| User Enumeration | Login errors | High | Low | **MEDIUM** | P2 |
| Stack Trace Exposure | Error handling | Medium | Medium | **MEDIUM** | P2 |
| Metadata Leakage | Export files | Medium | Low | **LOW** | P3 |
| API Response Over-sharing | Verbose responses | High | Medium | **HIGH** | P1 |
| Database Schema Exposure | Error messages | Low | Medium | **LOW** | P3 |
| Email Harvesting | Public profiles | Medium | Low | **LOW** | P3 |
| Trip Participant Exposure | Shared links | High | Medium | **HIGH** | P1 |

### 4.5 Denial of Service

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| API Rate Limit Bypass | Distributed requests | High | High | **CRITICAL** | P0 |
| Calculation Engine DoS | Complex recipes | Medium | High | **HIGH** | P1 |
| Storage Exhaustion | Image uploads | Medium | High | **HIGH** | P1 |
| Database Connection Pool | Connection leaks | Low | Critical | **HIGH** | P1 |
| Export Service DoS | Large trip exports | Medium | Medium | **MEDIUM** | P2 |
| Cache Stampede | Popular content | Low | Medium | **LOW** | P3 |

### 4.6 Elevation of Privilege

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| JWT Manipulation | Token forging | Low | Critical | **HIGH** | P1 |
| Role Bypass | Authorization flaws | Medium | Critical | **CRITICAL** | P0 |
| Admin Function Access | Endpoint discovery | Medium | Critical | **CRITICAL** | P0 |
| Recipe Ownership Takeover | Fork exploitation | Low | Medium | **MEDIUM** | P2 |
| Shared Link Privilege | Permission confusion | Medium | Medium | **MEDIUM** | P2 |
| SQL Injection Privilege | Database queries | Low | Critical | **HIGH** | P1 |

## 5. Practical Security Measures

### 5.1 Essential Security (Week 1)

#### HTTPS Configuration
- **Let's Encrypt SSL** - Free automated certificates
- **nginx configuration** - Force HTTPS redirect
- **HSTS header** - Prevent downgrade attacks
- **Implementation**: 1 hour

#### Basic Authentication Security
- **Bcrypt password hashing** - Already implemented
- **Simple rate limiting** - nginx config for login endpoints
- **Strong passwords** - Minimum 12 characters with complexity requirements (uppercase, lowercase, number, special character)
- **Implementation**: 2 hours

#### SQL Injection Prevention
- **SQLAlchemy ORM** - Use parameterized queries (already done)
- **Input validation** - Pydantic models (existing)
- **No raw SQL** - Stick to ORM methods
- **Implementation**: Code review only

### 5.2 Nice-to-Have Security (Week 2)

#### Simple 2FA (Optional)
- **TOTP only** - No SMS (too expensive)
- **pyotp library** - Simple implementation
- **Recovery codes** - Print and save
- **Implementation**: 3 days (if desired)

#### Basic Monitoring
- **fail2ban** - Block repeated failed logins
- **nginx access logs** - Basic traffic monitoring
- **Daily backup** - Simple cron job to external storage
- **Implementation**: 1 day

#### Input Validation & Sanitization (Priority: CRITICAL)

**Immediate Implementation:**
- **Comprehensive Input Validation**
  ```python
  # Pydantic model example
  class RecipeCreate(BaseModel):
      name: constr(min_length=1, max_length=100, regex=r'^[\w\s\-\.]+$')
      instructions: constr(max_length=2000)
      prep_time_minutes: conint(ge=0, le=1440)  # Max 24 hours
      water_ml: conint(ge=0, le=10000)  # Max 10L
      
      @validator('instructions')
      def sanitize_instructions(cls, v):
          return bleach.clean(v, tags=['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'])
  ```
  - Estimated effort: 2 weeks

- **SQL Injection Prevention Audit**
  - Review all database queries
  - Enforce parameterized queries
  - Implement query logging
  - Static analysis tools integration
  - Estimated effort: 1 week

- **XSS Prevention**
  - Content Security Policy headers
  - HTML encoding for all outputs
  - Markdown sanitization
  - DOM purification on frontend
  - Estimated effort: 1 week

### 5.3 Skip These (Overkill for 100 Users)

- **Distributed tracing** - Single server doesn't need it
- **SIEM integration** - Too complex, use grep on logs
- **API Gateway** - nginx is sufficient
- **Kubernetes security** - Not using Kubernetes
- **DDoS protection** - Cloudflare free tier if ever needed
- **Bug bounty program** - No budget, low value target


#### Data Protection (Priority: HIGH)

**Immediate Implementation:**
- **Encryption at Rest**
  - Database field encryption for PII
  - Encrypted backups
  - Key rotation procedures
  - Estimated effort: 2 weeks

- **Access Control Matrix**
  ```python
  # Role-based permissions
  class Permissions(Enum):
      RECIPE_CREATE = "recipe:create"
      RECIPE_READ_OWN = "recipe:read:own"
      RECIPE_READ_PUBLIC = "recipe:read:public"
      RECIPE_UPDATE_OWN = "recipe:update:own"
      RECIPE_DELETE_OWN = "recipe:delete:own"
      TRIP_CREATE = "trip:create"
      TRIP_READ_OWN = "trip:read:own"
      TRIP_SHARE = "trip:share"
      ADMIN_ALL = "admin:*"
  
  ROLE_PERMISSIONS = {
      "user": [
          Permissions.RECIPE_CREATE,
          Permissions.RECIPE_READ_OWN,
          Permissions.RECIPE_READ_PUBLIC,
          # ...
      ],
      "admin": [Permissions.ADMIN_ALL]
  }
  ```
  - Estimated effort: 2 weeks

#### File Upload Security (Priority: MEDIUM)

**Implementation:**
- **Secure File Handling**
  ```python
  import magic
  from PIL import Image
  import hashlib
  
  async def validate_upload(file: UploadFile):
      # Check file size
      if file.size > 5 * 1024 * 1024:
          raise ValueError("File too large")
      
      # Check MIME type
      file_content = await file.read()
      mime = magic.from_buffer(file_content, mime=True)
      if mime not in ['image/jpeg', 'image/png', 'image/webp']:
          raise ValueError("Invalid file type")
      
      # Verify it's actually an image
      try:
          img = Image.open(io.BytesIO(file_content))
          img.verify()
      except:
          raise ValueError("Invalid image file")
      
      # Generate safe filename
      ext = mime.split('/')[-1]
      filename = f"{hashlib.sha256(file_content).hexdigest()}.{ext}"
      
      return filename, file_content
  ```
  - Estimated effort: 1 week

### 5.2 Process Controls

#### Security Development Lifecycle (Priority: HIGH)

**Immediate Implementation:**
- **Security Code Review Process**
  - Mandatory review for auth changes
  - Security checklist for PRs
  - Automated SAST tools
  - Estimated effort: 1 week setup

- **Dependency Management**
  - Automated vulnerability scanning
  - Weekly dependency updates
  - Security advisory monitoring
  - Estimated effort: 3 days setup

**Ongoing Processes:**
- **Security Training**
  - OWASP Top 10 training
  - Secure coding practices
  - Incident response procedures
  - Quarterly security updates

- **Penetration Testing**
  - Initial assessment before launch
  - Quarterly automated scans
  - Annual manual penetration test
  - Bug bounty program (future)

### 5.4 Simple Monitoring Setup

#### fail2ban Configuration
```bash
# /etc/fail2ban/jail.local
[jidelnicek]
enabled = true
port = http,https
filter = jidelnicek
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
```

#### Basic Logging
```python
# Just use Python's built-in logging
import logging

logger = logging.getLogger(__name__)

# Log failed logins and errors
logger.warning(f"Failed login attempt from {ip_address}")
```

**What to Monitor:**
- Failed login attempts (fail2ban handles)
- 500 errors (check daily)
- Disk space (cron job alert)
- SSL certificate expiry (Let's Encrypt handles)

## 6. Realistic Implementation Plan

### Week 1: Essential Security
**Day 1-2:**
- [ ] Configure HTTPS with Let's Encrypt
- [ ] Set up nginx rate limiting
- [ ] Enable fail2ban for SSH and web
- [ ] Review all database queries for SQL injection

**Day 3-5:**
- [ ] Add CORS headers properly
- [ ] Implement secure cookie settings
- [ ] Set up daily backups
- [ ] Basic error handling (no stack traces)

**Cost**: $0 (all open source)
**Time**: 1 week part-time

### Week 2: Nice-to-Have Features
**Optional Additions:**
- [ ] Simple 2FA with TOTP (3 days)
- [ ] Input validation improvements (1 day)
- [ ] Security headers (CSP, etc.) (1 day)

### Ongoing: Simple Maintenance
**Monthly (30 minutes):**
- [ ] Check fail2ban logs
- [ ] Update system packages
- [ ] Verify backups work
- [ ] Review error logs

**Quarterly:**
- [ ] Update Python dependencies
- [ ] Review nginx logs for patterns
- [ ] Test backup restoration

**Annual Cost**: $0-50 (VPS hosting only)
**Time**: 1-2 hours per month

### Success Metrics (Realistic)

#### What Success Looks Like
- **No security breaches** - Primary goal
- **HTTPS always on** - Check with SSL Labs
- **No spam in recipes** - Community stays clean
- **Backups work** - Test quarterly
- **Updates applied** - Within 1 week of release

#### What Not to Worry About
- Complex metrics (MTTD, MTTR) - Overkill
- 100% 2FA adoption - Optional feature
- Security scanning - Use free online tools occasionally
- Compliance certifications - Not needed at this scale

### Risk Acceptance Criteria

**Acceptable Risks:**
- Low-priority risks with mitigation cost > potential impact
- Risks requiring major architectural changes (deferred to v2)
- Third-party dependency risks with active vendor support

**Unacceptable Risks:**
- Any risk that could lead to PII exposure
- Authentication bypass vulnerabilities
- Data integrity compromises
- Service availability >4 hours

## 7. Compliance (Simplified)

### Basic GDPR Compliance
- **Privacy Policy** - Simple page explaining data use
- **Data Export** - Already have PDF export
- **Account Deletion** - Add "Delete Account" button
- **Cookie Notice** - Simple banner

### What to Skip
- Formal certifications (ISO 27001, SOC 2) - Expensive overkill
- Data Processing Agreements - No third parties
- Privacy Impact Assessments - Too formal
- 72-hour breach notification - Unlikely to apply

## 8. Security Checklist

### Before Launch
- [ ] HTTPS configured and forced
- [ ] fail2ban protecting SSH and web
- [ ] Backups automated and tested
- [ ] Error messages don't leak info
- [ ] Rate limiting on login
- [ ] Strong password requirements
- [ ] CORS properly configured
- [ ] Security headers set

### Monthly Routine
- [ ] Check logs for attacks
- [ ] Update system packages
- [ ] Verify SSL certificate renewal
- [ ] Test a backup restore
- [ ] Review disk space

## 9. Conclusion

For a 100-user meal planning application on a single VPS, security needs are straightforward. Focus on the basics: HTTPS, secure authentication, SQL injection prevention, and regular backups. Don't over-engineer.

**Essential Security (Must Have):**
1. HTTPS everywhere (Let's Encrypt)
2. SQL injection prevention (use ORM)
3. Rate limiting (nginx/fail2ban)
4. Regular backups (automated)
5. Keep software updated

**Nice to Have (If Time Allows):**
1. Optional 2FA
2. Security headers
3. Better logging

**Don't Bother With:**
1. Complex monitoring systems
2. Distributed system security
3. Compliance certifications
4. Advanced threat detection
5. Security team processes

**Time Investment**: 1-2 weeks initial setup, 1-2 hours monthly maintenance
**Cost**: Essentially free (using open source tools)

---

**Document Version**: 2.0 (Single VPS Reality Check)
**Updated**: 2025-01-08  
**Purpose**: Practical security for small-scale deployment