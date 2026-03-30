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
        const { userId } = await auth()

        // If no user ID, return unauthorized
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const token = await getToken()
        if (!token) {
            return NextResponse.json({ error: 'Could not get session token' }, { status: 401 })
        }

        // Note: We ignore the sessionId param and use userId instead
        // This endpoint is being migrated to /api/user/[userId]/todos
        const response = await fetch(`${BACKEND_URL}/user/${userId}/todos`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-User-Id': userId,
            },
        })

        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching user todos:', error)
        return NextResponse.json(
            { error: 'Failed to fetch user todos' },
            { status: 500 }
        )
    }
}
