# Jídelníček - Product Requirements Document (PRD)

## 1. Executive Summary

Jídelníček is a specialized web application designed for outdoor enthusiasts and expedition leaders to plan, organize, and manage meals for multi-day trips. The application focuses on precise nutritional planning, ingredient management, weight tracking, and generating practical packing/shopping lists with comprehensive tracking of all nutrients and fuel requirements.

### Key Value Propositions
- **Precision Planning**: Automatically calculate ingredient quantities to meet specific calorie targets per person
- **Comprehensive Nutrition Tracking**: Monitor all macronutrients, micronutrients, and vitamins
- **Efficient Expedition Management**: Support for groups up to 20 participants with individual coefficients
- **Recipe Marketplace**: Share and discover recipes within the community
- **Practical Outputs**: Generate shopping lists, packing lists, and fuel calculations

### Target Release: MVP
- **Timeline**: TBD
- **Platform**: Web Application
- **Languages**: English and Czech

## 2. Product Overview

### 2.1 Objectives
1. **Primary Objective**: Enable precise meal planning for outdoor expeditions with automatic ingredient scaling to meet calorie targets
2. **Secondary Objectives**:
   - Build a community-driven recipe marketplace
   - Reduce food waste through accurate portioning
   - Ensure nutritional requirements are met for all participants
   - Simplify logistics for expedition leaders

### 2.2 Success Metrics
- **User Acquisition**: 100 active users
- **User Engagement**: Average of 3 trips planned per user per year
- **Recipe Marketplace**: 100+ public recipes
- **User Satisfaction**: NPS score > 50
- **System Performance**: Page load times < 3 seconds on VPS
- **Data Accuracy**: 99.9% calculation accuracy for nutritional values

### 2.3 Target Audience
- **Primary**: Long-distance hikers, runners, and hiking enthusiasts
- **Secondary**: Leaders of youth scout expeditions (5-20 participants, multi-week trips)

## 3. Functional Requirements

### 3.1 User Management

#### 3.1.1 Account Creation and Authentication
- **Requirement**: Secure user authentication system [US-1]
- **Details**:
  - Email/password with 12+ character requirement
  - OAuth2 social login
  - **[Phase 1.1 - Post-MVP]** Two-factor authentication (TOTP-based)
  - **[Phase 1.1 - Post-MVP]** Recovery codes for 2FA
  - Session management with JWT
  - Password reset via email
  - Email verification required
  - Account lockout after 5 failed login attempts

#### 3.1.2 User Roles and Permissions
- **Requirement**: Two-tier role system [US-1]
- **Details**:
  - Regular users: Limited to own content
  - Admins: Full system access
  - Role assignment managed by admins only

#### 3.1.3 User Preferences
- **Requirement**: Customizable display preferences [US-1]
- **Details**:
  - Unit system: Metric/Imperial (stored internally as metric)
  - Energy display: kcal/kJ (stored in single format)
  - Language: English/Czech
  - Preferences persist across sessions

### 3.2 Recipe Management

#### 3.2.1 Recipe Creation
- **Requirement**: Comprehensive recipe builder with nutritional calculation [US-2]
- **Details**:
  - All quantities in grams
  - Automatic nutritional calculation from ingredients
  - Water requirements (cooking only)
  - Cooking time tracking (stove time)
  - Preparation instructions (2000 char limit)
  - Image upload (5MB max, 10 images per recipe)
  - Recipe limit: 500 per user

#### 3.2.2 Recipe Versioning
- **Requirement**: Track recipe changes with version history [US-2, US-11]
- **Details**:
  - Retain last 10 versions
  - New version triggers:
    - Nutritional content change >1%
    - Ingredient addition/removal
  - Minor text edits update current version
  - Version restoration capability

