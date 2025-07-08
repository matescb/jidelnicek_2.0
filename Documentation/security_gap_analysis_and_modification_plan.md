# Security Gap Analysis: Threat Model vs PRD
## Jídelníček 2.0 Security Enhancement Plan

Generated: 2025-01-08

## Executive Summary

This document provides a comprehensive analysis of security gaps between the Security Threat Model (42 identified threats) and the current PRD implementation. The analysis reveals significant gaps in several critical areas that require immediate attention before production deployment.

### Key Findings
- **Coverage**: Only 26 of 42 threats (62%) are adequately addressed in the PRD
- **Critical Gaps**: 5 CRITICAL and 7 HIGH priority threats lack proper mitigation
- **STRIDE Coverage**: Tampering (60%) and Repudiation (20%) have the weakest coverage
- **Missing Controls**: Input validation, authorization matrix, and security monitoring need enhancement

## 1. Threat Coverage Analysis

### 1.1 STRIDE Methodology Coverage

| Category | Threats Identified | Addressed in PRD | Coverage % | Priority Gaps |
|----------|-------------------|------------------|------------|---------------|
| Spoofing | 6 | 4 | 67% | OAuth token theft (HIGH), API key exposure (HIGH) |
| Tampering | 7 | 4 | 57% | SQL injection details (CRITICAL), XSS prevention (HIGH) |
| Repudiation | 5 | 1 | 20% | Audit logging (MEDIUM), Transaction tracking (MEDIUM) |
| Information Disclosure | 8 | 5 | 63% | IDOR protection (CRITICAL), API over-sharing (HIGH) |
| Denial of Service | 6 | 4 | 67% | Rate limit bypass (CRITICAL), Storage exhaustion (HIGH) |
| Elevation of Privilege | 6 | 3 | 50% | Role bypass (CRITICAL), Admin access (CRITICAL) |
| **TOTAL** | **42** | **26** | **62%** | **16 gaps identified** |

### 1.2 Critical Threat Gaps (Priority P0)

#### 1. Account Takeover via Credential Stuffing
- **Current PRD**: Basic password requirements, account lockout
- **Missing**: 
  - Breach monitoring integration
  - Device fingerprinting beyond IP/User-Agent
  - Anomaly detection for login patterns
  - Password history enforcement

#### 2. SQL Injection Protection
- **Current PRD**: "SQLAlchemy ORM with parameterized queries"
- **Missing**:
  - Explicit validation patterns for all input types
  - Query logging and monitoring
  - Static analysis tool integration
  - Custom query audit procedures

#### 3. IDOR - Private Recipes
- **Current PRD**: UUID usage mentioned
- **Missing**:
  - Explicit authorization checks on all endpoints
  - Object-level permission validation
  - Access control matrix implementation
  - Request context validation

#### 4. API Rate Limit Bypass
- **Current PRD**: Basic rate limiting mentioned
- **Missing**:
  - Distributed request handling
  - User+IP combination tracking
  - Sliding window implementation
  - CAPTCHA integration

#### 5. Role Bypass & Admin Function Access
- **Current PRD**: Two-tier role system
- **Missing**:
  - Granular permission system
  - Role validation on every request
  - Admin action audit trail
  - Privilege escalation detection

## 2. Missing Security Controls

### 2.1 Input Validation Gaps

#### Current State
The PRD mentions validation but lacks comprehensive coverage:
```python
# PRD shows basic validation
RECIPE_NAME_PATTERN = r"^[\w\s\.\,'\-\(\)]{1,100}$"
```

