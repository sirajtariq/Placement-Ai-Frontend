import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8038'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    // Get the authenticated user from Clerk
    const { userId } = await auth()

    // If no user ID, return unauthorized
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { docId } = await params

    // Forward the request to your backend with user_id for verification
    const response = await fetch(`${BACKEND_URL}/documents/${docId}?user_id=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
