# Constraints & Assumptions

## Constraints

- **Budget:** Limited bootstrap budget requiring careful AWS service selection, minimal external services beyond essentials, need to optimize for operational efficiency while maintaining compliance
- **Timeline:** 6-week hard deadline for MVP launch to capture market opportunity, 4 weeks development + 1 week testing + 1 week deployment, no room for scope creep or major pivots
- **Resources:** Single developer/small team for initial build, limited time for extensive user research pre-launch, must leverage existing tools (Acuity, Better Auth) vs building from scratch
- **Technical:** 
  - Dependency on Acuity Scheduling API for MVP
  - AWS infrastructure costs need careful management and monitoring
  - HIPAA and Privacy Act 1988/APPs compliance requirements constraining architecture choices
  - Must work within existing Better Auth plugin capabilities

## Key Assumptions

- Acuity Scheduling will remain stable and available throughout MVP phase
- 50+ existing referrers will adopt the new platform with minimal training
- Current manual process pain is sufficient to drive user adoption
- Better Auth's organization plugin can handle the complex role hierarchy
- AWS S3 provides secure document storage with proper access controls
- AWS infrastructure can handle the deployment complexity of a HIPAA and Privacy Act 1988/APPs compliant application
- Users have modern browsers and stable internet connections
- The two-stage workflow (booking then documents) matches actual user behavior
- Specialists will embrace the dictation workflow for report generation
- HIPAA compliance can be achieved with chosen infrastructure
