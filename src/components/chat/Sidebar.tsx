'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useView } from '@/components/providers/ViewProvider'
import { useUserPreferences } from '@/components/providers/UserPreferencesProvider'
import {
    Moon,
    Sun,
    LogOut,
    GraduationCap,
    FileText,
    Upload,
    Trash2,
    Loader2,
    Search,
    Eye,
    Sparkles,
    PanelLeftClose,
    PanelLeftOpen,
    LayoutDashboard,
    MessageSquare,
    Phone
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Document {
    id: number
    document_name: string
    file_name: string
    file_size: number
    uploaded_at: string
}

interface SidebarProps {
    activeView: 'chat' | 'dashboard'
    onSelectChat: () => void
    onSelectDashboard: () => void
    onViewDocument: (doc: Document) => void
    isCollapsed: boolean
    onToggleCollapse: () => void
    onOpenSearch: () => void
}

export function Sidebar({
    activeView,
    onSelectChat,
    onSelectDashboard,
    onViewDocument,
    isCollapsed,
    onToggleCollapse,
    onOpenSearch
}: SidebarProps) {
    const { user, isLoaded, isSignedIn } = useUser()
    const { signOut } = useClerk()
    const { theme, setTheme } = useTheme()
    const { updatePreferences } = useUserPreferences()
    const [mounted, setMounted] = useState(false)
    const [documents, setDocuments] = useState<Document[]>([])
    const [isDocsLoading, setIsDocsLoading] = useState(false)
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [docName, setDocName] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const userId = user?.id  // Get Clerk user ID

    useEffect(() => {
        setMounted(true)
        if (isSignedIn && userId) {
            fetchDocuments()
        }
    }, [isSignedIn, userId])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                onOpenSearch()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onOpenSearch])

    const fetchDocuments = async () => {
        if (!userId) return

        setIsDocsLoading(true)
        try {
            // Fetch documents for this specific user
            const response = await fetch(`/api/documents?user_id=${userId}`)
            if (response.ok) {
                const data = await response.json()
                setDocuments(data)
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error)
        } finally {
            setIsDocsLoading(false)
        }
    }

    const handleUpload = async () => {
        if (!docName.trim() || !selectedFile || !userId) return
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('document_name', docName.trim())
            formData.append('file', selectedFile)
            formData.append('user_id', userId)

            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const data = await response.json()

                // If there's an immediate follow-up question, add it to chat
                if (data.follow_up) {
                    // Dispatch a custom event that ChatInterface can listen to
                    window.dispatchEvent(new CustomEvent('new-ai-message', {
                        detail: {
                            content: data.follow_up,
                            sender: 'assistant'
                        }
                    }));
                }

                setDocName('')
                setSelectedFile(null)
                setShowUploadForm(false)
                fetchDocuments()
            }
        } catch (error) {
            console.error('Upload error:', error)
        } finally {
            setIsUploading(false)
        }
    }
    const handleDeleteDocument = async (docId: number) => {
        if (!userId) return

        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
            })
            if (response.ok) {
                setDocuments(documents.filter(d => d.id !== docId))
            }
        } catch (error) {
            console.error('Delete error:', error)
        }
    }

    if (!mounted || !isLoaded) return <div className={cn("h-screen sidebar-bg border-r border-border/60 shrink-0", isCollapsed ? "w-16" : "w-[280px]")} />

    return (
        <div className={cn(
            "h-screen sidebar-bg flex flex-col border-r border-border/60 transition-all duration-300 relative group/sidebar",
            isCollapsed ? "w-16" : "w-[280px]"
        )}>
            {/* Top Bar */}
            <div className={cn("flex flex-col gap-4 px-3 pt-4 pb-2", isCollapsed && "items-center px-0")}>
                {!isCollapsed ? (
                    <div className="flex items-center justify-between px-1 mb-2">
                        <div className="flex items-center gap-2.5">
                            <div className="h-[22px] w-[22px] rounded-[4px] bg-foreground flex items-center justify-center shadow-sm">
                                <GraduationCap className="h-3.5 w-3.5 text-background" />
                            </div>
                            <span className="font-semibold text-[14px] tracking-tight text-foreground/90">Placement AI</span>
                        </div>
                        <button
                            onClick={onToggleCollapse}
                            className="p-1 rounded-[4px] hover:bg-accent text-muted-foreground hover:text-foreground transition-all click-scale"
                            aria-label="Collapse sidebar"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 pt-1 mb-2">
                        <button
                            onClick={onToggleCollapse}
                            className="h-8 w-8 rounded-[6px] hover:bg-accent flex items-center justify-center transition-all click-scale group"
                            aria-label="Expand sidebar"
                            title="Expand sidebar"
                        >
                            <PanelLeftOpen className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
                        </button>
                        <div className="h-[22px] w-[22px] rounded-[4px] bg-foreground flex items-center justify-center shadow-sm">
                            <GraduationCap className="h-3.5 w-3.5 text-background" />
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className={cn("flex flex-col gap-0.5 px-3 mb-2", isCollapsed && "px-1.5 items-center")}>
                <button
                    onClick={onSelectChat}
                    title="Chat Consultant"
                    className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] font-medium rounded-[6px] transition-all group",
                        activeView === 'chat'
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                >
                    <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
                    {!isCollapsed && <span>Chat Consultant</span>}
                </button>
                <button
                    onClick={onSelectDashboard}
                    title="My Dashboard"
                    className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] font-medium rounded-[6px] transition-all group",
                        activeView === 'dashboard'
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                >
                    <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden="true" />
                    {!isCollapsed && <span>My Dashboard</span>}
                </button>
                <button
                    onClick={() => { }}
                    title="Calls"
                    className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] font-medium rounded-[6px] transition-all group opacity-50 cursor-not-allowed",
                        "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                >
                    <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
                    {!isCollapsed && <span>Calls</span>}
                </button>
            </div>

            <div className="h-px w-full bg-border/40 mx-auto max-w-[90%] mb-4" />

            {/* Documents Area */}
            <div className={cn("flex-1 overflow-y-auto px-3 py-2", isCollapsed && "flex flex-col items-center gap-4 py-4")}>
                {!isCollapsed ? (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between px-2 mb-1.5 group/docheader cursor-default">
                            <span className="text-[11px] font-semibold text-muted-foreground">My Documents</span>
                            <button
                                onClick={() => setShowUploadForm(!showUploadForm)}
                                className="h-5 w-5 rounded-[4px] hover:bg-accent flex items-center justify-center opacity-0 group-hover/docheader:opacity-100 transition-opacity"
                                aria-label="Upload Document"
                                title="Upload Document"
                            >
                                <Upload className="h-[14px] w-[14px] text-muted-foreground hover:text-foreground" aria-hidden="true" />
                            </button>
                        </div>

                        {showUploadForm && (
                            <div className="p-2.5 bg-accent/30 rounded-[8px] border border-border/40 space-y-2.5 mb-3 mx-1 animate-modal-in">
                                <input
                                    value={docName}
                                    onChange={e => setDocName(e.target.value)}
                                    placeholder="Document name..."
                                    className="w-full h-7 px-2 text-[12px] bg-background rounded-[4px] border border-border/50 outline-none focus:border-foreground/30 transition-colors shadow-sm"
                                />
                                <input
                                    type="file"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:bg-foreground file:text-background file:border-0 hover:file:bg-foreground/90 cursor-pointer"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowUploadForm(false)}
                                        className="flex-1 h-7 bg-background text-foreground rounded-[4px] text-[11px] font-medium border border-border/50 hover:bg-accent transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={isUploading || !docName || !selectedFile}
                                        className="flex-1 h-7 bg-foreground text-background rounded-[4px] text-[11px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                        {isUploading ? "..." : "Upload"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 mt-2">
                            {isDocsLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : documents.length > 0 ? (
                                documents.map(doc => (
                                    <div key={doc.id} className="group/doc relative flex items-center gap-2.5 p-1.5 px-2 rounded-[6px] hover:bg-accent/60 transition-colors mb-0.5 cursor-pointer">
                                        <div className="h-5 w-5 rounded-[4px] bg-foreground/[0.03] flex items-center justify-center flex-shrink-0 border border-border/30">
                                            <FileText className="h-3 w-3 text-muted-foreground/70" />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-8">
                                            <p className="text-[12px] font-medium text-foreground/90 truncate leading-tight">{doc.document_name}</p>
                                        </div>
                                        <div className="absolute right-1 opacity-0 group-hover/doc:opacity-100 transition-opacity flex items-center gap-0.5 bg-gradient-to-l from-sidebar-bg via-sidebar-bg to-transparent pl-4 py-1">
                                            <button
                                                onClick={() => onViewDocument(doc)}
                                                className="p-1 rounded-[4px] hover:bg-background text-muted-foreground hover:text-foreground"
                                                aria-label={`View ${doc.document_name}`}
                                                title="View"
                                            >
                                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDocument(doc.id)}
                                                className="p-1 rounded-[4px] hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                                                aria-label={`Delete ${doc.document_name}`}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-xs text-muted-foreground/60">
                                    No documents uploaded yet.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-5">
                        <button
                            onClick={() => setShowUploadForm(!showUploadForm)}
                            className="h-10 w-10 rounded-xl bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-all click-scale group"
                            title="Upload Document"
                        >
                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                        </button>
                        {documents.length > 0 && (
                            <span className="text-[10px] font-bold opacity-60">
                                {documents.length} {documents.length === 1 ? 'Doc' : 'Docs'}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Profile */}
            <div className={cn("border-t border-border/30 p-3 mt-auto", isCollapsed && "px-0 pb-4 flex justify-center")}>
                {!isCollapsed ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] hover:bg-accent/50 transition-colors text-left group">
                                <Avatar className="h-[24px] w-[24px] rounded-full ring-1 ring-border/50 shadow-sm">
                                    <AvatarImage src={user?.imageUrl} />
                                    <AvatarFallback className="rounded-full text-[10px] bg-foreground/5">{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate text-foreground/90 group-hover:text-foreground">{user?.firstName || 'User'}</p>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-52 mb-1 p-1 rounded-[8px] border border-border/50 shadow-lg">
                            <DropdownMenuItem className="gap-2 font-medium text-[11px] uppercase text-muted-foreground px-2 py-1.5 cursor-default focus:bg-transparent">Themes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updatePreferences({ theme: 'light' })} className={cn("gap-2 rounded-[4px] cursor-pointer", theme === 'light' && "bg-accent")}>
                                <div className="h-2.5 w-2.5 rounded-[2px] bg-slate-200 border border-slate-300" />
                                <span className="text-[13px]">Minimalist Slate</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updatePreferences({ theme: 'dark' })} className={cn("gap-2 rounded-[4px] cursor-pointer", theme === 'dark' && "bg-accent")}>
                                <div className="h-2.5 w-2.5 rounded-[2px] bg-slate-800 border border-slate-900" />
                                <span className="text-[13px]">Midnight Obsidian</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updatePreferences({ theme: 'solar' })} className={cn("gap-2 rounded-[4px] cursor-pointer", theme === 'solar' && "bg-accent")}>
                                <div className="h-2.5 w-2.5 rounded-[2px] bg-orange-200 border border-orange-300" />
                                <span className="text-[13px]">Solar Sand</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updatePreferences({ theme: 'emerald' })} className={cn("gap-2 rounded-[4px] cursor-pointer", theme === 'emerald' && "bg-accent")}>
                                <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-900 border border-emerald-950" />
                                <span className="text-[13px]">Emerald Forest</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/40 my-1" />
                            <DropdownMenuItem onClick={() => signOut({ redirectUrl: '/sign-in' })} className="text-red-500 gap-2 rounded-[4px] cursor-pointer focus:text-red-500 focus:bg-red-500/10">
                                <LogOut className="h-3.5 w-3.5" />
                                <span className="text-[13px]">Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="click-scale">
                                <Avatar className="h-9 w-9 hover:ring-2 hover:ring-foreground transition-all ring-offset-2 ring-offset-background">
                                    <AvatarImage src={user?.imageUrl} />
                                    <AvatarFallback>{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="right" className="w-48 ml-2">
                            <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                Switch Theme
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => signOut({ redirectUrl: '/sign-in' })} className="text-red-500 gap-2">
                                <LogOut className="h-4 w-4" />
                                Sign Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    )
}