#### 3.2.3 Recipe Marketplace
- **Requirement**: Public recipe sharing platform [US-9, US-10]
- **Details**:
  - Explicit publishing by users
  - Auto-approval system
  - Display metrics:
    - Full nutritional info
    - Marketplace Rating (public average, 1-5 stars)
    - Number of marketplace reviews
    - Marketplace reviews (text up to 1000 chars)
    - Author attribution
    - Replication count
    - Fork indicators with links
  - Fork functionality for editing
  - Marketplace ratings and reviews:
    - Users can only rate/review recipes they've forked
    - One marketplace review per user per recipe
    - Ratings are public and affect recipe ranking
    - Reviews are public and visible to all users
  - Cannot unpublish if forked >5 times
  - Share links:
    - Generate temporary share links for private recipes
    - Default expiration: 30 days
    - Configurable expiration: 1-365 days
    - Expired links show "This link has expired" message
    - Users can regenerate expired links
    - Automatic cleanup removes expired links after 30 days

#### 3.2.4 Recipe Unpublishing Policy
- **Requirement**: Controlled unpublishing to balance author rights and community stability [US-9]
- **Details**:
  - Authors can unpublish anytime if fork count ≤ 5
  - Cannot unpublish if fork count > 5 (recipe too popular)
  - Unpublished recipes become private (not deleted)
  - Existing forks remain unaffected and fully functional
  - 30-day grace period before full removal from system
  - Warning displayed if recipe is used in active trips:
    - "This recipe is used in X active trips. Unpublishing will not affect existing trips."
  - Unpublish confirmation dialog shows:
    - Current fork count
    - Number of active trips using recipe
    - Warning about 30-day grace period
  - After unpublishing:
    - Recipe removed from marketplace search/browse
    - Direct links return "Recipe no longer available"
    - Author retains full access to recipe
    - Recipe can be republished at any time

#### 3.2.5 Recipe Search Features
- **Full-text search**: Name, description, instructions, tags
- **Filters**: Category, dietary preferences, calorie range, time
- **Sorting**: Relevance, rating, newest, most forked
- **Autocomplete**: Ingredient and recipe name suggestions
- **Search history**: Last 10 searches saved per user

### 3.3 Trip Planning

#### 3.3.1 Trip Creation
- **Requirement**: Multi-day expedition planning system [US-3]
- **Details**:
  - Trip capacity: Up to 20 participants
  - No duration limit
  - Customizable meal slots (default: Breakfast, Lunch, Dinner)
  - Recipe storage options:
    - Snapshot (default)
    - Track live changes
  - Participant coefficients (default 100%)
  - Trip limit: 100 active trips per user

#### 3.3.2 Meal Management
- **Requirement**: Flexible meal assignment with automatic scaling [US-3, US-5, US-12]
- **Details**:
  - One recipe per meal slot
  - Automatic ingredient scaling to meet calorie targets
  - Empty slots allowed
  - Unlimited snacks (separate from ingredients)
  - Drinks category with water requirements
  - Coefficients apply globally (not to snacks/drinks)

#### 3.3.3 Day Management
- **Requirement**: Dynamic day organization [US-3]
- **Details**:
  - Add/remove days
  - Drag-and-drop reordering
  - All data moves with day
  - Same meal structure across all days

### 3.4 Ingredient and Snack Management

#### 3.4.1 Ingredient Database
- **Requirement**: Dual database system [US-13]
- **Details**:
  - Fixed global common ingredients
  - Personal ingredient database
  - All measurements in grams
  - Required: calories and macros
  - Optional: micronutrients, vitamins
  - Categories for shopping list grouping
  - 50 ingredients max per recipe

#### 3.4.2 Snack Management
- **Requirement**: Separate snack tracking system [US-16]
- **Details**:
  - Measurement by piece or per 100g
  - Cannot be used as recipe ingredients
  - Manual quantity adjustment for groups
  - Display per person and total columns
  - Full nutritional tracking

### 3.5 Nutritional Tracking

#### 3.5.1 Comprehensive Nutrient Monitoring
- **Requirement**: Track all macro and micronutrients [US-4, US-19]
- **Details**:
  - Macronutrients:
    - Proteins
    - Carbohydrates (with sugars)
    - Fats (detailed breakdown)
  - Micronutrients:
    - Fiber, salt, calcium, sodium, water
    - PHE (for PKU users)
    - All vitamins
  - Display precision:
    - Calories: whole numbers
    - Macros: 0.1g
    - Vitamins/minerals: 0.01mg or µg
    - Values <0.01 show as '<0.01'

