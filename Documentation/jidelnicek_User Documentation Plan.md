# Jídelníček User Documentation Plan

## Executive Summary

This document outlines a realistic and achievable user documentation strategy for the Jídelníček meal planning application. The documentation is designed to be maintainable by a solo developer, focusing on essential written guides that help users get started quickly and solve common problems.

## 1. Documentation Approach

### 1.1 Platform Choice
**Recommendation:** Use GitHub Wiki or a simple markdown-based documentation in the repository
- **Pros:** Version controlled, easy to maintain, no additional hosting
- **Alternative:** Simple GitHub Pages site generated from markdown files

### 1.2 Simplified Structure
```
docs/
├── README.md (Documentation home)
├── quick-start.md
├── user-guide/
│   ├── recipes.md
│   ├── trips.md
│   ├── marketplace.md
│   └── exports.md
├── faq.md
└── troubleshooting.md
```

### 1.3 Content Priorities
1. **Quick Start Guide** - Get users productive in 10 minutes
2. **Essential Features** - Core functionality only
3. **FAQ** - 10-20 most common questions
4. **Troubleshooting** - Top 5-10 issues

### 1.4 Video Content (Nice to Have)
- One 5-minute overview video if time permits
- Screen recordings without elaborate production
- Host on YouTube, embed in docs

## 2. Quick Start Guide (quick-start.md)

### 2.1 Welcome to Jídelníček (1 paragraph)
Jídelníček helps you plan meals for outdoor adventures with precise nutritional tracking. Perfect for hikers, climbers, and expedition leaders who need accurate meal planning.

### 2.2 Account Setup (5 steps max)
1. Sign up at [website]
2. Verify your email
3. Choose metric or imperial units
4. Set your language preference
5. You're ready to start!

### 2.3 Your First Recipe (Quick walkthrough)
1. Click "Create Recipe"
2. Name it (e.g., "Trail Mix")
3. Add ingredients with quantities in grams
4. Save - nutrition calculates automatically

### 2.4 Your First Trip
1. Click "New Trip"
2. Set duration and participants
3. Add recipes to meal slots
4. Review total weight and nutrition
5. Export shopping list

### 2.5 Next Steps
- Browse the marketplace for more recipes
- Read the full user guide for advanced features
- Check FAQ for common questions

## 3. User Guide Pages (user-guide/)

### 3.1 Recipes (recipes.md)
**Essential Topics Only:**
1. Creating a recipe
2. Adding ingredients
3. Editing recipes
4. Publishing to marketplace
5. Tips for accuracy

### 3.2 Trips (trips.md)
**Essential Topics Only:**
1. Setting up a trip
2. Adding participants
3. Planning meals
4. Using coefficients
5. Reviewing nutrition

### 3.3 Marketplace (marketplace.md)
**Essential Topics Only:**
1. Finding recipes
2. Forking recipes
3. Publishing your recipes
4. Community guidelines

### 3.4 Exports (exports.md)
**Essential Topics Only:**
1. Shopping lists
2. Packing lists
3. Trip summaries
4. Printing tips

## 4. Video Content (Optional - Nice to Have)

### 4.1 One Overview Video
**If time permits, create ONE 5-minute screencast:**
- Quick account setup
- Create a simple recipe
- Plan a weekend trip
- Export shopping list

**Production approach:**
- Simple screen recording (OBS Studio)
- No fancy editing required
- Upload to YouTube
- Embed in docs

## 5. FAQ (faq.md) - 15 Essential Questions

### Account & Setup
1. How do I reset my password?
2. Can I change between metric and imperial units?
3. How do I change the interface language?

### Recipes
4. Where does the nutritional data come from?
5. Can I create custom ingredients?
6. How do I edit a recipe after publishing?
7. Why don't my calculations match the package?

### Trip Planning
8. What are participant coefficients?
9. How many calories should I plan per day?
10. Can I share my trip plan with others?

### Marketplace
11. How do I publish a recipe?
12. Can I make my recipes private?
13. What does "forking" a recipe mean?

### Technical
14. What browsers are supported?
15. Is there a mobile app?

## 6. Troubleshooting (troubleshooting.md)

### Top 5-10 Common Issues
1. **Login problems** - Password reset, email verification
2. **Recipe calculations wrong** - Check ingredient quantities
3. **Can't publish to marketplace** - Minimum requirements
4. **Export not working** - Browser compatibility
5. **Images won't upload** - File size/format limits

## 7. Writing Guidelines (Keep It Simple)

### 7.1 Basic Principles
- **Clear and concise** - Get to the point quickly
- **Action-oriented** - Tell users what to do
- **Consistent formatting** - Use markdown consistently
- **Screenshots sparingly** - Only when truly necessary

### 7.2 Simple FAQ Template
```markdown
**Q: [Question]**
A: [Direct answer in 1-2 sentences]

*If needed:* [Step-by-step solution]
```

### 7.3 Documentation Maintenance
- Update screenshots only when UI changes significantly
- Add new FAQ entries based on support tickets
- Review and update quarterly

## 8. Realistic Implementation Timeline

### Week 1-2: Setup
- Create docs/ folder in repository
- Write quick-start.md
- Set up basic GitHub Wiki or Pages

### Week 3-4: Core Documentation
- Write essential user guides (recipes, trips, marketplace, exports)
- Create FAQ with 15 questions
- Add troubleshooting page

### Week 5: Polish & Review
- Review all content for clarity
- Add minimal screenshots where essential
- Test documentation with a friend/user

### Week 6+: Maintenance Mode
- Update based on user feedback
- Add FAQ entries as needed
- Keep docs in sync with major features

### Optional Future Additions
- Simple overview video (when time permits)
- Czech translation (if user base requires)
- More detailed guides for power users

## 9. Measuring Success (Simple Metrics)

### What to Track
- Support ticket reduction
- Common questions in support
- Documentation page views (if using GitHub Pages)

### How to Improve
- Add FAQ entries for repeat questions
- Update unclear sections based on feedback
- Prioritize high-traffic pages

## 10. Maintenance Strategy

### Minimal Maintenance Approach
- **Monthly:** Quick review, add new FAQ entries
- **Per Release:** Update for new/changed features
- **Quarterly:** Check for outdated content

### Documentation Updates Checklist
- [ ] Screenshots still accurate?
- [ ] New features documented?
- [ ] FAQ covers recent support issues?
- [ ] Links still working?

## Conclusion

This streamlined documentation plan focuses on what's essential and achievable for a solo developer. The goal is to help users get started quickly and find answers to common problems without creating an overwhelming maintenance burden.

Remember: Good enough documentation that exists is infinitely better than perfect documentation that never gets written.