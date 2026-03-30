import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8038'

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const response = await fetch(`${BACKEND_URL}/documents/${userId}`)

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json({ items: [] })
            }
            throw new Error(`Backend responded with status: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching generated documents:', error)
        return NextResponse.json(
            { error: 'Failed to fetch generated documents' },
            { status: 500 }
        )
    }
}
