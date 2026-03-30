import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { OnboardingGuard } from '@/components/providers/OnboardingGuard'
import { ViewProvider } from '@/components/providers/ViewProvider'
import { UserPreferencesProvider } from '@/components/providers/UserPreferencesProvider'
import { DocumentViewerProvider } from '@/components/providers/DocumentViewerProvider'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Placement AI — Advanced AI Study Consultant & Academic Planner',
  description: 'Elevate your academic journey with Placement AI. Build a professional academic profile, generate industry-standard SOPs and Resumes, and get personalized roadmap guidance.',
  keywords: [
    'AI Study Consultant',
    'Academic Profile Builder',
    'SOP Generator',
    'Resume Builder for Students',
    'Study Abroad Assistant',
    'Personalized Learning Roadmap',
    'Placement AI'
  ],
  authors: [{ name: 'Placement AI Team', url: 'https://placement-ai.edu' }],
  creator: 'Placement AI Team',
  publisher: 'Placement AI',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Placement AI — The Future of Academic Consulting',
    description: 'Transform your academic future with AI-powered guidance, document generation, and strategic planning.',
    url: 'https://placement-ai.edu',
    siteName: 'Placement AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Placement AI — Your AI Academic Consultant',
    description: 'Build your professional academic profile and generate state-of-the-art SOPs and Resumes.',
    creator: '@placement_ai',
  },
  category: 'education',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={inter.variable}>
        <head>
          <link rel="preconnect" href="https://accounts.google.com" />
          <link rel="preconnect" href="https://www.gstatic.com" />
          <link rel="dns-prefetch" href="https://accounts.google.com" />
        </head>
        <body className={`${inter.className} antialiased`} suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={true}
            disableTransitionOnChange={true}
            themes={['light', 'dark', 'solar', 'emerald']}
          >
            <UserPreferencesProvider>
              <ViewProvider>
                <DocumentViewerProvider>
                  <OnboardingGuard>
                    {children}
                  </OnboardingGuard>
                </DocumentViewerProvider>
              </ViewProvider>
            </UserPreferencesProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
