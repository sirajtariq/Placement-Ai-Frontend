'use client'

import { ClerkProvider as Clerk } from '@clerk/nextjs'

export function ClerkProvider({ children }: { children: React.ReactNode }) {
    return (
        <Clerk
            appearance={{
                elements: {
                    formButtonPrimary: 'bg-primary hover:bg-primary/90',
                    footerActionLink: 'text-primary hover:text-primary/80',
                },
            }}
        >
            {children}
        </Clerk>
    )
}
