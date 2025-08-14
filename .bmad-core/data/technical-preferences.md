# User-Defined Preferred Patterns and Preferences

## Authentication & Authorization

### Primary Auth Solution: better-auth
- Documentation: https://www.better-auth.com/
- Required Plugins:
  - admin - Administrative user management
  - organization (with teams enabled) - Multi-tenant support with team collaboration
  - two-factor - 2FA authentication support
  - phone-number - Phone number verification and authentication

### Implementation Notes
- Use better-auth for all authentication flows
- Enable teams feature in organization plugin for collaborative features
- Implement 2FA as optional but encouraged for all users
- Phone number verification for enhanced security

## Data Validation & Runtime Type Safety

### Primary Validation Solution: ArkType
- Documentation: https://arktype.io/
- STRICT REQUIREMENT: Use ArkType exclusively for ALL data validation needs

### Key ArkType Features to Utilize:

#### 1. Runtime Validation
- Use for all API request/response validation
- Form input validation
- Environment variable validation
- Configuration file validation
- Database schema validation

#### 2. Data Transformation (Morphs)
- Use `.pipe()` for data transformations after validation
- Use `.to()` operator for chaining validators
- Use `.pipe.try()` for unsafe transformations (e.g., JSON.parse)
- Example: `type("string").pipe((s) => s.trim().toLowerCase())`

#### 3. Data Sanitization
- Sanitize user inputs using morphs
- Strip unwanted properties
- Normalize data formats
- Clean HTML/prevent XSS with custom morphs

#### 4. Type Narrowing
- Use `.narrow()` for custom validation logic
- Add business rule validations
- Implement complex conditional validations

#### 5. Error Handling
- Leverage ArkType's detailed error messages
- Implement custom error strategies using `onFail` config
- Use type-safe error handling patterns

### Implementation Patterns:

```typescript
// API Request Validation
const UserInput = type({
  email: "string.email",
  password: "string.min(8)",
  "name?": "string.trim", // Optional with trim morph
  "phone?": "string.phone"
})

// Data Transformation
const normalizePhone = type("string")
  .pipe((s) => s.replace(/\D/g, ''))
  .pipe((s) => s.length === 10 ? `+1${s}` : s)

// Sanitization
const sanitizeHtml = type("string")
  .pipe((s) => DOMPurify.sanitize(s))

// Complex Validation with Narrowing
const ageRange = type("number")
  .narrow((age) => age >= 18 && age <= 100, "Age must be between 18 and 100")
```

### Integration Guidelines:
- Use ArkType's 1:1 TypeScript syntax for consistency
- Leverage compile-time type inference for better DX
- Take advantage of 100x performance improvement
- Use set theory capabilities for complex type relationships
