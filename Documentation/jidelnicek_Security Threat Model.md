# Jídelníček Security Threat Model (MVP Edition)

## Executive Summary

This document provides a pragmatic security approach for the Jídelníček meal planning application MVP, targeting 100 users on a single VPS. We focus on essential security without over-engineering, acknowledging that perfect security isn't needed for the initial launch.

**Security Philosophy:**
- Implement basic security well rather than complex security poorly
- Focus on OWASP Top 10 basics, not advanced threats
- Build security that can grow with the application
- Accept that some risks are not worth mitigating at this scale

**MVP Security Priorities:**
1. **Phase 1 (MVP)**: Password security, HTTPS, SQL injection prevention
2. **Phase 2 (Post-launch)**: Optional 2FA, enhanced monitoring
3. **Phase 3 (Growth)**: Advanced features as needed

**Time Investment**: 3-5 days for essential security
**Cost**: $0 (all open source tools)

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
- **MVP Controls**: Basic rate limiting
- **Phase 2**: Optional 2FA (TOTP-based)
- **Phase 3**: Breach monitoring integration

#### Session Hijacking
- **Vector**: JWT token theft via XSS or network sniffing
- **Method**: Token replay attacks
- **Target**: Active user sessions
- **MVP Controls**: HTTPS enforcement, HTTP-only cookies
- **Good Enough**: Basic JWT with reasonable expiry (24 hours)
- **Skip for MVP**: Complex session fingerprinting, token binding

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

### 4.3 Repudiation (MVP: Accept the Risk)

**What We're Tracking:**
- Failed login attempts (for rate limiting)
- 500 errors (to fix bugs)

**What We're NOT Tracking:**
- Every user action (overkill)
- Detailed audit logs (YAGNI)
- Change history (not a bank)

**Why This Is Fine:**
- 100 users of recipes don't need audit trails
- Can add logging if problems arise
- Focus on features, not forensics

### 4.4 Information Disclosure (Simple Prevention)

**MVP Protection:**
```python
# Check ownership before returning data
if recipe.user_id != current_user.id and not recipe.is_public:
    raise HTTPException(404)  # Don't reveal it exists

# Generic error messages
try:
    # ... code ...
except Exception as e:
    logger.error(f"Error: {e}")  # Log details
    raise HTTPException(500, "Something went wrong")  # Generic to user
```

**That Prevents:**
- Private recipe access (IDOR)
- Stack trace leaks
- Database schema exposure
- Most enumeration attacks

### 4.5 Denial of Service

| Threat | Attack Vector | Likelihood | Impact | Risk Level | Priority |
|--------|---------------|------------|---------|------------|----------|
| API Rate Limit Bypass | Distributed requests | High | High | **CRITICAL** | P0 |
| Calculation Engine DoS | Complex recipes | Medium | High | **HIGH** | P1 |
| Storage Exhaustion | Image uploads | Medium | High | **HIGH** | P1 |
| Database Connection Pool | Connection leaks | Low | Critical | **HIGH** | P1 |
| Export Service DoS | Large trip exports | Medium | Medium | **MEDIUM** | P2 |
| Cache Stampede | Popular content | Low | Medium | **LOW** | P3 |

### 4.6 Privilege Escalation (MVP: Keep It Simple)

**Our Entire Permission System:**
```python
# Two types of users
def is_admin(user):
    return user.email == "admin@jidelnicek.com"

def can_edit(user, resource):
    return resource.user_id == user.id or is_admin(user)

# That's literally it for MVP
```

**Why This Works:**
- No complex roles to bypass
- No permission matrices to confuse
- Admin is hardcoded (change later)
- Users own their data
- Simple = secure

## 5. Practical Security Measures

### 5.1 Phase 1: MVP Security (3-5 days)

#### Day 1: Core Authentication
- **Password Security**
  - Bcrypt hashing (already in FastAPI template)
  - Simple requirements: 12+ characters, mixed case, number
  - Skip for MVP: HaveIBeenPwned API, complex rules
  
