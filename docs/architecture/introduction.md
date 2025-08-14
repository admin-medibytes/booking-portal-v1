# Introduction

This document outlines the complete fullstack architecture for Medical Examination Booking Platform, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

## Project Context

The Medical Examination Booking Platform addresses critical inefficiencies in Australia's personal injury legal system, where law firms must coordinate Independent Medical Examinations (IMEs) through intermediary services. Currently handling ~90 bookings monthly across 50+ referrers, the manual phone-based process wastes approximately 27 hours of staff time on coordination alone.

This architecture delivers a secure, HIPAA and Privacy Act 1988/APPs compliant platform that:
- Enables sub-3-minute self-service booking creation
- Provides real-time visibility across all stakeholders
- Maintains comprehensive audit trails for legal compliance
- Supports 150+ bookings/month without additional staff
- Integrates with existing Acuity Scheduling infrastructure

## Architectural Philosophy

Given the medical-legal context and compliance requirements, this architecture prioritizes:
- **Security First**: All PHI data encrypted in transit and at rest, portal-proxied document access
- **Audit Everything**: Comprehensive logging with Pino for external audit system integration
- **Role-Based Access**: Granular permissions using Better Auth with organization/team plugins
- **Scalable Foundation**: Stateless services enabling horizontal scaling as volume grows
- **Developer Experience**: Type-safe end-to-end with TypeScript, ArkType validation, and Drizzle ORM

## Starter Template or Existing Project

N/A - Greenfield project

While starter templates like T3 Stack or Vercel's Next.js templates were considered, the specific requirements drove a custom approach:
- Better Auth with extensive plugin requirements (admin, organization with teams, 2FA, phone, email OTP)
- Hono.js integration within Next.js for API routes (non-standard setup)
- Strict medical document handling with portal-proxy pattern
- Complex role hierarchy with impersonation capabilities

Starting fresh ensures clean implementation of these domain-specific requirements without fighting framework assumptions.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-13 | 1.0 | Initial fullstack architecture document | Winston (Architect) |