#### Required Enhancements
```python
class ComprehensiveInputValidation:
    # ALL user inputs need validation
    PATTERNS = {
        'recipe_name': r'^[\w\s\.\,'\-\(\)]{1,100}$',
        'ingredient_name': r'^[\w\s\-\.]{1,100}$',
        'instructions': {
            'max_length': 2000,
            'allowed_tags': ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
            'strip_scripts': True,
            'encode_entities': True
        },
        'numeric_values': {
            'calories': (0, 9999.99),
            'prep_time': (0, 1440),
            'servings': (1, 100),
            'coefficient': (0.1, 3.0),
            'water_ml': (0, 10000)
        }
    }
    
    # Context-aware validation
    def validate_ingredient_quantity(self, value, ingredient_type):
        """Different validation based on ingredient category"""
        if ingredient_type == 'spice':
            return 0.01 <= value <= 50  # Spices in smaller quantities
        elif ingredient_type == 'bulk':
            return 1 <= value <= 5000   # Bulk items in larger quantities
            
    # SQL injection prevention
    def sanitize_search_query(self, query):
        """Remove SQL metacharacters while preserving search functionality"""
        # Remove SQL keywords
        sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 
                       'UNION', 'WHERE', 'OR', 'AND', '--', '/*', '*/']
        for keyword in sql_keywords:
            query = query.replace(keyword, '')
        
        # Escape special characters
        query = query.replace("'", "''")
        query = query.replace('"', '""')
        query = query.replace('\\', '\\\\')
        
        return query[:100]  # Limit length
```

### 2.2 Authorization Matrix Implementation

#### Current State
PRD shows basic two-tier system (user/admin) but lacks granular controls.

#### Required Enhancement
```python
from enum import Enum
from typing import Set, Dict

class Permission(Enum):
    # Recipe permissions
    RECIPE_CREATE = "recipe:create"
    RECIPE_READ_OWN = "recipe:read:own"
    RECIPE_READ_PUBLIC = "recipe:read:public" 
    RECIPE_READ_ANY = "recipe:read:any"  # Admin only
    RECIPE_UPDATE_OWN = "recipe:update:own"
    RECIPE_DELETE_OWN = "recipe:delete:own"
    RECIPE_DELETE_ANY = "recipe:delete:any"  # Admin only
    RECIPE_PUBLISH = "recipe:publish"
    RECIPE_UNPUBLISH = "recipe:unpublish"
    
    # Trip permissions
    TRIP_CREATE = "trip:create"
    TRIP_READ_OWN = "trip:read:own"
    TRIP_READ_ANY = "trip:read:any"  # Admin only
    TRIP_UPDATE_OWN = "trip:update:own"
    TRIP_DELETE_OWN = "trip:delete:own"
    TRIP_SHARE = "trip:share"
    
    # Marketplace permissions
    MARKETPLACE_RATE = "marketplace:rate"
    MARKETPLACE_REVIEW = "marketplace:review"
    MARKETPLACE_MODERATE = "marketplace:moderate"  # Admin only
    
    # User management
    USER_READ_SELF = "user:read:self"
    USER_UPDATE_SELF = "user:update:self"
    USER_DELETE_SELF = "user:delete:self"
    USER_READ_ANY = "user:read:any"  # Admin only
    USER_UPDATE_ANY = "user:update:any"  # Admin only
    USER_DELETE_ANY = "user:delete:any"  # Admin only
    
    # System permissions
    SYSTEM_STATS = "system:stats"  # Admin only
    SYSTEM_LOGS = "system:logs"  # Admin only
    INGREDIENT_GLOBAL_EDIT = "ingredient:global:edit"  # Admin only

# Role definitions with explicit permissions
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    "user": {
        Permission.RECIPE_CREATE,
        Permission.RECIPE_READ_OWN,
        Permission.RECIPE_READ_PUBLIC,
        Permission.RECIPE_UPDATE_OWN,
        Permission.RECIPE_DELETE_OWN,
        Permission.RECIPE_PUBLISH,
        Permission.RECIPE_UNPUBLISH,
        Permission.TRIP_CREATE,
        Permission.TRIP_READ_OWN,
        Permission.TRIP_UPDATE_OWN,
        Permission.TRIP_DELETE_OWN,
        Permission.TRIP_SHARE,
        Permission.MARKETPLACE_RATE,
        Permission.MARKETPLACE_REVIEW,
        Permission.USER_READ_SELF,
        Permission.USER_UPDATE_SELF,
        Permission.USER_DELETE_SELF,
    },
    "admin": {
        # All user permissions plus admin-specific
        *ROLE_PERMISSIONS["user"],
        Permission.RECIPE_READ_ANY,
        Permission.RECIPE_DELETE_ANY,
        Permission.TRIP_READ_ANY,
        Permission.MARKETPLACE_MODERATE,
        Permission.USER_READ_ANY,
        Permission.USER_UPDATE_ANY,
        Permission.USER_DELETE_ANY,
        Permission.SYSTEM_STATS,
        Permission.SYSTEM_LOGS,
        Permission.INGREDIENT_GLOBAL_EDIT,
    }
}

# Object-level permission checks
class AuthorizationService:
    def can_access_recipe(self, user_id: str, recipe_id: str, action: Permission) -> bool:
        """Check if user can perform action on specific recipe"""
        recipe = get_recipe(recipe_id)
        
        if action == Permission.RECIPE_READ_OWN:
            return recipe.owner_id == user_id
        elif action == Permission.RECIPE_READ_PUBLIC:
            return recipe.is_public
        elif action == Permission.RECIPE_UPDATE_OWN:
            return recipe.owner_id == user_id
        # ... etc
        
    def check_permission(self, user, permission: Permission, resource=None):
        """Centralized permission checking"""
        if permission not in ROLE_PERMISSIONS[user.role]:
            raise PermissionDenied(f"User lacks permission: {permission.value}")
            
        # Additional object-level checks if resource provided
        if resource:
            if not self._check_resource_access(user, permission, resource):
                raise PermissionDenied(f"Access denied to resource: {resource.id}")
```