- **JWT Tokens**
  - Standard FastAPI JWT implementation
  - 24-hour expiry, 7-day refresh token
  - HTTP-only cookies for web
  - Skip for MVP: Token binding, fingerprinting

#### Day 2: Basic Protection
- **HTTPS Setup**
  - Let's Encrypt with certbot (30 minutes)
  - nginx force redirect (existing config)
  - Skip for MVP: HSTS, certificate pinning

- **Rate Limiting**
  ```nginx
  # /etc/nginx/sites-available/jidelnicek
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
  location /api/auth/login {
      limit_req zone=login burst=5;
  }
  ```
  - 5 login attempts per minute
  - Skip for MVP: Distributed rate limiting, complex patterns

#### Day 3: Input Validation
- **SQL Injection Prevention**
  - SQLAlchemy ORM only (no raw SQL)
  - Pydantic validation (already implemented)
  - Skip for MVP: WAF, query analysis

- **XSS Protection**
  - Basic HTML escaping in Jinja2
  - Content-Type headers
  - Skip for MVP: CSP headers, DOM purification

### 5.2 Phase 2: Post-Launch Enhancements (Optional)

#### Month 1-2: User Feedback Phase
- **Optional 2FA**
  - Only if users request it
  - TOTP with pyotp (no SMS)
  - Simple recovery codes
  - Implementation: 2 days when needed

- **Basic Monitoring**
  - fail2ban for repeat offenders
  - Simple alert on 500 errors
  - Skip: Complex SIEM, ML anomaly detection

#### Month 3: Growth Considerations
- **Enhanced Validation**
  - Stricter input limits based on actual usage
  - File upload scanning (if issues arise)
  - Skip: Enterprise-grade WAF

- **Backup Strategy**
  - Daily database dumps
  - Weekly full VPS snapshots
  - Skip: Real-time replication, hot standby

#### MVP Input Validation (Keep It Simple)

**Day 3 Implementation:**
```python
# Simple Pydantic validation
class RecipeCreate(BaseModel):
    name: constr(min_length=1, max_length=100)
    instructions: constr(max_length=5000)
    prep_time_minutes: conint(ge=0, le=1440)
    servings: conint(ge=1, le=50)
    
    # That's it! Don't over-validate
```

**What We're NOT Doing:**
- Complex regex patterns (users hate them)
- Aggressive HTML stripping (breaks formatting)
- Paranoid length limits (annoys users)
- Real-time validation APIs

**Good Enough Security:**
- Pydantic handles type validation
- SQLAlchemy prevents SQL injection
- Jinja2 auto-escapes HTML
- 99% of security issues prevented

### 5.3 Phase 3: Only If You Scale Beyond 1000 Users

#### Security Features to Defer:
- **Advanced Monitoring**
  - SIEM integration
  - Machine learning anomaly detection
  - Distributed tracing
  - Real-time threat intelligence

- **Complex Infrastructure**
  - API Gateway (nginx works fine)
  - DDoS protection (Cloudflare later)
  - Multi-region failover
  - Hardware security modules

- **Enterprise Features**
  - SOC 2 compliance
  - Bug bounty program
  - Red team exercises
  - 24/7 security monitoring

#### Why These Can Wait:
- 100 users = very small attack surface
- Single VPS = limited complexity
- Free tier services handle basics
- Time better spent on features users want


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

### 5.2 Process Controls (Be Realistic)

#### MVP Security Process:

**Your Actual Security Team:**
- You
- Stack Overflow
- This document

**Your Actual Process:**
1. Write code carefully
2. Use established libraries
3. Update dependencies monthly
4. Google security questions

**Good Security Habits:**
```bash
# Monthly routine (30 minutes)
pip list --outdated        # Check Python packages
npm audit                  # Check JS packages (if any)
apt update && apt upgrade  # Update system

# Quarterly (1 hour)
# Run free security scanner
# Test backup restore
# Review this document
```

