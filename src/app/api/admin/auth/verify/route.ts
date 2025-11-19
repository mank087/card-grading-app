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

    return NextResponse.json(
      { authenticated: true, user },
      { status: 200 }
    )
  } catch (error) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