#### 3.5.2 Nutritional Summaries
- **Requirement**: Multi-level nutritional views [US-4]
- **Details**:
  - Per meal breakdown
  - Daily summaries
  - Total trip overview
  - Dynamic updates with changes
  - Export capability

### 3.6 Fuel and Equipment Management

#### 3.6.1 Stove Configuration
- **Requirement**: Single stove per trip with efficiency tracking [US-18]
- **Details**:
  - Efficiency rating (g fuel/L water)
  - Reference values provided
  - User-specified stove data

#### 3.6.2 Fuel Calculation
- **Requirement**: Automatic fuel requirement calculation [US-18]
- **Details**:
  - Based on:
    - Total cooking time
    - Water heating needs
    - Stove efficiency
  - Default assumptions:
    - 20°C starting temperature
    - Sea level conditions
    - 5 min/L boiling time
  - Altitude adjustment (+10% per 1000m)
  - No automatic safety margin

### 3.7 Export and Reporting

#### 3.7.1 Shopping Lists
- **Requirement**: Consolidated ingredient lists [US-7]
- **Details**:
  - Grouped by category
  - Total quantities only
  - Reflects all adjustments
  - Export formats: PDF, Excel, TXT

#### 3.7.2 Packing Lists
- **Requirement**: Detailed packing documentation [US-8]
- **Details**:
  - Total trip list
  - Day-by-day breakdown
  - Exact quantities per meal
  - Weight information
  - Export formats: PDF, Excel, TXT

#### 3.7.3 Trip Summaries
- **Requirement**: Comprehensive trip documentation [US-17]
- **Details**:
  - All meals, snacks, drinks
  - Complete nutritional data
  - Fuel requirements
  - Water requirements (cooking)
  - Food weight analysis
  - Customizable sections
  - Export formats: PDF, Excel, TXT

### 3.8 Templates and Sharing

#### 3.8.1 Trip Templates
- **Requirement**: Reusable trip structures [US-15]
- **Details**:
  - Save days or entire trips
  - Store meal configurations
  - Recipe references (use current versions)
  - Exclude dates and participant specifics
  - No individual meal templates

#### 3.8.2 Trip Sharing
- **Requirement**: Share complete trip plans [US-21]
- **Details**:
  - Shareable links with expiration
  - Share link policy:
    - Default expiration: 30 days
    - Configurable: 1-365 days
    - Expired links show error message
    - Regeneration available for expired links
    - Both recipe and trip links follow same policy
  - View without account
  - Fork to edit (requires account)
  - No live collaboration
  - Preview shows participant count and duration

### 3.8 Rating Systems

The application implements two distinct rating systems to serve different purposes:

#### 3.8.1 Personal Meal Ratings
- **Purpose**: Track personal meal experiences and preferences
- **Scope**: Private to the user
- **Storage**: Associated with specific meal instances in user's trips
- **Features**:
  - 1-5 star rating scale
  - Optional text notes (max 2000 characters)
  - Visible only to the user who created them
  - Help identify favorite meals for future trips
  - Can rate the same recipe differently in different trips/contexts

#### 3.8.2 Marketplace Ratings and Reviews
- **Purpose**: Public feedback to help others discover quality recipes
- **Scope**: Public, visible to all users
- **Storage**: Associated with the recipe in the marketplace
- **Features**:
  - 1-5 star rating scale
  - Text review (max 1000 characters)
  - Only users who have forked a recipe can rate/review it
  - One review per user per recipe (can be updated)
  - Affects recipe ranking and discoverability
  - Average rating displayed on recipe cards
  - Total review count shown

