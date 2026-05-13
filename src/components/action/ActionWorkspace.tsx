'use client'

import { useState, useEffect } from 'react'
import {
    ExternalLink, CheckSquare, Square, AlertTriangle,
    Bookmark, Flag, HelpCircle, X, Shield, Globe,
    ChevronDown, ChevronUp, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ActionPayload {
    type: 'open_page'
    action_id: string
    action_type: string
    target_name: string
    official_url: string
    page_title: string
    domain: string
    confidence: number
    verification_status: 'official' | 'likely_official' | 'unverified' | 'unofficial'
    reason_for_opening: string
    next_step_instruction: string
    required_info: string[]
    required_documents: string[]
    checklist: string[]
}

interface ActionWorkspaceProps {
    action: ActionPayload
    userId: string
    onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function VerificationBadge({ status, confidence }: { status: string; confidence: number }) {
    const pct = Math.round(confidence * 100)
    if (status === 'official') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                <Shield className="h-2.5 w-2.5" /> Official · {pct}%
            </span>
        )
    }
    if (status === 'likely_official') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-2.5 w-2.5" /> Likely Official · {pct}%
            </span>
        )
    }
    return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/30 border border-border rounded-full px-2 py-0.5">
            <Globe className="h-2.5 w-2.5" /> Unverified · {pct}%
        </span>
    )
}