### 2.3 XSS Prevention Enhancement

#### Current State
PRD mentions "Content sanitization" but lacks comprehensive implementation.

#### Required Enhancement
```python
import bleach
from markupsafe import Markup, escape

class XSSPrevention:
    # Strict whitelist for user content
    ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']
    ALLOWED_ATTRIBUTES = {}  # No attributes allowed by default
    
    @staticmethod
    def sanitize_user_content(content: str) -> str:
        """Sanitize any user-provided content"""
        if not content:
            return ""
            
        # First escape everything
        content = escape(content)
        
        # Then allow specific tags
        cleaned = bleach.clean(
            content,
            tags=XSSPrevention.ALLOWED_TAGS,
            attributes=XSSPrevention.ALLOWED_ATTRIBUTES,
            strip=True,
            strip_comments=True
        )
        
        # Additional protections
        # Remove any javascript: URLs
        cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
        # Remove any on* event handlers that might have slipped through
        cleaned = re.sub(r'on\w+\s*=', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize uploaded filenames"""
        # Remove path traversal attempts
        filename = os.path.basename(filename)
        # Remove special characters
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        # Limit length
        name, ext = os.path.splitext(filename)
        return f"{name[:50]}{ext}"
    
    @staticmethod
    def set_security_headers(response):
        """Set security headers to prevent XSS"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Tighten in production
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        return response
```

### 2.4 File Upload Security Enhancement

#### Current State
PRD mentions basic validation but lacks comprehensive security.

