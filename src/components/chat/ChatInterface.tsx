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
    onActionPayload?: (payload: import('../action/ActionWorkspace').ActionPayload) => void
}

export function ChatInterface({ activeChatId, onChatStarted, onActionPayload }: ChatInterfaceProps) {
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

    // Initialization and Polling: load chat history and listen for proactive messages
    useEffect(() => {
        if (!isLoaded || !isSignedIn || !userId) return

        let isPollingActive = true

        async function fetchHistory() {
            try {
                const response = await fetch(`/api/user/${userId}`)
                if (response.ok) {
                    const data = await response.json()
                    const history = data.chat_history || []

                    if (history.length === 0) {
                        setMessages([])
                        return
                    }

                    // Format messages
                    const formattedMessages = history.map((msg: any, i: number) => ({
                        // Give it a stable ID based on timestamp and index, or default to a fallback
                        id: msg.timestamp ? new Date(msg.timestamp).getTime() + i : Date.now() - (history.length - i),
                        content: msg.content,
                        sender: (msg.role === 'assistant' || msg.role === 'ai') ? 'assistant' : 'user',
                        timestamp: msg.timestamp
                            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        documents: msg.documents
                    }))

                    setMessages(prev => {
                        // On first load, replace exactly
                        if (prev.length === 0) return formattedMessages

                        // Deduplicate: Only add messages from the server that don't exist locally.
                        // We compare content and sender role to identify "new" messages.
                        const newMsgs = formattedMessages.filter((serverMsg: Message) =>
                            !prev.some((localMsg: Message) =>
                                localMsg.content.trim() === serverMsg.content.trim() &&
                                localMsg.sender === serverMsg.sender
                            )
                        )

                        if (newMsgs.length > 0) {
                            console.log(`📡 Polling found ${newMsgs.length} new messages:`, newMsgs)
                            return [...prev, ...newMsgs]
                        }
                        return prev
                    })
                }
            } catch (error) {
                console.error('Error loading user history:', error)
            }
        }

        // 1. Initial Load
        if (initializedRef.current !== userId) {
            setIsLoading(true)
            initializedRef.current = userId
            fetchHistory().finally(() => setIsLoading(false))
        }

        // 2. Passive Polling (every 5 seconds) to catch PGE proactive messages injected by the backend
        const pollInterval = setInterval(() => {
            if (isPollingActive) fetchHistory()
        }, 5000)

        return () => {
            isPollingActive = false
            clearInterval(pollInterval)
        }
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

            if (!response.ok) {
                let errorMessage = `Failed to send message (${response.status})`
                try {
                    const payload = await response.json()
                    const detail = payload?.detail || payload?.error
                    if (detail) errorMessage = String(detail)
                } catch {
                    // Keep status-based message if response body is not JSON
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()

            const aiResponse: Message = {
                id: Date.now() + 1,
                content: data.question,
                sender: 'assistant',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                documents: data.documents
            }

            setMessages(prev => [...prev, aiResponse])

            // Notify Dashboard of backend-authoritative profile progress
            if (typeof data.progress === 'number') {
                window.dispatchEvent(new CustomEvent('profile-progress-updated', {
                    detail: { progress: data.progress }
                }))
            }

            // Open Action Workspace if agent returned an action payload
            if (data.action && onActionPayload) {
                onActionPayload(data.action)
            }
        } catch (error) {
            console.error('Error sending message:', error)
            const fallbackText = "Sorry, something went wrong. Can you say that again?"
            const detail = error instanceof Error ? error.message : ''
            const errorMessage: Message = {
                id: Date.now() + 1,
                content: detail ? `Error: ${detail}` : fallbackText,
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
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            {/* Contextual Header removed - handled by Dashboard */}

            {/* Conversation Area */}
            <div
                ref={scrollAreaRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-6"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
            >
                <div className="max-w-4xl mx-auto px-6 pb-6 space-y-5">
                    {/* Welcome Hero: Only visible before first message */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-24 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500" role="presentation">
                            <div className="mb-6 opacity-40" aria-hidden="true">
                                <GraduationCap className="h-6 w-6 text-foreground" />
                            </div>
                            <h2 className="text-xl font-medium tracking-tight text-center text-foreground">
                                How can I help you today?
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground/70 text-center max-w-xs">Ask me about admissions, documents, or university strategy.</p>
                        </div>
                    )}

                    {/* Chat Bubbles */}
                    <div className="space-y-6">
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

            {/* Chat Input Area */}
            <div className="px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent relative z-20">
                <div className="max-w-3xl mx-auto">
                    <div className="relative border-t border-border/10 bg-background pt-2 transition-colors duration-200">
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
                            className="w-full resize-none bg-transparent py-3 pl-2 pr-12 text-sm focus:outline-none placeholder:text-muted-foreground/30 max-h-[200px]"
                            autoFocus
                        />
                        <div className="absolute right-0 bottom-3 flex items-center gap-2">
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                aria-label="Send message"
                                className="h-7 w-7 rounded-full bg-foreground/[0.04] text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <div className="h-3.5 w-3.5 border-[1.5px] border-foreground border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                ) : (
                                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-center mt-2 text-[10px] text-muted-foreground/30 font-medium">Enter to send · Shift+Enter for new line</p>
                </div>
            </div>

        </div>
    )
}
