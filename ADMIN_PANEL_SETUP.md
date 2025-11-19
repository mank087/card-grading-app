# Admin Panel Setup Guide

## Quick Start

### Step 1: Run Database Schema

1. Open your Supabase project at https://supabase.com
2. Navigate to the SQL Editor
3. Copy the contents of `database/admin_schema.sql`
4. Paste into the SQL Editor and click "Run"

This will create:
- `admin_users` table
- `admin_sessions` table
- `admin_activity_log` table
- `api_usage_log` table
- `error_log` table
- `card_flags` table
- `system_settings` table
- Various views for analytics
- A default admin user

### Step 2: Default Admin Credentials

**⚠️ DEVELOPMENT ONLY - CHANGE IN PRODUCTION!**

- Email: `admin@cardgrader.com`
- Password: `admin123`

### Step 3: Access the Admin Panel

1. Start your development server: `npm run dev`
2. Navigate to: `http://localhost:3000/admin/login`
3. Login with the credentials above
4. You'll be redirected to the admin dashboard

## Admin Panel Structure

```
/admin/login          - Admin login page
/admin/dashboard      - Main dashboard (overview stats)
/admin/users          - User management
/admin/cards          - Card management
/admin/moderation     - Content moderation queue
/admin/monitoring     - System monitoring (API, costs, errors)
/admin/analytics      - Platform analytics
/admin/settings       - System configuration
```

## Features Implemented (Phase 1 MVP)

### ✅ Completed
- [x] Admin authentication system
- [x] Admin login page
- [x] Admin layout with sidebar navigation
- [x] Dashboard overview with real-time stats
- [x] Database schema for all admin tables
- [x] API routes for authentication
- [x] Session management (1-hour sessions)
- [x] Audit logging for admin actions
- [x] Role-based access control (Super Admin, Moderator, Support)

### 🚧 To Be Implemented
- [ ] User management dashboard (list, ban, suspend)
- [ ] Card management and moderation
- [ ] System monitoring dashboard
- [ ] Analytics dashboard
- [ ] Settings and configuration
- [ ] API usage tracking integration
- [ ] Error monitoring integration

## Security Features

1. **Password Hashing**: Bcrypt with 12 salt rounds
2. **Secure Sessions**: HTTP-only cookies with 1-hour expiration
3. **Audit Logging**: All admin actions logged
4. **Role-Based Access**: Three levels (Super Admin, Moderator, Support)
5. **Session Verification**: Every request verified against database

## Creating Additional Admin Users

Once logged in as super admin, you can create additional admin users programmatically:

```typescript
import { createAdminUser } from '@/lib/admin/adminAuth'

const newAdmin = await createAdminUser(
  'creator-admin-id',
  'newadmin@cardgrader.com',
  'securePassword123',
  'moderator', // or 'super_admin', 'support'
  'John Doe'
)
```

## Role Permissions

### Super Admin
- Full access to all features
- User management (create, ban, delete)
- System settings and configuration
- View and manage all content

### Moderator
- User management (view, ban, suspend)
- Content moderation (review, delete cards)
- View analytics and reports

### Support
- Read-only access to user data
- View cards and content
- View reports

## Troubleshooting

### Cannot login

1. Verify database schema was run successfully
2. Check that admin_users table has the default admin
3. Clear cookies and try again
4. Check browser console for errors

### Session expires immediately

1. Check that admin_sessions table exists
2. Verify system time is correct
3. Check for cookie blocking in browser

### Permission denied

1. Verify your admin role in the database
2. Check audit logs for failed permission checks
3. Ensure you're logged in as super_admin for settings access

## Next Steps

1. **Change default password** - Immediately after first login
2. **Create additional admins** - Don't rely on single account
3. **Integrate API tracking** - Connect OpenAI API calls to api_usage_log
4. **Configure monitoring** - Set up error tracking
5. **Implement remaining features** - Follow Phase 1, 2, 3 plan

## Development Notes

- Admin pages use `(dashboard)` route group to share layout
- All admin API routes are in `/api/admin/`
- Session tokens stored in HTTP-only cookies
- All database operations use Supabase service role

## Production Deployment Checklist

Before deploying to production:

- [ ] Change default admin password
- [ ] Set up environment variables for production
- [ ] Enable IP whitelisting for admin access
- [ ] Configure 2FA for admin accounts
- [ ] Set up automated session cleanup cron job
- [ ] Enable HTTPS and secure cookies
- [ ] Review and adjust rate limits
- [ ] Set up monitoring and alerts

## Support

For issues or questions about the admin panel:
1. Check the main implementation plan: `ADMIN_PANEL_IMPLEMENTATION_PLAN.md`
2. Review API routes in `/api/admin/`
3. Check audit logs for debugging

---

**Last Updated**: November 19, 2025
**Version**: Phase 1 MVP
