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
    { params }: { params: Promise<{ path?: string[] }> }
) {
    return proxyRequest(request, await params)
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    return proxyRequest(request, await params)
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    return proxyRequest(request, await params)
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    return proxyRequest(request, await params)
}

async function proxyRequest(
    request: NextRequest,
    params: { path?: string[] }
) {
    try {
        const { userId: clerkUserId } = await auth()
        if (!clerkUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const pathSegments = params.path || []

        // Safety check: The first segment should be the userId and it should match Clerk
        if (pathSegments.length > 0 && pathSegments[0] !== clerkUserId) {
            console.error(`User mismatch in application proxy: clerk=${clerkUserId}, path=${pathSegments[0]}`)
            // However, some routes might not follow this exactly if I messed up.
            // Let's enforce it for safety.
            return NextResponse.json({ error: 'Unauthorized - User mismatch' }, { status: 401 })
        }

        const token = await getToken()
        const backendPath = `/api/applications/${pathSegments.join('/')}`
        const url = `${BACKEND_URL}${backendPath}`

        const method = request.method
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'X-User-Id': clerkUserId,
        }

        const contentType = request.headers.get('content-type')
        if (contentType) {
            headers['Content-Type'] = contentType
        }

        let body = null
        if (['POST', 'PATCH', 'PUT'].includes(method)) {
            body = await request.text()
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body || undefined,
        })

        if (!response.ok) {
            const err = await response.text()
            try {
                const jsonErr = JSON.parse(err)
                return NextResponse.json(jsonErr, { status: response.status })
            } catch {
                return NextResponse.json({ error: err }, { status: response.status })
            }
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in applications proxy:', error)
        return NextResponse.json({ error: 'Failed to communicate with backend' }, { status: 500 })
    }
}
