'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
const Sidebar = dynamic(() => import('@/components/chat/Sidebar').then(mod => mod.Sidebar), { ssr: false })
const ChatInterface = dynamic(() => import('@/components/chat/ChatInterface').then(mod => mod.ChatInterface), { ssr: false })
const Dashboard = dynamic(() => import('@/components/dashboard/Dashboard').then(mod => mod.Dashboard), { ssr: false })
const SpotlightSearch = dynamic(() => import('@/components/chat/SpotlightSearch').then(mod => mod.SpotlightSearch), { ssr: false })

import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { useView } from '@/components/providers/ViewProvider'
import { useDocumentViewer } from '@/components/providers/DocumentViewerProvider'

interface Document {
  id: number
  document_name: string
  file_name: string
  file_size: number
  uploaded_at: string
}

export default function HomePage() {
  const { activeView, setActiveView } = useView()
  const { openDoc } = useDocumentViewer()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleViewDocument = (doc: Document) => {
    openDoc({
      type: doc.document_name,
      url: `/api/documents/${doc.id}/view`,
    })
  }

  const handleSelectChat = () => {
    setActiveView('chat')
  }

  const handleSelectDashboard = () => {
    setActiveView('dashboard')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keep search shortcut if needed
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <SignedIn>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            activeView={activeView}
            onSelectChat={handleSelectChat}
            onSelectDashboard={handleSelectDashboard}
            onViewDocument={handleViewDocument}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
          <main className="flex-1 min-w-0 bg-background overflow-hidden relative">
            {activeView === 'chat' ? (
              <ChatInterface
                activeChatId="main_session"
              />
            ) : (
              <Dashboard />
            )}
          </main>
        </div>

        {/* Global Spotlight Search */}
        <SpotlightSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          sessions={[{ session_id: 'main_session', session_name: 'My Consultant' }]}
          onSelectChat={handleSelectChat}
        />
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
