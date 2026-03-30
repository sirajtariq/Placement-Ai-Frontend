'use client'

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export function AuthHeader() {
  return (
    <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="text-sm font-medium hover:underline">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="bg-foreground text-background rounded-full font-medium text-sm h-10 px-5 hover:bg-foreground/90 transition-colors">
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </header>
  )
}