function ActionTypeLabel({ type }: { type: string }) {
    const labels: Record<string, string> = {
        university_application: 'University Application',
        scholarship_application: 'Scholarship Application',
        test_booking: 'Test Booking',
        visa_info: 'Visa Information',
        program_research: 'Program Research',
        deadline_check: 'Deadline Check',
        requirement_check: 'Requirements',
        contact_office: 'Contact Office',
        other: 'Reference',
    }
    return <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{labels[type] ?? type}</span>
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ActionWorkspace({ action, userId, onClose }: ActionWorkspaceProps) {
    const [checklist, setChecklist] = useState<boolean[]>(() =>
        Array(action.checklist.length).fill(false)
    )
    const [iframeBlocked, setIframeBlocked] = useState(false)
    const [iframeLoaded, setIframeLoaded] = useState(false)
    const [savingIndex, setSavingIndex] = useState<number | null>(null)
    const [status, setStatus] = useState<string>('opened')
    const [collapsed, setCollapsed] = useState(false)
    const [reportSent, setReportSent] = useState(false)

    // Mark as opened on mount
    useEffect(() => {
        fetch(`/api/actions/${action.action_id}/open?user_id=${encodeURIComponent(userId)}`, {
            method: 'POST'
        }).catch(() => {})
    }, [action.action_id, userId])

    // Many sites block iframes via X-Frame-Options / CSP.
    // We set a short timeout — if the iframe doesn't fire onLoad in time, assume blocked.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!iframeLoaded) setIframeBlocked(true)
        }, 8000)
        return () => clearTimeout(timer)
    }, [iframeLoaded])

    const toggleItem = async (idx: number) => {
        const next = [...checklist]
        next[idx] = !next[idx]
        setChecklist(next)
        setSavingIndex(idx)
        try {
            await fetch(
                `/api/actions/${action.action_id}/checklist?user_id=${encodeURIComponent(userId)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checklist_done: next }),
                }
            )
            if (next.every(Boolean)) setStatus('completed')
        } catch { /* non-critical */ }
        finally { setSavingIndex(null) }
    }

    const markDone = async () => {
        const all = Array(action.checklist.length).fill(true)
        setChecklist(all)
        setStatus('completed')
        await fetch(`/api/actions/${action.action_id}/complete?user_id=${encodeURIComponent(userId)}`, { method: 'POST' }).catch(() => {})
    }

    const markStuck = async () => {
        setStatus('blocked')
        await fetch(`/api/actions/${action.action_id}/stuck?user_id=${encodeURIComponent(userId)}`, { method: 'POST' }).catch(() => {})
    }

    const saveToRoadmap = async () => {
        await fetch(`/api/actions/${action.action_id}/save-to-roadmap?user_id=${encodeURIComponent(userId)}`, { method: 'POST' }).catch(() => {})
    }

    const reportWrong = async () => {
        setReportSent(true)
        await fetch(`/api/actions/${action.action_id}/report-wrong-page?user_id=${encodeURIComponent(userId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'User reported wrong page' }),
        }).catch(() => {})
    }

    const doneCount = checklist.filter(Boolean).length
    const totalCount = checklist.length
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    return (
        <div className="flex flex-col h-full bg-background border-l border-border/30 min-w-0">
            {/* ── Top bar ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20 bg-muted/10 shrink-0">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <ActionTypeLabel type={action.action_type} />
                        <VerificationBadge status={action.verification_status} confidence={action.confidence} />
                    </div>
                    <p className="text-[12px] font-semibold text-foreground/90 truncate mt-0.5">{action.page_title || action.target_name}</p>
                    {action.domain && (
                        <p className="text-[10px] text-muted-foreground/60 truncate">{action.domain}</p>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground transition-colors"
                        title="Collapse checklist"
                    >
                        {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                    <a
                        href={action.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground transition-colors"
                        title="Open in new tab"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground transition-colors"
                        title="Close"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* ── Next step instruction ─────────────────────────────────────── */}
            {action.next_step_instruction && (
                <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/10 shrink-0">
                    <p className="text-[11px] font-medium text-primary/80">
                        <span className="font-bold text-primary">Next: </span>
                        {action.next_step_instruction}
                    </p>
                </div>
            )}

            {/* ── Page view + checklist ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Page area */}
                <div className={cn("flex-1 relative overflow-hidden", collapsed && "hidden")}>
                    {!iframeBlocked ? (
                        <>
                            {!iframeLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/5">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            <iframe
                                src={action.official_url}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                onLoad={() => setIframeLoaded(true)}
                                onError={() => setIframeBlocked(true)}
                                title={action.page_title || action.target_name}
                            />
                        </>
                    ) : (
                        /* Fallback card when iframe is blocked */
                        <div className="flex flex-col items-center justify-center h-full p-6 gap-4 text-center">
                            <Globe className="h-10 w-10 text-muted-foreground/40" />
                            <div>
                                <p className="text-[13px] font-semibold text-foreground/80">{action.page_title || action.target_name}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{action.domain}</p>
                                <p className="text-[11px] text-muted-foreground/70 mt-2 max-w-xs">
                                    This page can't be embedded — open it directly below and follow the checklist.
                                </p>
                            </div>
                            {action.verification_status !== 'unverified' && (
                                <VerificationBadge status={action.verification_status} confidence={action.confidence} />
                            )}
                            <a
                                href={action.official_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Official Page
                            </a>
                            {action.verification_status === 'unverified' && (
                                <p className="text-[10px] text-amber-600 max-w-xs">
                                    Please verify this is the correct official page before proceeding.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Checklist ───────────────────────────────────────────────── */}
                <div className="shrink-0 border-t border-border/20 px-4 py-3 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Checklist
                        </span>
                        <span className="text-[10px] text-muted-foreground">{doneCount}/{totalCount} · {pct}%</span>
                    </div>
                    <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <ul className="space-y-1.5">
                        {action.checklist.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 cursor-pointer group" onClick={() => toggleItem(idx)}>
                                {savingIndex === idx ? (
                                    <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin text-primary" />
                                ) : checklist[idx] ? (
                                    <CheckSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                                ) : (
                                    <Square className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
                                )}
                                <span className={cn(
                                    "text-[11px] leading-relaxed select-none",
                                    checklist[idx] ? "line-through text-muted-foreground/50" : "text-foreground/80"
                                )}>
                                    {item}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* ── Action buttons ───────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-border/20 px-4 py-3 flex flex-wrap gap-2">
                {status !== 'completed' && (
                    <button
                        onClick={markDone}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <CheckSquare className="h-3 w-3" /> Mark step done
                    </button>
                )}
                {status === 'completed' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-600 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                        <CheckSquare className="h-3 w-3" /> Step complete
                    </span>
                )}
                <button
                    onClick={markStuck}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-foreground/70 text-[11px] font-semibold hover:bg-muted/60 transition-colors"
                >
                    <HelpCircle className="h-3 w-3" /> I'm stuck
                </button>
                <button
                    onClick={saveToRoadmap}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-foreground/70 text-[11px] font-semibold hover:bg-muted/60 transition-colors"
                >
                    <Bookmark className="h-3 w-3" /> Save to roadmap
                </button>
                {!reportSent ? (
                    <button
                        onClick={reportWrong}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-[11px] hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                        <Flag className="h-3 w-3" /> Wrong page?
                    </button>
                ) : (
                    <span className="text-[10px] text-muted-foreground px-1">Report sent.</span>
                )}
            </div>
        </div>
    )
}
