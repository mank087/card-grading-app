import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, isAdminLoginRateLimited, recordFailedAdminLogin } from '@/lib/admin/adminAuth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get IP address and user agent for audit logging
    // First entry of x-forwarded-for is the client IP (rest are proxies)
    const ipAddress = (request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown').split(',')[0].trim()
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Reject before touching credentials if this IP or email is locked out
    if (await isAdminLoginRateLimited(ipAddress, email)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again later.' },
        { status: 429 }
      )
    }

    // Authenticate admin
    const result = await authenticateAdmin(email, password, ipAddress, userAgent)

    if (!result) {
      await recordFailedAdminLogin(ipAddress, email, userAgent)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Set session token in HTTP-only cookie
    const response = NextResponse.json(
      {
        success: true,
        user: result.user
      },
      { status: 200 }
    )

    // Set secure cookie with session token
    response.cookies.set('admin_token', result.token, {
      httpOnly: true,
      secure: true, // Always use secure in production
      sameSite: 'strict', // Strict to prevent CSRF
      maxAge: 60 * 60, // 1 hour
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
