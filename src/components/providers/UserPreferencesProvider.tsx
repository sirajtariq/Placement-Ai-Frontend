'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useTheme } from 'next-themes'

interface UserPreferences {
    theme: string
    avatar: string | null
    notifications: boolean
    profile_pic: string | null
    onboarding_completed?: boolean
}

interface UserPreferencesContextType {
    preferences: UserPreferences
    updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>
    isLoading: boolean
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    const { user, isSignedIn } = useUser()
    const { setTheme } = useTheme()
    const [preferences, setPreferences] = useState<UserPreferences>({
        theme: 'dark',
        avatar: 'smart',
        notifications: true,
        profile_pic: null,
        onboarding_completed: false,
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!isSignedIn || !user) {
            setIsLoading(false)
            return
        }

        const fetchPreferences = async () => {
            try {
                // Use same-origin API to avoid CORS/auth issues in the browser.
                const response = await fetch(`/api/user/${user.id}`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.preferences) {
                        setPreferences(prev => ({ ...prev, ...data.preferences }))
                        if (data.preferences.theme) {
                            setTheme(data.preferences.theme)
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch user preferences:', e)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPreferences()
    }, [isSignedIn, user, setTheme])

    const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
        // Optimistic update
        const updated = { ...preferences, ...newPrefs }
        setPreferences(updated)

        if (newPrefs.theme) {
            setTheme(newPrefs.theme)
        }

        if (!user) return

        try {
            // Use same-origin API to avoid CORS/auth issues in the browser.
            await fetch(`/api/user/${user.id}/preferences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
        } catch (e) {
            console.error('Failed to save preferences:', e)
        }
    }

    return (
        <UserPreferencesContext.Provider value={{ preferences, updatePreferences, isLoading }}>
            {children}
        </UserPreferencesContext.Provider>
    )
}

export const useUserPreferences = () => {
    const context = useContext(UserPreferencesContext)
    if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider')
    return context
}
