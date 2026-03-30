'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { GraduationCap, ArrowUp, ChevronDown } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/components/providers/UserPreferencesProvider'


interface Message {
    id: number
    content: string
    sender: 'user' | 'assistant'
    timestamp: string
    documents?: { type: string; content: string; id: string; country?: string }[]
}

interface ChatInterfaceProps {
    activeChatId: string | null
    onChatStarted?: (sessionId: string) => void
}

export function ChatInterface({ activeChatId, onChatStarted }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { user, isLoaded, isSignedIn } = useUser()
    const userId = user?.id  // Get Clerk user ID
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const { preferences } = useUserPreferences()
    const initializedRef = useRef<string | null>(null)

    // Initialization: load chat history (no auto-greeting)
    useEffect(() => {
        // Don't proceed if user is not loaded or not signed in
        if (!isLoaded || !isSignedIn || !userId) return

        // Prevent re-initialization if already done for this user
        if (initializedRef.current === userId) return
        initializedRef.current = userId

        async function initialize() {
            setIsLoading(true)
            try {
                // Fetch user data from backend using user_id
                const response = await fetch(`/api/user/${userId}`)
                if (response.ok) {
                    const data = await response.json()
                    const history = data.chat_history || []
                    if (history.length === 0) {
                        // New user: keep chat empty until they send the first message
                        setMessages([])
                    } else {
                        const historicalMessages = history.map((msg: any, i: number) => ({
                            id: Date.now() - (history.length - i),
                            content: msg.content,
                            sender: (msg.role === 'assistant' || msg.role === 'ai') ? 'assistant' : 'user',
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            documents: msg.documents
                        }))
                        setMessages(historicalMessages)
                    }
                } else if (response.status === 404) {
                    // New user not found yet: keep chat empty
                    setMessages([])
                }
            } catch (error) {
                console.error('Error loading user history:', error)
            } finally {
                setIsLoading(false)
            }
        }
        initialize()
    }, [userId, isLoaded, isSignedIn])

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (!showScrollButton) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        }
    }, [messages, showScrollButton])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
        setShowScrollButton(!isAtBottom)
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Auto-focus textarea after AI replies
    useEffect(() => {
        if (!isLoading && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [isLoading])

    // Listen for custom AI messages (e.g. from document upload in Sidebar)
    useEffect(() => {
        const handleNewMessage = (event: any) => {
            const { content, sender } = event.detail
            const newMessage: Message = {
                id: Date.now(),
                content,
                sender,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, newMessage])
        }

        window.addEventListener('new-ai-message' as any, handleNewMessage)
        return () => window.removeEventListener('new-ai-message' as any, handleNewMessage)
    }, [])

    const handleSend = async () => {
        if (!input.trim() || isLoading || !userId) return

        const userMessage: Message = {
            id: Date.now(),
            content: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        setMessages(prev => [...prev, userMessage])
        const messageText = input
        setInput('')
        setIsLoading(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,  // Changed from session_id to user_id
                    message: messageText,
                }),
            })

            if (!response.ok) throw new Error('Failed to send message')

            const data = await response.json()

            const aiResponse: Message = {
                id: Date.now() + 1,
                content: data.question,
                sender: 'assistant',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                documents: data.documents
            }

            setMessages(prev => [...prev, aiResponse])
        } catch (error) {
            console.error('Error sending message:', error)
            const errorMessage: Message = {
                id: Date.now() + 1,
                content: "Sorry, something went wrong. Can you say that again?",
                sender: 'assistant',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        const el = e.target
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }

    // Show loading if Clerk is still loading
    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex gap-2">
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-screen bg-background relative overflow-hidden">
            {/* Glossy Top Navigation Bar */}
            <header className="sticky top-0 z-10 flex items-center justify-center h-14 bg-background/80 backdrop-blur-md px-4 border-b border-border/10 flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/50 transition-colors cursor-default">
                    <h1 className="text-sm font-semibold tracking-tight text-foreground/80">Placement AI</h1>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                    <span className="text-xs text-muted-foreground font-medium">Draft</span>
                </div>
            </header>

            {/* Conversation Area */}
            <div
                ref={scrollAreaRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto scroll-smooth"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
            >
                <div className="max-w-3xl mx-auto px-4 md:px-6 pb-6 space-y-5">
                    {/* Welcome Hero: Visible at the start of a conversation */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-24 pb-12 animate-fade-in" role="presentation">
                            <div className="h-14 w-14 rounded-[14px] bg-foreground/[0.03] border border-border/50 flex items-center justify-center mb-6 shadow-sm" aria-hidden="true">
                                <GraduationCap className="h-7 w-7 text-foreground/80" />
                            </div>
                            <h2 className="text-2xl font-semibold tracking-tight text-center text-foreground/90">
                                How can I help you today?
                            </h2>
                        </div>
                    )}

                    {/* Chat Bubbles */}
                    <div className="space-y-6 pt-10">
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                userImage={preferences?.profile_pic}
                                userAvatar={preferences?.avatar}
                                clerkImage={user?.imageUrl}
                            />
                        ))}
                    </div>

                    {/* Floating Scroll to Bottom Button */}
                    <button
                        onClick={scrollToBottom}
                        className={cn(
                            "fixed bottom-24 left-1/2 -translate-x-1/2 z-20 h-9 w-9 bg-background border border-border/60 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 click-scale",
                            showScrollButton ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
                        )}
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown className="h-4 w-4 text-foreground/70" />
                    </button>
                    {/* AI Loading State (Typing Indicator) */}
                    {isLoading && (
                        <div className="flex items-center gap-3 max-w-3xl mx-auto animate-fade-in">
                            <div className="h-7 w-7 rounded-full bg-foreground/5 border border-border/50 flex items-center justify-center flex-shrink-0">
                                <div className="h-3.5 w-3.5 border-[1.5px] border-muted-foreground/30 border-t-muted-foreground/70 rounded-full animate-spin-gpu gpu-anim" />
                            </div>
                            <div className="flex gap-1 py-2">
                                <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '0ms' }} />
                                <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '150ms' }} />
                                <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Sticky Input Area */}
            <div className="px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background to-transparent">
                <div className="max-w-3xl mx-auto">
                    <div className="relative rounded-[16px] border border-border/50 bg-background shadow-lg shadow-black/5 focus-within:border-foreground/20 focus-within:shadow-xl transition-all duration-300">
                        <textarea
                            ref={textareaRef}
                            id="chat-input"
                            placeholder="Message Placement AI..."
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            rows={1}
                            aria-label="Message Placement AI"
                            className="w-full resize-none bg-transparent py-4 pl-5 pr-16 text-[15px] focus:outline-none placeholder:text-muted-foreground/40 max-h-[200px]"
                            autoFocus
                        />
                        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-3">
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                aria-label="Send message"
                                className="h-9 w-9 rounded-[10px] bg-foreground text-background flex items-center justify-center transition-all hover:bg-foreground/90 disabled:opacity-20 disabled:cursor-not-allowed click-scale"
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin-gpu gpu-anim" aria-hidden="true" />
                                ) : (
                                    <ArrowUp className="h-5 w-5" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 opacity-60">
                        <span className="text-[11px] font-medium text-muted-foreground">Press</span>
                        <kbd className="px-1.5 py-0.5 rounded-md border border-border/50 bg-foreground/5 text-[10px] font-semibold text-muted-foreground">Enter</kbd>
                        <span className="text-[11px] font-medium text-muted-foreground">to send</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