**Skip the Enterprise Theater:**
- Formal security reviews (you're reviewing)
- Penetration testing (use free scanners)
- Security training budget ($0)
- Bug bounty program (no budget)
- Incident response team (it's you)

### 5.4 MVP Monitoring (5 Minutes/Week)

#### What You Actually Need:
```bash
# Add to crontab
0 2 * * * pg_dump jidelnicek > /backup/db-$(date +\%Y\%m\%d).sql
0 3 * * * find /backup -name "db-*.sql" -mtime +7 -delete
```

#### Weekly 5-Minute Check:
1. **Is the site up?** Visit it
2. **Any errors?** `grep ERROR /var/log/jidelnicek.log | tail`
3. **Disk space OK?** `df -h`
4. **Backup recent?** `ls -la /backup/`

That's it. Don't overthink monitoring.

#### If Something Breaks:
- Check logs
- Fix it
- Add a check if it might happen again
- Otherwise, don't add complexity

## 6. Pragmatic Implementation Timeline

### Pre-Launch: MVP Security Sprint (3-5 days)

**Day 1: Authentication Basics**
```bash
# Morning (2 hours)
- [ ] Verify bcrypt password hashing works
- [ ] Set password rules: 12+ chars
- [ ] Test JWT token generation

# Afternoon (2 hours)  
- [ ] Add rate limiting to nginx
- [ ] Test with curl loops
- [ ] Document for future
```

**Day 2: Infrastructure Security**
```bash
# Morning (2 hours)
- [ ] Install certbot
- [ ] Get Let's Encrypt cert
- [ ] Configure auto-renewal

# Afternoon (2 hours)
- [ ] Set up daily DB backup cron
- [ ] Test backup restoration
- [ ] Configure fail2ban (optional)
```

**Day 3: Code Security Review**
```bash
# Morning (3 hours)
- [ ] Grep for raw SQL (should find none)
- [ ] Check all user inputs have Pydantic models
- [ ] Verify error messages don't leak info

# Afternoon (1 hour)
- [ ] Run basic security scanner
- [ ] Fix any critical issues
- [ ] Document what we're NOT doing
```

### Post-Launch: Gradual Improvements

**Month 1: See What Breaks**
- Monitor logs for actual attacks
- Note user complaints about security
- Don't add features nobody asked for

**Month 2-3: Address Real Issues**
- If users want 2FA, add it (2 days)
- If spam appears, add captcha (1 day)
- If attacks happen, add monitoring (1 day)

**Month 6: Reassess**
- Still under 1000 users? Keep it simple
- Growing fast? Plan Phase 2 security
- Stagnant? Don't waste time on security theater

### Maintenance Reality Check

**Weekly (5 minutes):**
- Check if site is up
- Glance at error logs
- Ensure backups ran

**Monthly (30 minutes):**
- apt update && apt upgrade
- Check disk space
- Review any security alerts

**Cost**: $0 (just your time)
**ROI**: Users trust your app, you sleep well

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

## 7. MVP Compliance (Minimum Viable Privacy)

### What You Actually Need (3 hours total):

1. **Privacy Policy** (30 minutes)
   - Use a generator like Termly.io (free tier)
   - Modify for meal planning context
   - Link in footer
   - Done!

2. **Basic GDPR** (2 hours)
   ```python
   # Delete account endpoint
   @app.delete("/api/users/me")
   async def delete_account(user = Depends(get_current_user)):
       await db.delete(user)
       return {"message": "Account deleted"}
   
   # Export data (already have PDF export)
   # Cookie banner (one line of JS)
   ```

3. **Terms of Service** (30 minutes)
   - "We're not nutritionists"
   - "Nutritional data is estimates"
   - "Use at your own risk"
   - "Don't upload illegal content"

### What You Don't Need (Save Time):
- Privacy officer designation
- Data protection impact assessments  
- ISO/SOC certifications
- Complex cookie management
- Legal team review
- Breach notification procedures
- Data processor agreements

### Good Enough Privacy:
- Users can delete their account
- Users can export their data
- You tell them what you collect
- You use HTTPS
- That covers 99% of requirements

## 8. MVP Security Checklist

### Must-Have Before Launch (3 days)
- [ ] Passwords: Bcrypt hashing working
- [ ] Passwords: 12+ character minimum
- [ ] HTTPS: Let's Encrypt installed
- [ ] HTTPS: Auto-renewal configured
- [ ] Rate limiting: 5 login attempts/minute
- [ ] Backups: Daily cron job running
- [ ] Errors: No stack traces in production
- [ ] SQL: No raw queries (ORM only)

### Nice-to-Have (Do Later)
- [ ] 2FA: Only if users request it
- [ ] fail2ban: If you see attacks
- [ ] Security headers: If scanner complains
- [ ] Monitoring: If something breaks

### Don't Bother With (MVP)
- [ ] Complex session management
- [ ] API request signing  
- [ ] Certificate pinning
- [ ] Intrusion detection
- [ ] Security audit logs
- [ ] Compliance frameworks

### 5-Minute Weekly Check
- [ ] Site still up?
- [ ] Any 500 errors?
- [ ] Backup ran?
- [ ] Disk space OK?
- If all yes, you're good!

## 9. Conclusion: Security That Makes Sense

### The MVP Security Philosophy

For 100 users on a meal planning app, perfect security is the enemy of good security. We're not storing credit cards, medical records, or state secrets. We're storing recipes and shopping lists.

### What Actually Matters (Do These)

1. **Password Security** (1 hour)
   - Bcrypt hashing (built into FastAPI)
   - 12+ character passwords
   - That's it. No complexity theater.

2. **HTTPS Everywhere** (30 minutes)
   - Let's Encrypt + certbot
   - Auto-renewal cron job
   - Redirect all HTTP to HTTPS

3. **Don't Trust User Input** (Already done)
   - Pydantic models validate types
   - SQLAlchemy prevents SQL injection
   - Jinja2 escapes HTML

4. **Rate Limiting** (30 minutes)
   - nginx config for login endpoint
   - 5 attempts per minute
   - Blocks 99% of brute force

5. **Backups** (1 hour)
   - Daily PostgreSQL dump
   - Copy to different location
   - Test restore monthly

### What Doesn't Matter (Skip These)

1. **Complex 2FA** - Users hate it, add only if requested
2. **Session Fingerprinting** - Overkill for recipes
3. **Advanced Monitoring** - Check logs when something breaks
4. **Security Certifications** - You're not a bank
5. **Threat Intelligence** - You're not a target

### Phases of Security Growth

**Phase 1 (MVP - You Are Here):**
- Basic security: 3-5 days
- Monthly maintenance: 30 minutes
- Cost: $0
- Protection: 95% of common attacks

**Phase 2 (100-1000 users):**
- Add 2FA option
- Better monitoring
- Enhanced validation
- Time: 1 week
- When: Only if needed

**Phase 3 (1000+ users):**
- Consider Cloudflare
- Add security scanning
- Implement audit logs
- Time: 2-4 weeks
- When: You'll know

### The Bottom Line

**Good Enough Security for MVP:**
- Prevents 95% of attacks
- Takes 3-5 days to implement
- Costs nothing
- Doesn't annoy users
- Can be enhanced later

**Remember:** The biggest security risk is not launching because you're perfecting security for threats that will never materialize. Ship it secure enough, improve based on reality.

---

**Document Version**: 3.0 (MVP Reality Edition)
**Updated**: 2025-01-08  
**Approach**: Pragmatic security for rapid deployment
**Philosophy**: Ship secure enough, enhance based on actual needs