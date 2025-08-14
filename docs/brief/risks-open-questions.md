# Risks & Open Questions

## Key Risks

- **Acuity API Dependency:** Single point of failure if Acuity has outages or changes their API, limiting control over core booking functionality
- **HIPAA and Privacy Act 1988/APPs Compliance on Bootstrap Budget:** AWS compliance features may increase operational costs, need to balance security requirements with budget constraints
- **User Adoption Resistance:** Lawyers comfortable with current phone-based process may resist change, specialists might not embrace the dictation workflow
- **Scope Creep Under Tight Timeline:** Stakeholders requesting "just one more feature" could derail 6-week deadline, pressure to add notifications/payments early
- **Dual Role System Complexity:** Managing both Better Auth admin plugin (system-wide) and organization plugin (org-specific) roles simultaneously, but mitigated by clear separation: admins for internal team only, organization roles for all client users
- **Document Security at Scale:** Portal-proxied downloads could become bottleneck with growth, balance between security and user experience

## Open Questions

- What specific Australian privacy laws beyond HIPAA need to be considered?
- How will the system handle time zones for multi-state operations?
- What's the disaster recovery plan for document storage?
- Should we implement rate limiting for API endpoints from day one?
- How do we handle specialist unavailability or last-minute cancellations?
- What level of audit logging is required for legal compliance?
- Will Dokploy's deployment model support zero-downtime updates?
- How do we validate HIPAA compliance without expensive certification?

## Areas Needing Further Research

- Australian IME regulatory requirements by state
- Competitive analysis of existing IME coordination platforms
- Integration capabilities of popular legal case management systems
- Performance benchmarks for Better Auth with complex organizations
- Best practices for medical document retention policies
- Accessibility requirements for Australian government contracts
- Cost analysis of scaling beyond 150 bookings/month
- User research on optimal workflow for different referrer types