#### Required Enhancement
```python
import magic
import hashlib
from PIL import Image
import io

class SecureFileUpload:
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
    
    @staticmethod
    def validate_and_process_image(file_content: bytes, filename: str):
        """Comprehensive image validation and processing"""
        errors = []
        
        # 1. Size check
        if len(file_content) > SecureFileUpload.MAX_FILE_SIZE:
            errors.append("File size exceeds 5MB limit")
            
        # 2. MIME type check using python-magic
        mime = magic.from_buffer(file_content, mime=True)
        if mime not in SecureFileUpload.ALLOWED_MIME_TYPES:
            errors.append(f"Invalid file type: {mime}")
            
        # 3. Extension check
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SecureFileUpload.ALLOWED_EXTENSIONS:
            errors.append(f"Invalid file extension: {ext}")
            
        # 4. Verify it's actually an image using PIL
        try:
            img = Image.open(io.BytesIO(file_content))
            img.verify()  # Verify it's a valid image
            
            # Reopen for processing (verify closes the file)
            img = Image.open(io.BytesIO(file_content))
            
            # 5. Check dimensions
            if img.width > 4096 or img.height > 4096:
                errors.append("Image dimensions exceed 4096x4096")
                
            if img.width < 100 or img.height < 100:
                errors.append("Image too small (minimum 100x100)")
                
        except Exception as e:
            errors.append(f"Invalid image file: {str(e)}")
            
        if errors:
            raise ValidationError(errors)
            
        # 6. Process the image
        processed_img = SecureFileUpload._process_image(img)
        
        # 7. Generate secure filename
        secure_filename = SecureFileUpload._generate_secure_filename(ext)
        
        return processed_img, secure_filename
    
    @staticmethod
    def _process_image(img: Image):
        """Process image for security and optimization"""
        # Strip EXIF data
        data = list(img.getdata())
        image_without_exif = Image.new(img.mode, img.size)
        image_without_exif.putdata(data)
        
        # Resize if needed
        if img.width > 2048 or img.height > 2048:
            image_without_exif.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            
        # Convert to RGB if necessary (removes alpha channel)
        if image_without_exif.mode != 'RGB':
            rgb_image = Image.new('RGB', image_without_exif.size, (255, 255, 255))
            rgb_image.paste(image_without_exif, mask=image_without_exif.split()[-1] if 'transparency' in image_without_exif.info else None)
            image_without_exif = rgb_image
            
        # Save to bytes
        output = io.BytesIO()
        image_without_exif.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()
    
    @staticmethod
    def _generate_secure_filename(extension: str) -> str:
        """Generate a secure, unique filename"""
        # Use timestamp + random for uniqueness
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        random_str = secrets.token_hex(8)
        return f"{timestamp}_{random_str}{extension}"
```

### 2.5 Audit Logging Implementation

#### Current State
PRD mentions logging but lacks comprehensive audit trail.

#### Required Enhancement
```python
import json
from datetime import datetime
from enum import Enum

class AuditEventType(Enum):
    # Authentication events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILURE = "auth.login.failure"
    LOGOUT = "auth.logout"
    PASSWORD_RESET_REQUEST = "auth.password.reset.request"
    PASSWORD_RESET_COMPLETE = "auth.password.reset.complete"
    ACCOUNT_LOCKED = "auth.account.locked"
    ACCOUNT_UNLOCKED = "auth.account.unlocked"
    
    # Data access events
    RECIPE_CREATED = "recipe.created"
    RECIPE_UPDATED = "recipe.updated"
    RECIPE_DELETED = "recipe.deleted"
    RECIPE_PUBLISHED = "recipe.published"
    RECIPE_UNPUBLISHED = "recipe.unpublished"
    RECIPE_EXPORTED = "recipe.exported"
    
    TRIP_CREATED = "trip.created"
    TRIP_UPDATED = "trip.updated"
    TRIP_DELETED = "trip.deleted"
    TRIP_SHARED = "trip.shared"
    TRIP_EXPORTED = "trip.exported"
    
    # Admin events
    USER_SUSPENDED = "admin.user.suspended"
    USER_DELETED = "admin.user.deleted"
    CONTENT_MODERATED = "admin.content.moderated"
    GLOBAL_INGREDIENT_MODIFIED = "admin.ingredient.modified"
    
    # Security events
    PERMISSION_DENIED = "security.permission.denied"
    RATE_LIMIT_EXCEEDED = "security.rate.limit.exceeded"
    SUSPICIOUS_ACTIVITY = "security.suspicious.activity"
    DATA_EXPORT_LARGE = "security.data.export.large"

class AuditLogger:
    def __init__(self, storage_backend):
        self.storage = storage_backend
        
    def log_event(self, 
                  event_type: AuditEventType,
                  user_id: str,
                  resource_type: str = None,
                  resource_id: str = None,
                  details: dict = None,
                  ip_address: str = None,
                  user_agent: str = None):
        """Log an audit event with all relevant context"""
        
        audit_entry = {
            'event_id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type.value,
            'user_id': user_id,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'details': details or {},
            'ip_address': self._hash_ip(ip_address) if ip_address else None,
            'user_agent': user_agent,
            'session_id': self._get_current_session_id()
        }
        
        # Add severity level
        audit_entry['severity'] = self._determine_severity(event_type)
        
        # Sign the entry to prevent tampering
        audit_entry['signature'] = self._sign_entry(audit_entry)
        
        # Store the entry
        self.storage.store(audit_entry)
        
        # Alert on high severity events
        if audit_entry['severity'] in ['HIGH', 'CRITICAL']:
            self._send_alert(audit_entry)
    
    def _hash_ip(self, ip: str) -> str:
        """Hash IP for privacy while maintaining consistency for analysis"""
        return hashlib.sha256(f"{ip}{self._get_daily_salt()}".encode()).hexdigest()[:16]
    
    def _determine_severity(self, event_type: AuditEventType) -> str:
        """Determine event severity for alerting"""
        critical_events = [
            AuditEventType.USER_DELETED,
            AuditEventType.GLOBAL_INGREDIENT_MODIFIED,
            AuditEventType.SUSPICIOUS_ACTIVITY
        ]
        
        high_events = [
            AuditEventType.ACCOUNT_LOCKED,
            AuditEventType.PERMISSION_DENIED,
            AuditEventType.RATE_LIMIT_EXCEEDED,
            AuditEventType.DATA_EXPORT_LARGE
        ]
        
        if event_type in critical_events:
            return 'CRITICAL'
        elif event_type in high_events:
            return 'HIGH'
        elif 'failure' in event_type.value:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _sign_entry(self, entry: dict) -> str:
        """Create tamper-proof signature for audit entry"""
        # Remove signature field for signing
        entry_copy = {k: v for k, v in entry.items() if k != 'signature'}
        entry_json = json.dumps(entry_copy, sort_keys=True)
        return hashlib.sha256(f"{entry_json}{self._get_secret_key()}".encode()).hexdigest()

# Audit log retention policy
class AuditRetentionPolicy:
    RETENTION_DAYS = {
        'CRITICAL': 365,  # 1 year
        'HIGH': 180,      # 6 months
        'MEDIUM': 90,     # 3 months
        'LOW': 30         # 1 month
    }
```

