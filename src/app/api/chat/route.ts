import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8038'

export async function POST(request: NextRequest) {
  try {
    // AWAIT the auth() call!
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - No user ID' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Forward the request to your backend with the user_id and token
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        user_id: userId, // Add the Clerk user ID here
      }),
    })

    console.log('Chat API - Backend response status:', response.status) // Debug log

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Chat API - Backend error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Backend error' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('Chat API - Backend response data:', data) // Debug log
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in chat API route:', error)
    return NextResponse.json(
      { error: 'Failed to communicate with backend' },
      { status: 500 }
    )
  }
}
