import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      )
    }

    // Verify session
    const user = await verifyAdminSession(token)

    if (!user) {
      // Session invalid or expired
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      )
      response.cookies.delete('admin_token')
      return response
    }

    // verifyAdminSession slides the DB session forward; re-issue the cookie
    // with a fresh maxAge so it doesn't expire 1h after login while the
    // session is still active. Options match the login route.
    const response = NextResponse.json(
      { authenticated: true, user },
      { status: 200 }
    )
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hour, matches SESSION_DURATION_MS
      path: '/'
    })
    return response
  } catch (error) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
