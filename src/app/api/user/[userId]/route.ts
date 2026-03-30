import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8038'

async function getToken(): Promise<string | null> {
  try {
    const { getToken } = await auth()
    return await getToken()
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Get the authenticated user from Clerk
    const { userId: clerkUserId } = await auth()

    // If no user ID, return unauthorized
    if (!clerkUserId) {
      console.error('No clerk user ID found')
      return NextResponse.json(
        { error: 'Unauthorized - No user ID' },
        { status: 401 }
      )
    }

    const { userId } = await params

    // Verify the authenticated user matches the requested user
    if (clerkUserId !== userId) {
      console.error(`User mismatch: clerk=${clerkUserId}, requested=${userId}`)
      return NextResponse.json(
        { error: 'Unauthorized - User mismatch' },
        { status: 401 }
      )
    }

    const token = await getToken()
    if (!token) {
      return NextResponse.json({ error: 'Could not get session token' }, { status: 401 })
    }

    console.log(`Fetching user data for ${userId}`)
    const response = await fetch(`${BACKEND_URL}/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId,
      },
    })

    if (!response.ok) {
      console.error(`Backend responded with status: ${response.status}`)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - User mismatch' }, { status: 401 })
    }

    const token = await getToken()
    if (!token) {
      return NextResponse.json({ error: 'Could not get session token' }, { status: 401 })
    }

    const updates = await request.json()
    const response = await fetch(`${BACKEND_URL}/user/${userId}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId,
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`Backend profile update failed: ${err}`)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
