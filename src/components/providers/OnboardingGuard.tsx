'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useUserPreferences } from './UserPreferencesProvider'

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoaded, isSignedIn } = useUser()
    const { preferences, isLoading } = useUserPreferences()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (isLoaded && isSignedIn && !isLoading) {
            const clerkComplete = user?.publicMetadata?.onboardingComplete === true
            const dbComplete = preferences.onboarding_completed === true

            // Consider onboarded if EITHER source says so (redundancy)
            // or if both say so (ideal case).
            const isFullyOnboarded = clerkComplete || dbComplete

            if (!isFullyOnboarded && pathname !== '/onboarding') {
                router.push('/onboarding')
            } else if (isFullyOnboarded && pathname === '/onboarding') {
                router.push('/')
            }
        }
    }, [isLoaded, isSignedIn, isLoading, user, preferences, pathname, router])

    if (!isLoaded || (isSignedIn && isLoading) || (isSignedIn && (!user?.publicMetadata?.onboardingComplete && !preferences.onboarding_completed) && pathname !== '/onboarding')) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="h-8 w-8 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return <>{children}</>
}