### 2.6 Security Monitoring Enhancement

#### Current State
PRD mentions monitoring but lacks threat detection specifics.

#### Required Enhancement
```python
class SecurityMonitor:
    def __init__(self, audit_logger, alert_service):
        self.audit_logger = audit_logger
        self.alert_service = alert_service
        self.thresholds = self._load_thresholds()
        
    def _load_thresholds(self):
        return {
            'failed_logins_per_hour': 10,
            'account_lockouts_per_hour': 5,
            'permission_denials_per_hour': 20,
            'large_exports_per_day': 3,
            'new_country_login': True,
            'suspicious_user_agent': True,
            'api_abuse_threshold': 1000  # requests per hour
        }
    
    async def analyze_security_events(self):
        """Periodic security event analysis"""
        # Check failed login patterns
        failed_logins = await self._get_failed_logins_last_hour()
        if len(failed_logins) > self.thresholds['failed_logins_per_hour']:
            await self._alert_brute_force_attempt(failed_logins)
            
        # Check for credential stuffing
        unique_emails = set(login['email'] for login in failed_logins)
        if len(unique_emails) > 20:  # Many different emails = credential stuffing
            await self._alert_credential_stuffing()
            
        # Check permission denials
        permission_denials = await self._get_permission_denials_last_hour()
        if len(permission_denials) > self.thresholds['permission_denials_per_hour']:
            await self._alert_privilege_escalation_attempt(permission_denials)
            
        # Check for data exfiltration
        large_exports = await self._get_large_exports_last_day()
        if len(large_exports) > self.thresholds['large_exports_per_day']:
            await self._alert_potential_data_exfiltration(large_exports)
    
    async def check_login_anomalies(self, user_id: str, ip: str, user_agent: str, country: str):
        """Real-time login anomaly detection"""
        user_history = await self._get_user_login_history(user_id)
        
        anomalies = []
        
        # New country detection
        if country not in user_history['countries'] and self.thresholds['new_country_login']:
            anomalies.append({
                'type': 'new_country',
                'severity': 'MEDIUM',
                'details': f'Login from new country: {country}'
            })
            
        # Suspicious user agent
        if self._is_suspicious_user_agent(user_agent):
            anomalies.append({
                'type': 'suspicious_agent',
                'severity': 'HIGH',
                'details': f'Suspicious user agent: {user_agent}'
            })
            
        # Impossible travel
        last_login = user_history.get('last_login')
        if last_login:
            travel_time = self._calculate_travel_time(
                last_login['country'], 
                country,
                last_login['timestamp'],
                datetime.utcnow()
            )
            if travel_time and travel_time < 0:  # Impossible travel
                anomalies.append({
                    'type': 'impossible_travel',
                    'severity': 'HIGH',
                    'details': f'Impossible travel from {last_login["country"]} to {country}'
                })
        
        return anomalies
    
    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check for suspicious user agents"""
        suspicious_patterns = [
            'sqlmap',
            'nikto',
            'nmap',
            'masscan',
            'curl',
            'wget',
            'python-requests',
            'scrapy'
        ]
        
        user_agent_lower = user_agent.lower()
        return any(pattern in user_agent_lower for pattern in suspicious_patterns)
```