#### 3.8.3 Key Differences
| Aspect | Personal Rating | Marketplace Rating |
|--------|----------------|-------------------|
| Visibility | Private | Public |
| Purpose | Personal tracking | Community feedback |
| Eligibility | Own meals only | Forked recipes only |
| Text limit | 2000 chars (notes) | 1000 chars (review) |
| Multiple ratings | Yes (per trip) | No (one per recipe) |
| Affects ranking | No | Yes |

### 3.9 Additional Features

#### 3.9.1 Personal Meal Ratings and Notes
- **Requirement**: Personal meal feedback system [US-14]
- **Details**:
  - Personal Rating: 1-5 stars per meal instance in user's trip
  - Private ratings stored with user's meal occurrence
  - Personal notes (2000 char limit) for modifications/feedback
  - Completely separate from marketplace ratings
  - Helps track meal preferences for future planning
  - Only available for meals in user's own trips

#### 3.9.2 Daily Meal Structure
- **Requirement**: Customizable meal organization [US-20]
- **Details**:
  - Configurable meal slots
  - No hard limit on slots
  - Custom slot names
  - Consistent across trip days
  - Separate drinks category

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- **Page Load Time**: < 3 seconds for 95% of requests
- **API Response Time**: < 1 second for calculations
- **Concurrent Users**: Support ~10 concurrent users
- **Database Queries**: < 200ms for standard operations
- **Export Generation**: < 15 seconds for trip exports

### 4.2 Security Requirements
- **Authentication**: Industry-standard encryption (bcrypt for passwords)
- **Data Transmission**: HTTPS with Let's Encrypt certificate
- **Session Management**: Secure token-based authentication
- **Data Privacy**: Basic privacy compliance
- **Input Validation**: Server-side validation for all user inputs
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content sanitization

### 4.3 Scalability Requirements
- **Vertical Scaling**: Single VPS with resource upgrades as needed
- **Database**: Single PostgreSQL instance on same VPS
- **Caching**: Simple in-memory caching (no Redis required)
- **Static Assets**: Served directly from VPS
- **No Load Balancing**: Single server deployment

### 4.4 Reliability Requirements
- **Uptime**: 99% availability (vpsFree.cz SLA)
- **Backup**: Daily automated backups
- **Recovery Time Objective (RTO)**: < 8 hours
- **Recovery Point Objective (RPO)**: < 24 hours
- **Data Retention**: 10 years for inactive accounts

### 4.5 Usability Requirements
- **Browser Support Matrix**:
  - Chrome/Edge: Latest 2 versions (v119+)
  - Firefox: Latest 2 versions (v120+)
  - Safari: Latest 2 versions (v17+)
  - Mobile browsers:
    - iOS Safari: 14+
    - Chrome Android: Latest version
- **Mobile Responsive**: Full functionality on mobile devices via responsive web design
- **PWA Support**: Not included in MVP - planned for Phase 2
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Language Support**: English and Czech interfaces
- **Help Documentation**: In-app help and tooltips

### 4.6 Data Storage Requirements
- **User Limits**:
  - 500 recipes per user
  - 100 active trips per user
  - 50 ingredients per recipe
- **Character Limits**:
  - Names: 100 characters
  - Instructions/notes: 2000 characters
- **File Limits**:
  - Images: 5MB per file
  - 10 images per recipe
- **Retention Policies**:
  - Deleted items: 30 days in trash
  - Inactive accounts: 10 years
  - Expired share links: Automatic cleanup after 30 days post-expiration

## 5. Constraints and Assumptions

### 5.1 Technical Constraints
- Web-based application only (no native mobile apps)
- No PWA functionality in MVP (service workers, offline mode, app manifest planned for Phase 2)
- Single VPS deployment (vpsFree.cz)
- No offline functionality in MVP
- PWA features planned for Phase 2:
  - Service workers for offline caching
  - IndexedDB for local data storage
  - Background sync for queued actions
  - App manifest for installability
  - Push notifications
- Limited to 20 participants per trip
- One stove per trip
- Maximum 100 users total

### 5.2 Business Constraints
- English and Czech languages only at launch
- No payment processing in MVP (free tier only)
- Manual moderation for reported content
- No real-time collaboration features

