'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Search,
    MessageSquare,
    Clock,
    ArrowRight,
    SearchX,
    Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpotlightSearchProps {
    isOpen: boolean
    onClose: () => void
    sessions: any[]
    onSelectChat: (sessionId: string) => void
}

export function SpotlightSearch({ isOpen, onClose, sessions, onSelectChat }: SpotlightSearchProps) {
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Filter sessions based on query
    const results = useMemo(() => {
        if (!query.trim()) return sessions.slice(0, 5) // Show recent 5 if empty
        const q = query.toLowerCase()
        return sessions.filter(s =>
            (s.session_name || '').toLowerCase().includes(q) ||
            s.session_id.toLowerCase().includes(q)
        ).slice(0, 8)
    }, [query, sessions])

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 10)
        }
    }, [isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
            if (e.key === 'ArrowDown' && isOpen) {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length))
            }
            if (e.key === 'ArrowUp' && isOpen) {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length))
            }
            if (e.key === 'Enter' && isOpen && results.length > 0) {
                e.preventDefault()
                onSelectChat(results[selectedIndex].session_id)
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, results, selectedIndex, onClose, onSelectChat])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:px-6">
            {/* Backdrop with frost effect */}
            <div
                className="absolute inset-0 bg-background/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Search Container - macOS inspired */}
            <div className="relative w-full max-w-2xl bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center px-4 h-16 border-b border-border/40 bg-accent/20">
                    <Search className="h-5 w-5 text-muted-foreground mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search your conversations..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setSelectedIndex(0)
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground/40 font-medium"
                        aria-label="Search conversations"
                        aria-autocomplete="list"
                        aria-controls="search-results"
                    />
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/5 border border-border/10">
                        <kbd className="text-[10px] font-bold opacity-40">ESC</kbd>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-none" id="search-results" role="listbox">
                    {results.length > 0 ? (
                        <div className="space-y-1">
                            {results.map((result, idx) => (
                                <button
                                    key={result.session_id}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    onClick={() => {
                                        onSelectChat(result.session_id)
                                        onClose()
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all group text-left",
                                        selectedIndex === idx ? "bg-foreground text-background" : "hover:bg-accent/40"
                                    )}
                                    role="option"
                                    aria-selected={selectedIndex === idx}
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                        selectedIndex === idx ? "bg-background/20" : "bg-accent/60"
                                    )}>
                                        <MessageSquare className={cn(
                                            "h-5 w-5",
                                            selectedIndex === idx ? "text-background" : "text-muted-foreground"
                                        )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="font-semibold text-sm truncate pr-4">
                                                {result.session_name || `Untitled Chat`}
                                            </p>
                                            <div className={cn(
                                                "flex items-center text-[10px] uppercase tracking-widest font-bold opacity-40",
                                                selectedIndex === idx && "text-background"
                                            )}>
                                                <Clock className="h-3 w-3 mr-1" />
                                                {new Date(result.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                        <p className={cn(
                                            "text-xs line-clamp-1 opacity-60",
                                            selectedIndex === idx ? "text-background" : "text-muted-foreground"
                                        )}>
                                            <Hash className="inline h-3 w-3 mr-0.5" />
                                            {result.session_id}
                                        </p>
                                    </div>
                                    <ArrowRight className={cn(
                                        "h-4 w-4 transition-transform",
                                        selectedIndex === idx ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                                    )} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4 transition-all animate-in fade-in zoom-in-95">
                            <div className="h-12 w-12 rounded-full bg-accent/30 flex items-center justify-center mb-4">
                                <SearchX className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-sm font-semibold opacity-80 mb-1">No results for "{query}"</h3>
                            <p className="text-xs text-muted-foreground text-center">Try searching for a different keyword or chat ID.</p>
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="px-4 h-10 border-t border-border/40 bg-accent/10 flex items-center justify-between text-[10px] text-muted-foreground/60 font-medium">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-background border border-border/40 h-4 min-w-[16px] flex items-center justify-center">↓↑</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-background border border-border/40 h-4 min-w-[16px] flex items-center justify-center">↵</kbd> Open Chat</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
