/**
 * Admin Authentication Utilities
 * Handles admin user authentication, session management, and authorization
 */

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export type AdminRole = 'super_admin' | 'moderator' | 'support'

export interface AdminUser {
  id: string
  email: string
  role: AdminRole
  full_name: string | null
  two_factor_enabled: boolean
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export interface AdminSession {
  id: string
  admin_user_id: string
  token: string
  expires_at: string
  ip_address: string | null
  created_at: string
}

// Session duration: 1 hour
const SESSION_DURATION_MS = 60 * 60 * 1000

/**
 * Generate a secure random token for sessions
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Authenticate admin user with email and password
 * Returns admin user and session token if successful
 */
export async function authenticateAdmin(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: AdminUser; token: string; session: AdminSession } | null> {
  try {
    // Get admin user by email
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()

    if (userError || !adminUser) {
      console.log('Admin user not found or inactive:', email)
      return null
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, adminUser.password_hash)
    if (!isValidPassword) {
      console.log('Invalid password for admin:', email)
      return null
    }

    // Generate session token
    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .insert({
        admin_user_id: adminUser.id,
        token,
        expires_at: expiresAt,
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Failed to create admin session:', sessionError)
      return null
    }

    // Update last login
    await supabase
      .from('admin_users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ipAddress || null
      })
      .eq('id', adminUser.id)

    // Log admin activity
    await logAdminActivity(
      adminUser.id,
      adminUser.email,
      'admin_login',
      'admin_user',
      adminUser.id,
      { ip_address: ipAddress, user_agent: userAgent },
      ipAddress
    )

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = adminUser

    return {
      user: userWithoutPassword as AdminUser,
      token,
      session
    }
  } catch (error) {
    console.error('Error authenticating admin:', error)
    return null
  }
}

/**
 * Verify admin session token and return admin user
 */
export async function verifyAdminSession(token: string): Promise<AdminUser | null> {
  try {
    // Get session by token
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('token', token)
      .single()

    if (sessionError || !session) {
      console.log('Admin session not found')
      return null
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      console.log('Admin session expired')
      // Delete expired session
      await supabase.from('admin_sessions').delete().eq('id', session.id)
      return null
    }

    // Check if user is active
    if (!session.admin_users.is_active) {
      console.log('Admin user is inactive')
      return null
    }

    // Extend session (sliding window)
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    await supabase
      .from('admin_sessions')
      .update({ expires_at: newExpiresAt })
      .eq('id', session.id)

    const { password_hash, ...userWithoutPassword } = session.admin_users
    return userWithoutPassword as AdminUser
  } catch (error) {
    console.error('Error verifying admin session:', error)
    return null
  }
}

/**
 * Log out admin user by deleting session
 */
export async function logoutAdmin(token: string): Promise<boolean> {
  try {
    // Get session to log activity
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('token', token)
      .single()

    if (session && session.admin_users) {
      await logAdminActivity(
        session.admin_users.id,
        session.admin_users.email,
        'admin_logout',
        'admin_user',
        session.admin_users.id,
        {},
        session.ip_address
      )
    }

    // Delete session
    const { error } = await supabase
      .from('admin_sessions')
      .delete()
      .eq('token', token)

    return !error
  } catch (error) {
    console.error('Error logging out admin:', error)
    return false
  }
}

/**
 * Check if admin user has required role
 */
export function hasRole(user: AdminUser, requiredRole: AdminRole | AdminRole[]): boolean {
  const roleHierarchy: Record<AdminRole, number> = {
    super_admin: 3,
    moderator: 2,
    support: 1
  }

  const userRoleLevel = roleHierarchy[user.role]

  if (Array.isArray(requiredRole)) {
    return requiredRole.some(role => userRoleLevel >= roleHierarchy[role])
  }

  return userRoleLevel >= roleHierarchy[requiredRole]
}

/**
 * Log admin activity for audit trail
 */
export async function logAdminActivity(
  adminUserId: string,
  adminEmail: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any>,
  ipAddress?: string | null
): Promise<void> {
  try {
    await supabase.from('admin_activity_log').insert({
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress
    })
  } catch (error) {
    console.error('Error logging admin activity:', error)
  }
}

/**
 * Create new admin user (super admin only)
 */
export async function createAdminUser(
  creatorId: string,
  email: string,
  password: string,
  role: AdminRole,
  fullName?: string
): Promise<AdminUser | null> {
  try {
    const passwordHash = await hashPassword(password)

    const { data: newAdmin, error } = await supabase
      .from('admin_users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
        full_name: fullName || null,
        created_by: creatorId
      })
      .select()
      .single()

    if (error || !newAdmin) {
      console.error('Error creating admin user:', error)
      return null
    }

    const { password_hash, ...adminWithoutPassword } = newAdmin
    return adminWithoutPassword as AdminUser
  } catch (error) {
    console.error('Error creating admin user:', error)
    return null
  }
}

/**
 * Get admin user from session token stored in cookies
 */
export async function getAdminFromCookie(cookieValue: string | undefined): Promise<AdminUser | null> {
  if (!cookieValue) {
    return null
  }

  return verifyAdminSession(cookieValue)
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('admin_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error)
    return 0
  }
}
