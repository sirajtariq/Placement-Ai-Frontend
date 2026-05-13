'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
    Plus, Clock, MapPin, GraduationCap,
    MoreHorizontal, ChevronRight, AlertCircle,
    CheckCircle2, XCircle, Info, Sparkles,
    Calendar, Building2, Trash2, Loader2,
    Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'

import { MomentumPanel } from './MomentumPanel'

interface Application {
    id: number
    university: string
    course: string
    status: 'applied' | 'pending' | 'interview' | 'offer' | 'rejected'
    deadline?: string
    documents: any[]
    interview_prep?: {
        questions: string[]
        tips: string[]
        framework: string
    }
    rejection_analysis?: any
    created_at: string
    updated_at?: string
}

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'text-zinc-500', bg: 'bg-zinc-500/5', border: 'border-zinc-500/10', icon: Clock },
    applied: { label: 'Applied', color: 'text-blue-600', bg: 'bg-blue-600/5', border: 'border-blue-600/10', icon: CheckCircle2 },
    interview: { label: 'Interview', color: 'text-indigo-600', bg: 'bg-indigo-600/5', border: 'border-indigo-600/10', icon: Info },
    offer: { label: 'Offer', color: 'text-emerald-600', bg: 'bg-emerald-600/5', border: 'border-emerald-600/10', icon: GraduationCap },
    rejected: { label: 'Rejected', color: 'text-slate-900', bg: 'bg-slate-900/5', border: 'border-slate-900/10', icon: XCircle }
}

