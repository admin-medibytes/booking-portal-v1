# API Specification

Based on the REST API style chosen in Tech Stack, here's the OpenAPI 3.0 specification for the Medical Examination Booking Platform:

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Medical Examination Booking Platform API
  version: 1.0.0
  description: API for managing IME bookings, documents, and related operations
servers:
  - url: https://api.medicalexambooking.com.au
    description: Production server
  - url: http://localhost:3000/api
    description: Development server

security:
  - bearerAuth: []

paths:
  /auth/login:
    post:
      tags: [Authentication]
      summary: Login with email and password
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
      responses:
        200:
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string

  /bookings:
    get:
      tags: [Bookings]
      summary: List bookings with filtering
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, closed, archived]
        - name: specialistIds
          in: query
          schema:
            type: array
            items:
              type: string
        - name: search
          in: query
          schema:
            type: string
          description: Search by examinee name
        - name: startDate
          in: query
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          schema:
            type: string
            format: date
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        200:
          description: Bookings list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Booking'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      tags: [Bookings]
      summary: Create new booking
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [specialistId, appointmentDateTime, examineeName, examineePhone]
              properties:
                specialistId:
                  type: string
                appointmentDateTime:
                  type: string
                  format: date-time
                examineeName:
                  type: string
                examineePhone:
                  type: string
                examineeEmail:
                  type: string
                  format: email
                notes:
                  type: string
      responses:
        201:
          description: Booking created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Booking'

  /bookings/{bookingId}:
    get:
      tags: [Bookings]
      summary: Get booking details
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Booking details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingDetails'

    patch:
      tags: [Bookings]
      summary: Update booking
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  enum: [active, closed, archived]
                notes:
                  type: string
      responses:
        200:
          description: Booking updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Booking'

  /bookings/{bookingId}/progress:
    post:
      tags: [Bookings]
      summary: Update booking progress
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [progress]
              properties:
                progress:
                  type: string
                  enum: [scheduled, rescheduled, cancelled, no_show, generating_report, report_generated, payment_received]
                notes:
                  type: string
      responses:
        201:
          description: Progress updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingProgress'

  /bookings/{bookingId}/documents:
    get:
      tags: [Documents]
      summary: List booking documents
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
        - name: category
          in: query
          schema:
            type: string
            enum: [consent_form, brief, report, dictation, other]
      responses:
        200:
          description: Documents list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Document'

    post:
      tags: [Documents]
      summary: Upload document
      parameters:
        - name: bookingId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file, category]
              properties:
                file:
                  type: string
                  format: binary
                category:
                  type: string
                  enum: [consent_form, brief, report, dictation, other]
      responses:
        201:
          description: Document uploaded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Document'

  /documents/{documentId}:
    get:
      tags: [Documents]
      summary: Download document (portal-proxied)
      parameters:
        - name: documentId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Document file
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary

    delete:
      tags: [Documents]
      summary: Delete document
      parameters:
        - name: documentId
          in: path
          required: true
          schema:
            type: string
      responses:
        204:
          description: Document deleted

  /specialists:
    get:
      tags: [Specialists]
      summary: List available specialists
      parameters:
        - name: isActive
          in: query
          schema:
            type: boolean
            default: true
      responses:
        200:
          description: Specialists list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Specialist'

  /specialists/{specialistId}/availability:
    get:
      tags: [Specialists]
      summary: Get specialist availability from Acuity
      parameters:
        - name: specialistId
          in: path
          required: true
          schema:
            type: string
        - name: startDate
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          required: true
          schema:
            type: string
            format: date
      responses:
        200:
          description: Available time slots
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    datetime:
                      type: string
                      format: date-time
                    duration:
                      type: integer
                      description: Duration in minutes

  /admin/impersonate:
    post:
      tags: [Admin]
      summary: Start impersonating a user
      parameters:
        - name: X-Admin-Token
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [userId]
              properties:
                userId:
                  type: string
      responses:
        200:
          description: Impersonation started
          content:
            application/json:
              schema:
                type: object
                properties:
                  impersonationToken:
                    type: string
                  user:
                    $ref: '#/components/schemas/User'

  /admin/referrers/search:
    get:
      tags: [Admin]
      summary: Search for referrers
      parameters:
        - name: query
          in: query
          required: true
          schema:
            type: string
        - name: X-Admin-Token
          in: header
          required: true
          schema:
            type: string
      responses:
        200:
          description: Search results
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

  /webhooks/acuity:
    post:
      tags: [Webhooks]
      summary: Receive Acuity webhook events
      security: []
      parameters:
        - name: X-Acuity-Signature
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: string
                id:
                  type: string
                calendarID:
                  type: string
                datetime:
                  type: string
      responses:
        200:
          description: Webhook processed

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        role:
          type: string
          enum: [admin, user]
        organization:
          $ref: '#/components/schemas/Organization'

    Organization:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string

    Specialist:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        specialty:
          type: string
        location:
          type: string
          nullable: true
        isActive:
          type: boolean

    Booking:
      type: object
      properties:
        id:
          type: string
        acuityAppointmentId:
          type: string
        specialist:
          $ref: '#/components/schemas/Specialist'
        examineeName:
          type: string
        appointmentDate:
          type: string
          format: date-time
        status:
          type: string
          enum: [active, closed, archived]
        currentProgress:
          type: string
        appointmentType:
          type: string
          enum: [in_person, telehealth]
        meetingLink:
          type: string
          nullable: true

    BookingDetails:
      allOf:
        - $ref: '#/components/schemas/Booking'
        - type: object
          properties:
            progress:
              type: array
              items:
                $ref: '#/components/schemas/BookingProgress'
            documents:
              type: array
              items:
                $ref: '#/components/schemas/Document'

    BookingProgress:
      type: object
      properties:
        id:
          type: string
        progress:
          type: string
        changedBy:
          $ref: '#/components/schemas/User'
        notes:
          type: string
          nullable: true
        createdAt:
          type: string
          format: date-time

    Document:
      type: object
      properties:
        id:
          type: string
        fileName:
          type: string
        fileSize:
          type: integer
        mimeType:
          type: string
        category:
          type: string
        uploadedBy:
          $ref: '#/components/schemas/User'
        createdAt:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
```
