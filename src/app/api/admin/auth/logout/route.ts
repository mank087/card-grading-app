import { NextRequest, NextResponse } from 'next/server'
import { logoutAdmin } from '@/lib/admin/adminAuth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }

    // Logout admin (delete session)
    await logoutAdmin(token)

    // Clear cookie
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    )

    response.cookies.delete('admin_token')

    return response
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