### 5.3 Technical Constraints
- Maximum export size: 50MB per file
- Meal slots: Maximum 10 per day
- Cache implementation: Redis with defined TTLs
- File uploads: 5MB images, 10MB data imports

### 5.4 Assumptions
- Users have stable internet connection
- Users understand basic nutritional concepts
- Ingredient nutritional data accuracy depends on user input
- Users will manually verify fuel calculations
- Standard cooking conditions (sea level, 20°C water)

## 6. Dependencies

### 6.1 External Services
- **Authentication**: OAuth providers (Google, Facebook)
- **Email Service**: Local SMTP or simple transactional email
- **Image Storage**: Local VPS storage
- **Analytics**: Simple server logs (no external service)
- **Error Monitoring**: Basic logging (no APM service)

### 6.2 Third-Party Libraries
- **Backend Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy 2.0 with async support
- **Testing Database**: SQLite for unit tests
- **Nutritional Database**: Initial seed data source
- **PDF Generation**: ReportLab or WeasyPrint
- **Excel Export**: openpyxl
- **Image Processing**: Pillow
- **Task Queue**: Simple background tasks (no distributed queue needed)
- **Authentication**: python-jose, Passlib
- **Testing**: pytest, pytest-asyncio

### 6.3 Infrastructure

**Note**: Infrastructure designed for 100-user deployment on single VPS

- **VPS Provider**: vpsFree.cz (single VPS)
- **Web Server**: NGINX + Gunicorn
- **Database**: PostgreSQL (on same VPS)
- **Caching**: In-memory application cache
- **Static Files**: Served directly from VPS
- **Monitoring**: Basic VPS monitoring
- **Deployment**: Docker containers on single VPS

## 7. Release Criteria

### 7.1 MVP Features (Must Have)
- User registration and authentication [US-1]
- Recipe creation with nutritional calculation [US-2]
- Trip planning for multiple days [US-3]
- Participant management with coefficients [US-3, US-5]
- Ingredient database (global + personal) [US-13]
- Shopping list generation [US-7]
- Basic export functionality (PDF) [US-17]
- Calorie-based meal planning [US-12]

### 7.2 Phase 2 Features
- Recipe marketplace [US-9, US-10]
- Recipe versioning [US-2, US-11]
- Snack management [US-16]
- Fuel calculations [US-18]
- Trip templates [US-15]
- Advanced exports (Excel, TXT) [US-17]
- Meal ratings and notes [US-14]

### 7.3 Phase 1.1 Enhancements (Month 1-2 Post-Launch)
- Two-factor authentication (2FA) with TOTP support
- Recovery codes for 2FA
- Enhanced security features

### 7.4 Phase 2 - PWA and Offline Support
- **Progressive Web App (PWA)**:
  - Service worker implementation for offline caching
  - Web app manifest for installability
  - Add to home screen functionality
  - Native app-like experience
- **Offline Functionality**:
  - View cached recipes and trips offline
  - Create/edit recipes offline with sync on reconnect
  - Queue trip changes when offline
  - IndexedDB for local data persistence
- **Enhanced Mobile Features**:
  - Push notifications for shared recipes/trips
  - Background sync for data updates
  - Offline-first architecture

### 7.5 Future Enhancements (if user base grows)
- Trip sharing [US-21]
- Native mobile applications (beyond PWA)
- Premium features (if > 100 users)
- Integration with fitness trackers
- Barcode scanning for ingredients
- Migration to scalable infrastructure (if needed)
- API enhancements (GraphQL evaluation based on REST API usage patterns)

### 7.6 Quality Gates
- All unit tests passing (>80% coverage)
- Integration tests for critical paths
- Performance benchmarks met
- Security audit passed
- Accessibility audit passed
- User acceptance testing completed

## 8. Risk Analysis

### 8.1 High-Risk Areas

#### Technical Risks
- **Risk**: Complex nutritional calculations may impact VPS performance
  - **Mitigation**: Optimize algorithms and queries
  - **Impact**: Medium (affects only ~10 concurrent users)
  - **Probability**: Low