## 3. Implementation Priorities

### 3.1 Phase 0: Immediate Security Fixes (Week 1)
1. **Input Validation Framework**
   - Implement comprehensive validation for all user inputs
   - Add SQL injection prevention patterns
   - Deploy XSS sanitization library
   
2. **Authorization Matrix**
   - Implement granular permission system
   - Add object-level security checks
   - Deploy permission validation middleware

3. **Basic Security Headers**
   - Implement CSP, HSTS, X-Frame-Options
   - Add security.txt file
   - Configure CORS properly

### 3.2 Phase 1: Core Security (Week 2-3)
1. **Audit Logging System**
   - Implement comprehensive audit logger
   - Deploy tamper-proof storage
   - Set up retention policies
   
2. **File Upload Security**
   - Implement magic byte verification
   - Add image processing pipeline
   - Deploy secure storage system
   
3. **Rate Limiting Enhancement**
   - Implement sliding window rate limiting
   - Add distributed request tracking
   - Deploy CAPTCHA for repeated failures

### 3.3 Phase 2: Advanced Security (Week 4)
1. **Security Monitoring**
   - Deploy anomaly detection system
   - Implement alert thresholds
   - Set up security dashboard
   
2. **Encryption Enhancement**
   - Implement field-level encryption for PII
   - Deploy key rotation system
   - Add encryption key management
   
3. **Advanced Authentication**
   - Implement device fingerprinting
   - Add breach monitoring integration
   - Deploy 2FA for all users

## 4. Security Configuration Updates

### 4.1 Environment Variables
```bash
# Security-specific environment variables
ENCRYPTION_KEY=<32-byte-key>
SIGNING_KEY=<32-byte-key>
AUDIT_STORAGE_KEY=<32-byte-key>
RATE_LIMIT_REDIS_URL=redis://localhost:6379/1
SECURITY_ALERT_WEBHOOK=https://alerts.example.com/webhook
BREACH_API_KEY=<haveibeenpwned-api-key>
```

### 4.2 Security Middleware Configuration
```python
# security_config.py
SECURITY_CONFIG = {
    'password': {
        'min_length': 12,
        'max_length': 128,
        'require_uppercase': True,
        'require_lowercase': True,
        'require_numbers': True,
        'require_special': True,
        'check_common_passwords': True,
        'password_history': 5
    },
    'session': {
        'timeout_minutes': 1440,  # 24 hours
        'max_concurrent': 5,
        'fingerprint_required': True,
        'secure_cookie': True,
        'samesite': 'Strict'
    },
    'rate_limiting': {
        'login': {'requests': 5, 'window': 900},  # 5 per 15 min
        'api': {'requests': 1000, 'window': 3600},  # 1000 per hour
        'export': {'requests': 20, 'window': 3600},  # 20 per hour
        'upload': {'requests': 10, 'window': 3600}   # 10 per hour
    },
    'file_upload': {
        'max_size_mb': 5,
        'allowed_types': ['image/jpeg', 'image/png', 'image/webp'],
        'scan_for_malware': True,
        'strip_metadata': True
    }
}
```

