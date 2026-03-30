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

export async function POST(
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

    const prefs = await request.json()

    const response = await fetch(`${BACKEND_URL}/user/${userId}/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId,
      },
      body: JSON.stringify(prefs),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Backend preferences update failed:', err)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}