export function ApplicationTracker() {
    const { user } = useUser()
    const userId = user?.id
    const [applications, setApplications] = useState<Application[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [newApp, setNewApp] = useState({ university: '', course: '', deadline: '' })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
    const selectedApp = applications.find(a => a.id === selectedAppId) || null
    const [isGeneratingPrep, setIsGeneratingPrep] = useState<number | null>(null)

    useEffect(() => {
        if (userId) fetchApplications()
    }, [userId])

    async function fetchApplications() {
        try {
            const res = await fetch(`/api/applications/${userId}`)
            const data = await res.json()
            setApplications(data)
        } catch (e) {
            console.error('Failed to fetch applications', e)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleAdd() {
        if (!newApp.university || !newApp.course) return
        setIsSubmitting(true)
        try {
            await fetch(`/api/applications/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newApp)
            })
            setNewApp({ university: '', course: '', deadline: '' })
            setIsAdding(false)
            fetchApplications()
        } catch (e) {
            console.error('Failed to add application', e)
        } finally {
            setIsSubmitting(false)
        }
    }

    async function updateStatus(appId: number, status: string) {
        try {
            await fetch(`/api/applications/${userId}/${appId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            fetchApplications()
        } catch (e) {
            console.error('Failed to update status', e)
        }
    }

    async function handleDelete(appId: number) {
        if (!confirm('Are you sure you want to remove this application?')) return
        try {
            await fetch(`/api/applications/${userId}/${appId}`, { method: 'DELETE' })
            fetchApplications()
        } catch (e) {
            console.error('Failed to delete', e)
        }
    }

    async function generatePrep(appId: number) {
        if (!userId) {
            console.error('No userId found for prep generation')
            return
        }
        setIsGeneratingPrep(appId)
        console.log(`Starting prep generation for app ${appId}`)
        try {
            const res = await fetch(`/api/applications/${userId}/${appId}/prep`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) {
                const errText = await res.text()
                throw new Error(`Prep generation failed: ${res.status} - ${errText}`)
            }

            const data = await res.json()
            console.log('Prep data received:', data)
            // Update local state with generated prep
            setApplications(prev => prev.map(app => app.id === appId ? { ...app, interview_prep: data } : app))
            // No need to manually update selectedAppId since it's derived
        } catch (e) {
            console.error('Failed to generate prep:', e)
            alert('Failed to generate interview prep. Please try again.')
        } finally {
            setIsGeneratingPrep(null)
        }
    }

    const onDragStart = (e: React.DragEvent, appId: number) => {
        e.dataTransfer.setData('applicationId', String(appId))
        e.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const onDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        const appId = Number(e.dataTransfer.getData('applicationId'))
        if (!appId) return

        const app = applications.find(a => a.id === appId)
        if (app && app.status !== newStatus) {
            // Optimistic update
            setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus as any } : a))
            updateStatus(appId, newStatus)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Syncing your applications...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Dashboard Header ── */}
            <div className="flex items-end justify-between border-b border-border pb-6">
                <div className="space-y-1">
                    <h2 className="text-xl font-medium tracking-tight text-foreground">Application Management</h2>
                    <p className="text-xs text-muted-foreground font-medium">Strategic tracking of your academic trajectory.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-[11px] font-bold text-background transition-all hover:bg-foreground/90 active:scale-95"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Track New
                </button>
            </div>

            <MomentumPanel userId={userId || null} />

            {/* ── Kanban Sections ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => {
                    const config = STATUS_CONFIG[status]
                    const apps = applications.filter(a => a.status === status)
                    const Icon = config.icon

                    return (
                        <div
                            key={status}
                            className="flex flex-col gap-4"
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, status)}
                        >
                            <div className="flex items-center justify-between px-1 mb-1">
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                                    {config.label}
                                </h3>
                                <span className="text-[9px] font-mono text-muted-foreground/30">
                                    {apps.length}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 min-h-[160px] p-2 rounded-xl border border-border/30 bg-muted/20 transition-colors">
                                {apps.map(app => (
                                    <motion.div
                                        key={app.id}
                                        layoutId={String(app.id)}
                                        draggable
                                        onDragStart={(e) => onDragStart(e as any, app.id)}
                                        onClick={() => setSelectedAppId(app.id)}
                                        className="group relative flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-background transition-all cursor-grab active:cursor-grabbing hover:border-foreground/10 hover:shadow-sm"
                                    >
                                        <div className="space-y-0.5">
                                            <p className="text-[11px] font-semibold text-foreground leading-snug truncate">{app.university}</p>
                                            <p className="text-[9px] text-muted-foreground/40 font-medium truncate uppercase tracking-widest">{app.course}</p>
                                        </div>
                                        {app.deadline && (
                                            <p className="text-[9px] text-muted-foreground/30 font-medium">
                                                {new Date(app.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        )}
                                    </motion.div>
                                ))}

                                {apps.length === 0 && (
                                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30 grayscale pointer-events-none">
                                        <Building2 className="h-5 w-5 mb-2 text-muted-foreground" />
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Drop here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Add Modal ── */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-6 relative z-50"
                        >
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-foreground">Add Application</h3>
                                <p className="text-xs text-muted-foreground">Enter the details of your university application.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">University</label>
                                    <input
                                        autoFocus
                                        value={newApp.university}
                                        onChange={e => setNewApp({ ...newApp, university: e.target.value })}
                                        className="w-full rounded-lg bg-muted/60 border border-border px-3 py-2 text-sm outline-none focus:border-foreground/40 transition-all"
                                        placeholder="e.g. Stanford University"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Course</label>
                                    <input
                                        value={newApp.course}
                                        onChange={e => setNewApp({ ...newApp, course: e.target.value })}
                                        className="w-full rounded-lg bg-muted/60 border border-border px-3 py-2 text-sm outline-none focus:border-foreground/40 transition-all"
                                        placeholder="e.g. MS in Computer Science"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Deadline</label>
                                    <input
                                        type="date"
                                        value={newApp.deadline}
                                        onChange={e => setNewApp({ ...newApp, deadline: e.target.value })}
                                        className="w-full rounded-lg bg-muted/60 border border-border px-3 py-2 text-sm outline-none focus:border-foreground/40 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 rounded-lg border border-border bg-background py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={isSubmitting || !newApp.university || !newApp.course}
                                    className="flex-1 rounded-lg bg-foreground py-2.5 text-xs font-bold text-background hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Application'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Detailed/Prep View ── */}
            <AnimatePresence>
                {selectedApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="w-full max-w-2xl h-[80vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl flex flex-col scroller-style relative z-50"
                        >
                            <div className="sticky top-0 bg-card/80 backdrop-blur-md z-10 p-6 border-b border-border/60 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", STATUS_CONFIG[selectedApp.status].border, STATUS_CONFIG[selectedApp.status].bg)}>
                                        {React.createElement(STATUS_CONFIG[selectedApp.status].icon, { className: cn("h-5 w-5", STATUS_CONFIG[selectedApp.status].color) })}
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-base font-medium text-foreground leading-none tracking-tight">{selectedApp.university}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{selectedApp.course}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedAppId(null)} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-10">
                                {/* ── Status Bar ── */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Current Status</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    updateStatus(selectedApp.id, status)
                                                }}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                                    selectedApp.status === status
                                                        ? cn(STATUS_CONFIG[status].border, STATUS_CONFIG[status].bg, STATUS_CONFIG[status].color)
                                                        : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
                                                )}
                                            >
                                                {STATUS_CONFIG[status].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Interview Prep (AI Section) ── */}
                                {selectedApp.status === 'interview' && (
                                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 space-y-4 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-900 border border-purple-500/30 flex items-center justify-center shadow-sm">
                                                <Sparkles className="h-4 w-4 text-purple-600" />
                                            </div>
                                            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">AI Interview Preparation</h4>
                                        </div>
                                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                                            Congratulations! Generate a personalized AI training prep packet. The comprehensive interview strategy and expected questions will be delivered straight to your chat.
                                        </p>
                                        <div className="pt-2">
                                            <button
                                                onClick={() => generatePrep(selectedApp.id)}
                                                disabled={isGeneratingPrep === selectedApp.id}
                                                className="px-5 py-2 rounded-full bg-purple-600 text-white text-[12px] font-bold hover:bg-purple-700 transition-all disabled:opacity-50 shadow-sm"
                                            >
                                                {isGeneratingPrep === selectedApp.id ? 'Generating Strategy...' : 'Start Training Session'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ── Rejection Recovery ── */}
                                {selectedApp.status === 'rejected' && (
                                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                                                <AlertCircle className="h-4 w-4 text-rose-600" />
                                            </div>
                                            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-300">Rejection Analysis</h4>
                                        </div>
                                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                                            Rejections are part of the process. We're currently analyzing why this might have happened and adjusting your plan.
                                        </p>
                                        <div className="p-4 rounded-xl bg-background/50 border border-rose-500/10">
                                            <h5 className="text-[11px] font-bold uppercase tracking-widest text-rose-600/70 mb-2">Next Steps</h5>
                                            <p className="text-[13px] text-foreground/80 leading-relaxed">
                                                Review your **Backup Plan B** in the Goals tab. We've shifted focus to optimize your application for {selectedApp.university}'s competitors.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ── Offer Celebration ── */}
                                {selectedApp.status === 'offer' && (
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-4">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                                            <Award className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xl font-bold text-foreground">Congratulations!</h4>
                                            <p className="text-sm text-muted-foreground">You've secured an offer from {selectedApp.university}.</p>
                                        </div>
                                        <div className="flex justify-center gap-2 pt-2">
                                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Official Offer</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── General Info ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Date Tracked</h5>
                                        <p className="text-sm font-medium text-foreground/80">{new Date(selectedApp.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Last Updated</h5>
                                        <p className="text-sm font-medium text-foreground/80">{new Date(selectedApp.updated_at || selectedApp.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(selectedApp.id)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-500/20 text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/5 transition-all text-xs font-bold"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete Application
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    )
}

function getNextStatus(current: string): string {
    const sequence = ['pending', 'applied', 'interview', 'offer']
    const idx = sequence.indexOf(current)
    if (idx === -1 || idx === sequence.length - 1) return current
    return sequence[idx + 1]
}

import React from 'react'
import { Award } from 'lucide-react'
