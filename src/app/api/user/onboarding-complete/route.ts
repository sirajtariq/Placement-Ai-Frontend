import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST() {
    const { userId } = await auth()

    if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const client = await clerkClient()
        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                onboardingComplete: true,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating user metadata:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
