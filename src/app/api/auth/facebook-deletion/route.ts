import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Facebook Data Deletion Callback
// This endpoint is called by Facebook when a user requests data deletion
// Required for Facebook OAuth compliance

export async function POST(request: NextRequest) {
  try {
    // Facebook sends data as form-urlencoded, not JSON
    const formData = await request.formData()
    const signedRequest = formData.get('signed_request') as string

    if (!signedRequest) {
      return NextResponse.json(
        { error: 'Missing signed_request parameter' },
        { status: 400 }
      )
    }

    // Parse the signed request (format: signature.payload)
    const [signature, payload] = signedRequest.split('.')

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid signed_request format' },
        { status: 400 }
      )
    }

    // Decode the payload (Base64)
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8')
    const data = JSON.parse(decodedPayload)

    // Extract user ID from Facebook
    const facebookUserId = data.user_id

    if (!facebookUserId) {
      return NextResponse.json(
        { error: 'Missing user_id in request' },
        { status: 400 }
      )
    }

    console.log(`Facebook data deletion request for user: ${facebookUserId}`)

    // Find the user in our database by their Facebook ID
    // Note: Supabase stores provider info in auth.users table
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('Error fetching users:', authError)
    }

    // Find user with matching Facebook provider ID
    const matchedUser = authUsers?.users.find(user =>
      user.app_metadata?.provider === 'facebook' &&
      user.user_metadata?.provider_id === facebookUserId
    )

    if (matchedUser) {
      // Delete user's cards first
      const { error: cardsError } = await supabaseAdmin
        .from('cards')
        .delete()
        .eq('user_id', matchedUser.id)

      if (cardsError) {
        console.error('Error deleting user cards:', cardsError)
      }

      // Delete from public.users table
      const { error: publicUserError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', matchedUser.id)

      if (publicUserError) {
        console.error('Error deleting public user:', publicUserError)
      }

      // Delete from Supabase Auth
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        matchedUser.id
      )

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError)
      } else {
        console.log(`Successfully deleted user ${matchedUser.id} (Facebook: ${facebookUserId})`)
      }
    } else {
      console.log(`No user found for Facebook ID: ${facebookUserId}`)
    }

    // Facebook expects a response with:
    // - url: Where user can check status
    // - confirmation_code: Unique code for this deletion request
    const confirmationCode = `${facebookUserId}_${Date.now()}`

    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dcmgrading.com'}/data-deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode
    }, { status: 200 })

  } catch (error) {
    console.error('Facebook data deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({
    message: 'Facebook Data Deletion Callback Endpoint',
    status: 'active',
    instructions: 'POST a signed_request to this endpoint'
  })
}
