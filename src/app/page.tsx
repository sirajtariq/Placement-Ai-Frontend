'use client'

import dynamic from 'next/dynamic'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'

const Dashboard = dynamic(
  () => import('@/components/dashboard/Dashboard').then(mod => mod.Dashboard),
  { ssr: false }
)

export default function HomePage() {
  return (
    <>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
