# Manual Testing Setup Guide

This guide explains how to set up your local environment for manual testing of the booking portal, including creating your first users and testing the invitation flow.

## Prerequisites

1. Database is running and migrations are applied:
   ```bash
   pnpm db:migrate
   ```

2. Development server is running:
   ```bash
   pnpm dev
   ```

## Creating Your First User

Since the system requires an admin to invite users, you need to bootstrap the first admin user. Use the interactive CLI tool:

```bash
pnpm seed:user
```

### Step-by-Step Process

1. **Run the seed command**:
   ```bash
   pnpm seed:user
   ```

2. **Enter user details** when prompted:
   - First Name: e.g., "John"
   - Last Name: e.g., "Doe"
   - Email: e.g., "admin@medibytes.com"
   - Password: Must be at least 8 characters

3. **Select user role**:
   - Choose `1` for admin (can invite other users)
   - Choose `2` for regular user

4. **Organization setup**:
   - If no organizations exist, you'll be prompted to create one
   - Enter organization name and slug
   - If organizations exist, select one or create new

5. **Select member role** within the organization:
   - owner: Full organization access
   - manager: Team management access
   - team_lead: Team-level permissions
   - referrer: Can create bookings
   - specialist: Can view assigned bookings

6. **Team assignment** (optional):
   - Select existing team or create new
   - Or skip team assignment

## Testing the Invitation Flow

Once you have an admin user:

1. **Login as admin**:
   - Navigate to http://localhost:3000/login
   - Use the credentials you created

2. **Access admin panel**:
   - After login, you'll be redirected to the admin dashboard
   - Go to "User Management" section

3. **Invite a new user**:
   - Click "Invite User"
   - Enter user details (email, role, organization)
   - Send invitation

4. **Check email logs**:
   - Since email is not configured, check console logs
   - You'll see the invitation link printed

5. **Accept invitation**:
   - Open the invitation link in a new browser/incognito window
   - Complete the registration process
   - Set up password and optional 2FA

## Testing Different User Roles

Create users with different roles to test access control:

### Admin User
```bash
pnpm seed:user
# Choose: role=admin, member_role=owner
```
- Can access admin panel
- Can invite users
- Can manage organizations

### Referrer User
```bash
pnpm seed:user
# Choose: role=user, member_role=referrer
```
- Can create bookings
- Limited to booking management

### Specialist User
```bash
pnpm seed:user
# Choose: role=user, member_role=specialist
```
- Can view assigned appointments
- Cannot create bookings

## Testing Password Reset

1. **Go to login page**: http://localhost:3000/login
2. **Click "Forgot password?"**
3. **Enter email address**
4. **Check console logs** for reset link (emails not configured)
5. **Open reset link** and set new password

## Common Testing Scenarios

### 1. First-Time Login Flow
- Create a new user via invitation
- Login for the first time
- Should be redirected to onboarding
- Set up password and optional 2FA

### 2. Role-Based Access
- Login with different user roles
- Verify correct dashboard redirection:
  - Admin → /admin
  - Referrer → /bookings
  - Specialist → /appointments

### 3. Invitation Expiration
- Create an invitation
- Wait 7 days (or modify expiration in database)
- Try to accept expired invitation
- Should see appropriate error message

### 4. Organization Management
- Create users in different organizations
- Verify organization isolation
- Test team assignments

## Troubleshooting

### "Admin user already exists" error
If you get this error, an admin already exists in your database. You can:
1. Login with existing admin credentials
2. Or reset the database: `pnpm db:push --force` (WARNING: This deletes all data)

### Email links not working
Currently, emails are logged to console. To test:
1. Check server console for email content
2. Copy the link from console output
3. Open in browser

### Database connection errors
Ensure PostgreSQL is running and configured correctly:
```bash
# Check database connection
psql -U postgres -d booking_portal
```

## Quick Start Commands

```bash
# Create admin user
pnpm seed:user
# Select: admin role, owner member role

# Start development server
pnpm dev

# Open application
open http://localhost:3000/login

# Watch server logs for email links
# (Emails are printed to console)
```

## Next Steps

After setting up test users:
1. Test the complete invitation flow
2. Verify role-based access control
3. Test password reset functionality
4. Create bookings and appointments
5. Test organization and team features

Remember to check the server console for email content since AWS SES is not configured in development.