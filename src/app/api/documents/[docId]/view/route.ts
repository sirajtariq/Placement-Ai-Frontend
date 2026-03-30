import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8038'

export async function GET(
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
    const response = await fetch(`${BACKEND_URL}/documents/${docId}/view?user_id=${userId}`)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentDisposition = response.headers.get('content-disposition') || ''
    const blob = await response.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Error viewing document:', error)
    return NextResponse.json(
      { error: 'Failed to view document' },
      { status: 500 }
    )
  }
}