- **Risk**: Data loss due to system failure
  - **Mitigation**: Automated backups and disaster recovery plan
  - **Impact**: High
  - **Probability**: Low

#### Business Risks
- **Risk**: Low user adoption within target group
  - **Mitigation**: Intuitive UI/UX design and onboarding tutorials
  - **Impact**: Medium (target is only 100 users)
  - **Probability**: Low

- **Risk**: Inaccurate nutritional data from user inputs
  - **Mitigation**: Validation rules and verified ingredient database
  - **Impact**: Medium
  - **Probability**: High

#### Security Risks
- **Risk**: User data breach
  - **Mitigation**: Industry-standard security practices and regular audits
  - **Impact**: High
  - **Probability**: Low

- **Risk**: Account takeover attacks
  - **Mitigation**: Rate limiting (MVP), Two-factor authentication (Phase 1.1)
  - **Impact**: Medium
  - **Probability**: Medium

### 8.2 Risk Management Strategy
- Regular security audits (quarterly)
- Performance testing before each release
- User feedback loops for continuous improvement
- Phased rollout to identify issues early
- Comprehensive monitoring and alerting
- Regular backup restoration tests

## 9. Success Criteria

### 9.1 Launch Success Metrics
- 50 registered users within first three months
- 50 active trips created within first three months
- <2% critical bug rate
- 95% uptime maintained
- Average session duration >5 minutes

### 9.2 Long-term Success Metrics
- 100 registered users total
- 50% monthly active users
- 100+ recipes in marketplace
- User retention rate >60%
- Positive user feedback

## Unit Conversion Specifications

### Weight Conversions
- Base storage: grams (g)
- Display conversions:
  - 1 oz = 28.3495 g
  - 1 lb = 453.592 g
  - Display precision: 0.1 oz, 0.01 lb

### Volume Conversions  
- Base storage: milliliters (ml)
- Display conversions:
  - 1 cup = 236.588 ml
  - 1 fl oz = 29.5735 ml
  - 1 tbsp = 14.7868 ml
  - 1 tsp = 4.92892 ml

### Temperature (Cooking)
- Base storage: Celsius
- Display: F = (C × 9/5) + 32
- Precision: whole numbers

### Display Rules
- Intelligent unit selection:
  - < 5g: show as teaspoons/tablespoons
  - 5-100g: show as grams/ounces
  - > 1000g: show as kg/pounds
- User preference overrides auto-selection

## 10. Appendices

### 10.1 Glossary
- **Coefficient**: Percentage multiplier for adjusting meal portions per participant
- **Fork**: Creating a copy of a public recipe for personal modification
- **PHE**: Phenylalanine tracking for users with phenylketonuria (PKU)
- **Meal Slot**: Configured eating occasion (e.g., breakfast, lunch, dinner)
- **Snack**: Food item tracked separately from meal ingredients
- **Personal Rating**: Private 1-5 star rating stored with user's meal instance in their trip
- **Marketplace Rating**: Public 1-5 star rating that affects recipe's ranking in marketplace
- **Marketplace Review**: Public text review (max 1000 chars) visible on recipe's marketplace page

### 10.2 User Story Reference
All requirements in this document reference the original user stories [US-1 through US-21] from the source document "Jídelníček US.md"

### 10.3 Technical Stack Recommendations
- **Frontend**: React or Vue.js with TypeScript
- **Frontend**: React or Vue.js with TypeScript
- **Backend**: Python (FastAPI) - lightweight and efficient
- **Database**: PostgreSQL (single instance)
- **API**: REST API with OpenAPI 3.0 specification (GraphQL evaluation planned post-launch)
- **Caching**: In-memory caching within application
- **Search**: PostgreSQL full-text search (no Elasticsearch)
- **File Storage**: Local VPS storage
- **Deployment**: Docker containers on single VPS

---

**Document Version**: 1.2  
**Last Updated**: 2025-07-08  
**Status**: Draft (Updated for 100-user deployment)  
**Author**: Product Team  
**Approval**: Pending