## 5. Testing Requirements

### 5.1 Security Test Suite
```python
# test_security.py
class SecurityTestSuite:
    """Comprehensive security testing"""
    
    def test_sql_injection_prevention(self):
        """Test all endpoints for SQL injection"""
        payloads = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'--",
            "1; INSERT INTO users VALUES ('hacker', 'password')"
        ]
        # Test each endpoint with each payload
        
    def test_xss_prevention(self):
        """Test all user input fields for XSS"""
        payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>"
        ]
        # Test each input field with each payload
        
    def test_authorization_bypass(self):
        """Test for authorization vulnerabilities"""
        # Test accessing other users' resources
        # Test privilege escalation
        # Test direct object references
        
    def test_rate_limiting(self):
        """Test rate limiting effectiveness"""
        # Test each rate-limited endpoint
        # Verify limits are enforced
        # Test distributed requests
```

## 6. Documentation Updates

### 6.1 Security Documentation
1. Update API documentation with security requirements
2. Create security guidelines for developers
3. Document incident response procedures
4. Create security checklist for deployments

### 6.2 User-Facing Documentation
1. Password requirements and best practices
2. Privacy policy updates
3. Security features explanation
4. Data handling transparency

## 7. Compliance Considerations

### 7.1 GDPR Compliance Gaps
- Need explicit consent mechanisms
- Implement right to erasure fully
- Add data portability features
- Create data processing register

### 7.2 Security Standards
- Align with OWASP Top 10 (2024)
- Implement CIS Critical Security Controls
- Follow NIST Cybersecurity Framework
- Consider ISO 27001 principles

## 8. Monitoring and Metrics

### 8.1 Security KPIs
- Failed login attempts per hour
- Account lockouts per day
- Permission denials per hour
- Suspicious activity alerts per day
- Time to detect security incidents
- Time to respond to incidents

### 8.2 Security Dashboard
```python
# Dashboard metrics to track
SECURITY_METRICS = {
    'authentication': [
        'failed_logins',
        'successful_logins', 
        'account_lockouts',
        'password_resets',
        '2fa_adoptions'
    ],
    'authorization': [
        'permission_denials',
        'role_changes',
        'admin_actions'
    ],
    'data_security': [
        'large_exports',
        'file_uploads',
        'api_calls',
        'rate_limit_hits'
    ],
    'incidents': [
        'security_alerts',
        'incident_responses',
        'false_positives'
    ]
}
```

## 9. Conclusion

The security gap analysis reveals significant areas requiring immediate attention. While the PRD provides a good foundation, the implementation must be enhanced with:

1. **Comprehensive input validation** across all user inputs
2. **Granular authorization system** with object-level security
3. **Complete audit logging** with tamper protection
4. **Advanced threat detection** and monitoring
5. **Proper security headers** and configurations

The estimated effort for full security implementation is 4 weeks with a dedicated security focus. This investment is critical for protecting user data and maintaining system integrity.

## Appendix: Security Checklist

### Pre-Deployment Security Checklist
- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention tested
- [ ] XSS prevention implemented and tested
- [ ] CSRF protection enabled
- [ ] Rate limiting configured and tested
- [ ] File upload security implemented
- [ ] Authorization checks on all endpoints
- [ ] Audit logging enabled
- [ ] Security headers configured
- [ ] HTTPS enforced everywhere
- [ ] Sensitive data encrypted at rest
- [ ] Session security implemented
- [ ] Password policy enforced
- [ ] 2FA available (optional for users)
- [ ] Security monitoring active
- [ ] Incident response plan documented
- [ ] Backup and recovery tested
- [ ] Dependency vulnerabilities scanned
- [ ] Security documentation complete
- [ ] Penetration testing performed