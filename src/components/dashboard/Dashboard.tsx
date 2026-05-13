'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useUserPreferences } from '@/components/providers/UserPreferencesProvider'
import {
    GraduationCap, Target, FileText,
    Bookmark, BookOpen, Layers, Award,
    Briefcase, Clock, Pencil, Check, X,
    TrendingUp, User, Sparkles, ChevronDown, BarChart3,
    ArrowUpRight, ChevronRight, Settings, CheckCircle2,
    MessageSquare, MapPin, Loader2, LogOut, Sun, Moon,
    Upload, Trash2, Eye, Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { useDocumentViewer } from '@/components/providers/DocumentViewerProvider'
import { ChatInterface } from '../chat/ChatInterface'
import { ActionWorkspace, type ActionPayload } from '../action/ActionWorkspace'
import { useClerk } from '@clerk/nextjs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
    student_name?: string
    location?: string
    life_stage?: string
    current_level?: string
    current_institution?: string
    current_field?: string
    current_courses?: string
    current_gpa?: string
    academic_confidence?: string
    past_qual_1?: string
    past_qual_2?: string
    strong_subjects?: string
    technical_skills?: string
    soft_skills?: string
    certifications?: string
    projects?: string
    internships?: string
    clubs?: string
    competitions?: string
    awards?: string
    future_direction?: string
    study_abroad?: string
    career_motivation?: string
    budget?: string
    test_scores?: string
    test_status?: string
    timeline?: string
    [key: string]: string | string[] | Record<string, unknown> | undefined
}

interface TodoSection {
    name: string
    tasks: string[]
}

export interface LinkItem {
    title: string
    url: string
    trust_score?: number
    domain?: string
    snippet?: string
}

export interface DocumentItem {
    name: string
    description: string
    url?: string
}

export interface StepItem {
    step_number: number
    title: string
    description: string
    links: string[]
}

interface TodoTask {
    goal: string
    sections?: TodoSection[]
    tasks?: string[]
    summary?: string
    steps?: StepItem[]
    links?: LinkItem[]
    documents?: DocumentItem[]
    warnings?: string[]
    primary?: any
    backup_1?: any
    backup_2?: any
    completed?: boolean[]
}

type RawTodosResponse =
    | Record<string, TodoSection[] | any>
    | Array<{ goal: string; sections?: TodoSection[]; tasks?: string[]; completed?: boolean[]; steps?: StepItem[]; primary?: any; backup_1?: any; backup_2?: any }>

interface Application {
    id: number
    university: string
    course: string
    status: 'applied' | 'pending' | 'interview' | 'offer' | 'rejected'
    deadline?: string
    documents: any[]
    interview_prep?: { questions: string[]; tips: string[]; framework: string }
    rejection_analysis?: any
    created_at: string
    updated_at?: string
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeTodos(raw: RawTodosResponse): TodoTask[] {
    if (!raw) return []
    if (!Array.isArray(raw)) {
        return Object.entries(raw).map(([goal, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value) && 'steps' in value) {
                const steps = value.steps as StepItem[]
                const flatTasks = steps.map((s: StepItem) => s.title)
                return { goal, steps, summary: value.summary, primary: value.primary, backup_1: value.backup_1, backup_2: value.backup_2, links: value.links, documents: value.documents, warnings: value.warnings, completed: flatTasks.map(() => false) }
            }
            if (Array.isArray(value) && value.length > 0) {
                if (typeof value[0] === 'object' && 'name' in value[0]) {
                    const sections = value as TodoSection[]
                    const flatTasks = sections.flatMap(s => s.tasks)
                    return { goal, sections, completed: flatTasks.map(() => false) }
                }
                const tasks = value as unknown as string[]
                return { goal, tasks, completed: tasks.map(() => false) }
            }
            return { goal, sections: [], completed: [] }
        })
    }
    return raw.map(item => {
        if (item.steps && item.steps.length > 0) {
            const flatTasks = item.steps.map((s: any) => s.title)
            const completed = item.completed && item.completed.length === flatTasks.length ? item.completed : flatTasks.map(() => false)
            return { ...item, completed }
        }
        if (item.sections && item.sections.length > 0) {
            const flatTasks = item.sections.flatMap((s: any) => s.tasks)
            const completed = item.completed && item.completed.length === flatTasks.length ? item.completed : flatTasks.map(() => false)
            return { ...item, completed }
        }
        if (item.tasks && item.tasks.length > 0) {
            const completed = item.completed && item.completed.length === item.tasks.length ? item.completed : item.tasks.map(() => false)
            return { ...item, completed }
        }
        return { ...item, sections: [], completed: [] }
    })
}

function flattenSections(todo: TodoTask): string[] {
    if (todo.steps && todo.steps.length > 0) return todo.steps.map(s => s.title)
    if (todo.sections && todo.sections.length > 0) return todo.sections.flatMap(s => s.tasks)
    return todo.tasks ?? []
}

// ─── Smart formatter ──────────────────────────────────────────────────────────

const ACRONYMS = new Set(['cs', 'ml', 'ai', 'nlp', 'cv', 'ds', 'it', 'ui', 'ux', 'api', 'gpa', 'gre', 'sat', 'ielts', 'toefl', 'gmat', 'phd', 'bsc', 'msc', 'ba', 'ma', 'mba', 'lums', 'iba', 'nust', 'fast', 'mit', 'uc', 'nyu', 'lse', 'us', 'uk', 'uae', 'eu', 'usa', 'sql', 'html', 'css', 'aws'])
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'via', 'with', 'as', 'vs', 'etc'])

function formatValue(raw: string | unknown): string {
    if (raw === null || raw === undefined) return ''
    if (typeof raw !== 'string') {
        if (Array.isArray(raw)) return raw.map(item => typeof item === 'object' && item !== null ? Object.values(item as Record<string, any>).filter(Boolean).join(' · ') : String(item)).join(', ')
        if (typeof raw === 'object') return Object.entries(raw as object).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')
        return String(raw)
    }
    if (!raw.trim()) return raw
    const tokens = raw.trim().split(/(\s+|,\s*|\/\s*)/)
    let wordCount = 0
    return tokens.map(tok => {
        if (!tok || /^[\s,/]+$/.test(tok)) return tok
        const lo = tok.toLowerCase()
        if (ACRONYMS.has(lo)) { wordCount++; return lo.toUpperCase() }
        if (wordCount > 0 && SMALL_WORDS.has(lo)) { wordCount++; return lo }
        wordCount++
        return lo.charAt(0).toUpperCase() + lo.slice(1)
    }).join('')
}

function getDynamicSections(profile: ProfileData) {
    const keys = Object.keys(profile).filter(k => !k.startsWith('asked_') && !k.startsWith('doc_') && !k.startsWith('_'))
    keys.sort()
    const sectionsData = [
        { label: 'Identity', icon: User, match: ['name', 'location', 'stage', 'city', 'country'] },
        { label: 'Current Studies', icon: GraduationCap, match: ['current', 'university', 'program', 'semester', 'degree', 'gpa'] },
        { label: 'Academic History', icon: BookOpen, match: ['academic', 'past', 'education', 'school', 'qual', 'level'] },
        { label: 'Abilities', icon: Layers, match: ['skill', 'subject', 'tool', 'language', 'cert'] },
        { label: 'Experience & Achievements', icon: Briefcase, match: ['project', 'intern', 'work', 'club', 'award', 'compet', 'volunteer', 'research'] },
        { label: 'Direction & Constraints', icon: Target, match: ['direction', 'career', 'goal', 'budget', 'timeline', 'visa', 'test', 'motivation', 'study'] },
    ]
    const result = sectionsData.map(s => ({ ...s, fields: [] as { key: string, label: string }[] }))
    const used = new Set<string>()
    for (const key of keys) {
        const lowerKey = key.toLowerCase()
        for (const s of result) {
            if (s.match.some(m => lowerKey.includes(m))) {
                s.fields.push({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })
                used.add(key)
                break
            }
        }
    }
    const otherFields = keys.filter(k => !used.has(k)).map(key => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
    if (otherFields.length > 0) result.push({ label: 'Other Information', icon: Sparkles, fields: otherFields, match: [] })
    return result.filter(s => s.fields.length > 0)
}

const ESTIMATED_TOTAL_FIELDS = 20

const JOURNEY_STAGE_LABELS: Record<string, string> = {
    UNKNOWN_STUDENT: 'Getting started',
    BASIC_PROFILE_STARTED: 'Building profile',
    BASIC_PROFILE_COMPLETE: 'Profile ready',
    GOAL_IDENTIFIED: 'Goal identified',
    GOAL_VALIDATED: 'Goal validated',
    ROADMAP_CREATED: 'Roadmap ready',
    EXECUTION_STARTED: 'In progress',
    APPLICATION_READY: 'Applying',
    APPLIED: 'Applied',
    OUTCOME_RECEIVED: 'Outcome received',
    LONG_TERM_MENTORSHIP: 'Ongoing mentorship',
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function RingProgress({ pct, size = 40, stroke = 2 }: { pct: number; size?: number; stroke?: number }) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-primary transition-all duration-700 ease-out" />
        </svg>
    )
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: React.ElementType }) {
    return (
        <div className="flex flex-col gap-2 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2">
                <Icon className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/50 uppercase">{label}</span>
            </div>
            <p className="text-xl font-semibold tracking-tight text-foreground/90">{value}</p>
            <p className="text-[10px] text-muted-foreground/50 font-medium leading-tight">{sub}</p>
        </div>
    )
}

function EditableField({ label, value, onSave }: { label: string; value?: string; onSave: (val: string) => void }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value || '')
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => { if (editing) ref.current?.focus() }, [editing])
    const commit = () => { onSave(draft.trim()); setEditing(false) }
    const cancel = () => { setDraft(value || ''); setEditing(false) }
    if (editing) {
        return (
            <div className="flex flex-col gap-1.5 p-2.5 bg-muted/20 rounded-md border border-primary/20">
                <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-widest uppercase px-1">{label}</span>
                <div className="flex items-center gap-1.5">
                    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }} className="flex-1 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/60 transition-colors" placeholder={`Enter ${label.toLowerCase()}…`} />
                    <button onClick={commit} className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"><Check className="h-3 w-3" /></button>
                    <button onClick={cancel} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/50 transition-colors"><X className="h-3 w-3" /></button>
                </div>
            </div>
        )
    }
    return (
        <div className="group flex flex-col gap-1 cursor-pointer p-2.5 rounded-md border border-transparent hover:border-border/60 hover:bg-muted/20 transition-all" onClick={() => setEditing(true)}>
            <span className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest uppercase px-1">{label}</span>
            <div className="flex items-start gap-2 justify-between px-1">
                {value ? <span className="text-[14px] text-foreground font-medium leading-relaxed">{formatValue(value)}</span> : <span className="text-[13px] text-muted-foreground/30 italic">Add {label.toLowerCase()}...</span>}
                <Pencil className="h-3 w-3 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-40 text-muted-foreground transition-opacity" />
            </div>
        </div>
    )
}

function ProfileSectionCard({ section, profile, onEdit, defaultOpen = false }: { section: { label: string; icon: any; fields: { key: string; label: string }[] }; profile: ProfileData; onEdit: (key: string, val: string) => void; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen)
    const Icon = section.icon
    const filled = section.fields.filter(f => profile[f.key] !== undefined && profile[f.key] !== null && profile[f.key] !== '').length
    const total = section.fields.length
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0
    const allDone = total > 0 && filled === total
    return (
        <div className={cn('rounded-md border transition-all duration-200', open ? 'border-border bg-card' : 'border-border/30 bg-card/30 hover:border-border/60')}>
            <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background">
                    <Icon className="h-3 w-3 text-primary/70" />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-foreground">{section.label}</span>
                <div className="flex items-center gap-2.5 mr-1">
                    {allDone ? <span className="flex items-center gap-1 text-[10px] font-semibold text-primary"><Check className="h-2.5 w-2.5" />Complete</span> : (
                        <>
                            <div className="h-0.5 w-14 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                            <span className="text-[10px] tabular-nums text-muted-foreground/50 w-7 text-right">{filled}/{total}</span>
                        </>
                    )}
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200 flex-shrink-0', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="border-t border-border/30 px-4 pt-3 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                    {section.fields.map(f => {
                        const val = profile[f.key]
                        if (Array.isArray(val) && val.length > 0) {
                            return (
                                <div key={f.key} className="col-span-1 sm:col-span-2 p-2">
                                    <span className="text-[9px] font-semibold text-muted-foreground/50 tracking-widest uppercase mb-1.5 block">{f.label}</span>
                                    <div className="flex flex-wrap gap-1.5">{val.map((item, i) => <span key={i} className="px-2 py-1 rounded-md bg-muted/40 text-[11px] text-foreground/70 font-medium">{String(item)}</span>)}</div>
                                </div>
                            )
                        }
                        return <EditableField key={f.key} label={f.label} value={val as string | undefined} onSave={newVal => onEdit(f.key, newVal)} />
                    })}
                </div>
            )}
        </div>
    )
}

function GoalCard({ goal, todo, completedMap, isActive, onClick }: { goal: string; todo?: TodoTask; completedMap: Record<string, boolean[]>; isActive: boolean; onClick: () => void }) {
    const completed = completedMap[goal] ?? []
    const tasks = todo ? flattenSections(todo) : []
    const total = tasks.length
    const done = completed.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
        <button onClick={onClick} className={cn('group w-full text-left rounded-lg border px-3 py-3 transition-all duration-150', isActive ? 'border-primary/30 bg-muted/20' : 'border-border/30 bg-card/30 hover:border-border/60 hover:bg-card/60')}>
            <div className="flex items-start gap-2.5">
                <div className={cn('mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border transition-colors', isActive ? 'border-primary' : 'border-border')}>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{formatValue(goal)}</p>
                    {total > 0 ? (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                            <span className="text-[10px] tabular-nums text-muted-foreground/50 flex-shrink-0">{done}/{total}</span>
                        </div>
                    ) : <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40"><span className="inline-block h-1 w-1 rounded-full bg-primary/50 animate-pulse" />Generating…</span>}
                </div>
                <ArrowUpRight className={cn('h-3 w-3 flex-shrink-0 mt-0.5 transition-all', isActive ? 'text-primary/50 opacity-100' : 'opacity-0 group-hover:opacity-30')} />
            </div>
        </button>
    )
}

function TaskList({ todo, completed, onToggle }: { todo: TodoTask; completed: boolean[]; onToggle: (idx: number) => void }) {
    const [activeTab, setActiveTab] = useState<'primary' | 'backup_1' | 'backup_2'>('primary')
    const getActivePlan = () => {
        if (activeTab === 'backup_1' && todo.backup_1) return todo.backup_1
        if (activeTab === 'backup_2' && todo.backup_2) return todo.backup_2
        return todo.primary || { preparation: todo.steps || [], application: [], decision: [], summary: todo.summary }
    }
    const activePlan = getActivePlan()
    const phases = [
        { name: 'Preparation', tasks: activePlan.preparation || [] },
        { name: 'Application', tasks: activePlan.application || [] },
        { name: 'Decision', tasks: activePlan.decision || [] }
    ].filter(p => p.tasks.length > 0)
    const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})
    const toggleExpand = (phaseName: string, si: number) => {
        const key = `${phaseName}-${si}`
        setExpandedSteps(prev => ({ ...prev, [key]: !prev[key] }))
    }
    const flatTasks = flattenSections(todo)
    const total = flatTasks.length
    const done = completed.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const hasBackups = !!(todo.backup_1 || todo.backup_2)
    const isEnriched = !!(todo.steps && todo.steps.length > 0)
    const sections: TodoSection[] = !isEnriched && todo.sections && todo.sections.length > 0 ? todo.sections : !isEnriched ? [{ name: 'Action Plan', tasks: todo.tasks ?? [] }] : []
    const offsets: number[] = []
    let cursor = 0
    for (const s of sections) { offsets.push(cursor); cursor += s.tasks.length }

    return (
        <div className="flex flex-col gap-5">
            {hasBackups && (
                <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-md border border-border/20 self-start">
                    {(['primary', ...(todo.backup_1 ? ['backup_1'] : []), ...(todo.backup_2 ? ['backup_2'] : [])] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn('px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all', activeTab === tab ? 'bg-card text-foreground shadow-sm border border-border/20' : 'text-muted-foreground hover:text-foreground')}>
                            {tab === 'primary' ? 'Primary Plan' : tab === 'backup_1' ? 'Backup B' : 'Backup C'}
                        </button>
                    ))}
                </div>
            )}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-border/30 px-5 py-4 bg-muted/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
                        <span className="text-xs font-semibold text-foreground/80 truncate">{formatValue(todo.goal)}</span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        <RingProgress pct={pct} size={28} stroke={2.5} />
                        <span className="text-xs tabular-nums font-bold text-foreground/70 w-9">{pct}%</span>
                    </div>
                </div>
                <div className="p-4 flex flex-col gap-4">
                    {activePlan.summary && (
                        <div className="rounded-md bg-muted/20 px-4 py-3 border border-primary/15">
                            <p className="text-[13px] leading-relaxed text-foreground/80">{activePlan.summary}</p>
                        </div>
                    )}
                    {isEnriched ? (
                        <div className="flex flex-col gap-5">
                            {phases.map((phase, pi) => (
                                <div key={pi} className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{phase.name}</h5>
                                    </div>
                                    <div className="flex flex-col gap-2 pl-3 border-l border-primary/20 ml-0.5">
                                        {(() => {
                                            let currentOffset = 0
                                            for (let i = 0; i < pi; i++) currentOffset += phases[i].tasks.length
                                            return phase.tasks.map((step: StepItem, si: number) => {
                                                const globalIdx = currentOffset + si
                                                const isDone = activeTab === 'primary' ? (completed[globalIdx] ?? false) : false
                                                const isExpanded = expandedSteps[`${phase.name}-${si}`]
                                                return (
                                                    <div key={si} className={cn('rounded-md border transition-all overflow-hidden', isDone ? 'border-border/30 bg-muted/10' : 'border-border/30 bg-card')}>
                                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer group" onClick={() => toggleExpand(phase.name, si)}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); if (activeTab === 'primary') onToggle(globalIdx) }}
                                                                className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all', isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-background hover:border-primary/50')}
                                                            >
                                                                {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
                                                            </button>
                                                            <span className={cn('flex-1 text-[13px] font-medium leading-tight', isDone ? 'text-muted-foreground/50 line-through' : 'text-foreground')}>{step.title}</span>
                                                            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200', isExpanded && 'rotate-180')} />
                                                        </div>
                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="px-11 pb-4 space-y-3">
                                                                        <p className="text-[12px] text-muted-foreground/70 leading-relaxed font-normal">
                                                                            {step.description || "Take this action to advance your application strategy."}
                                                                        </p>
                                                                        {(step.links?.length || 0) + (step.documents?.length || 0) > 0 && (
                                                                            <div className="flex flex-col gap-2">
                                                                                <span className="text-[9px] font-bold uppercase tracking-widest text-primary/40">Resources & Documents</span>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {step.links?.map((link, li) => {
                                                                                        const url = typeof link === 'string' ? link : (link as any).url
                                                                                        const title = typeof link === 'string' ? new URL(url).hostname.replace('www.', '') : (link as any).title
                                                                                        return (
                                                                                            <a key={`l-${li}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/5 border border-primary/10 text-[10px] text-primary hover:bg-primary/10 transition-colors">
                                                                                                {title}
                                                                                                <ArrowUpRight className="h-2.5 w-2.5" />
                                                                                            </a>
                                                                                        )
                                                                                    })}
                                                                                    {step.documents?.map((doc, di) => (
                                                                                        <div key={`d-${di}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] text-muted-foreground/70">
                                                                                            <FileText className="h-2.5 w-2.5" />
                                                                                            {doc}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {sections.map((section, si) => (
                                <div key={si} className="rounded-md border border-border/20 overflow-hidden">
                                    <div className="px-4 py-2.5 bg-muted/10 border-b border-border/30">
                                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{section.name}</h4>
                                    </div>
                                    <div className="p-2 flex flex-col gap-0.5">
                                        {section.tasks.map((task, idx) => {
                                            const globalIdx = offsets[si] + idx
                                            const isDone = completed[globalIdx]
                                            return (
                                                <button key={idx} onClick={() => onToggle(globalIdx)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/20 transition-all">
                                                    <div className={cn('mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border transition-all', isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 bg-background hover:border-primary/40')}>
                                                        {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                                    </div>
                                                    <span className={cn('text-[13px] leading-relaxed', isDone ? 'text-muted-foreground/50 line-through' : 'text-foreground/90 font-medium')}>{formatValue(task)}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="border-t border-border/20 bg-muted/10 px-5 py-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/60">{done} of {total} steps completed</span>
                    <div className="h-1 w-20 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                </div>
            </div>
        </div>
    )
}

// ─── Application Tracker ──────────────────────────────────────────────────────

const APP_STATUS_CONFIG = {
    pending: { label: 'Researching', color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/20', dot: 'bg-muted-foreground/40' },
    applied: { label: 'Applying', color: 'text-primary', bg: 'bg-muted/30', border: 'border-primary/20', dot: 'bg-primary' },
    interview: { label: 'Interview', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', dot: 'bg-success' },
    offer: { label: 'Offer', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
    rejected: { label: 'Rejected', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', dot: 'bg-destructive' },
}

function ApplicationTrackerTab({ userId }: { userId: string | null | undefined }) {
    const [applications, setApplications] = useState<Application[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [newApp, setNewApp] = useState({ university: '', course: '', deadline: '' })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
    const selectedApp = applications.find(a => a.id === selectedAppId) || null
    const [isGeneratingPrep, setIsGeneratingPrep] = useState<number | null>(null)

    useEffect(() => { if (userId) fetchApplications() }, [userId])

    async function fetchApplications() {
        try {
            const res = await fetch(`/api/applications/${userId}`)
            const data = await res.json()
            setApplications(data)
        } catch (e) { console.error('Failed to fetch applications', e) } finally { setIsLoading(false) }
    }

    async function handleAdd() {
        if (!newApp.university || !newApp.course) return
        setIsSubmitting(true)
        try {
            await fetch(`/api/applications/${userId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newApp) })
            setNewApp({ university: '', course: '', deadline: '' }); setIsAdding(false); fetchApplications()
        } finally { setIsSubmitting(false) }
    }

    async function updateStatus(appId: number, status: string) {
        try {
            await fetch(`/api/applications/${userId}/${appId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
            fetchApplications()
        } catch (e) { console.error(e) }
    }

    async function handleDelete(appId: number) {
        if (!confirm('Remove this application?')) return
        try { await fetch(`/api/applications/${userId}/${appId}`, { method: 'DELETE' }); fetchApplications() } catch (e) { console.error(e) }
    }

    async function generatePrep(appId: number) {
        if (!userId) return
        setIsGeneratingPrep(appId)
        try {
            const res = await fetch(`/api/applications/${userId}/${appId}/prep`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            if (!res.ok) throw new Error(`Prep generation failed: ${res.status}`)
            const data = await res.json()
            setApplications(prev => prev.map(app => app.id === appId ? { ...app, interview_prep: data } : app))
        } catch (e) { console.error('Failed to generate prep:', e); alert('Failed to generate interview prep. Please try again.') } finally { setIsGeneratingPrep(null) }
    }

    const onDragStart = (e: React.DragEvent, appId: number) => { e.dataTransfer.setData('applicationId', String(appId)); e.dataTransfer.effectAllowed = 'move' }
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
    const onDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        const appId = Number(e.dataTransfer.getData('applicationId'))
        if (!appId) return
        const app = applications.find(a => a.id === appId)
        if (app && app.status !== newStatus) {
            setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus as any } : a))
            updateStatus(appId, newStatus)
        }
    }

    if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>

    const statuses: Array<keyof typeof APP_STATUS_CONFIG> = ['pending', 'applied', 'interview', 'offer']

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">Application Tracker</h3>
                    <p className="text-xs text-muted-foreground/60 mt-1">Drag cards between columns to update status</p>
                </div>
                <button onClick={() => setIsAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all ">
                    <Plus className="h-3 w-3" />Add Application
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statuses.map(status => {
                    const config = APP_STATUS_CONFIG[status]
                    const apps = applications.filter(a => a.status === status)
                    return (
                        <div key={status} className="flex flex-col gap-3" onDragOver={onDragOver} onDrop={(e) => onDrop(e, status)}>
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className={cn('h-2 w-2 rounded-full', config.dot)} />
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{config.label}</h3>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground/30">{apps.length}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 min-h-[140px] p-2 rounded-lg border border-border/20 bg-muted/5 transition-colors">
                                {apps.map(app => (
                                    <div key={app.id} draggable onDragStart={(e) => onDragStart(e, app.id)} onClick={() => setSelectedAppId(app.id)} className="group flex flex-col gap-1.5 p-2.5 rounded-lg border border-border/20 bg-card transition-all cursor-grab active:cursor-grabbing hover:border-primary/20">
                                        <div className={cn('h-0.5 w-full rounded-full', config.bg.replace('/10', ''))} style={{ background: 'currentColor', opacity: 0.4 }} />
                                        <p className="text-[12px] font-semibold text-foreground leading-snug">{app.university}</p>
                                        <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider truncate">{app.course}</p>
                                        {app.deadline && <p className="text-[10px] text-muted-foreground/40">{new Date(app.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                                    </div>
                                ))}
                                {apps.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center py-8 opacity-20 pointer-events-none">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Drop here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Rejected section */}
            {applications.filter(a => a.status === 'rejected').length > 0 && (
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-destructive/60 mb-3 px-1">Rejected</h4>
                    <div className="flex flex-wrap gap-3">
                        {applications.filter(a => a.status === 'rejected').map(app => (
                            <div key={app.id} onClick={() => setSelectedAppId(app.id)} className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-destructive/20 bg-destructive/5 cursor-pointer hover:border-destructive/30 transition-all">
                                <p className="text-[12px] font-semibold text-foreground">{app.university}</p>
                                <p className="text-[10px] text-muted-foreground/50">{app.course}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-sm rounded-md border border-border bg-background shadow-2xl p-4 space-y-5">
                            <div><h3 className="text-sm font-semibold text-foreground">Track New Application</h3><p className="text-[11px] text-muted-foreground/50 mt-0.5">Add a university application to track</p></div>
                            <div className="space-y-4">
                                {[{ label: 'University', key: 'university', placeholder: 'e.g. University of Manchester', type: 'text' }, { label: 'Programme', key: 'course', placeholder: 'e.g. MSc Computer Science', type: 'text' }, { label: 'Deadline', key: 'deadline', placeholder: '', type: 'date' }].map(field => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{field.label}</label>
                                        <input type={field.type} value={(newApp as any)[field.key]} onChange={e => setNewApp({ ...newApp, [field.key]: e.target.value })} className="w-full rounded-lg bg-muted/30 border border-border/20 px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-all" placeholder={field.placeholder} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsAdding(false)} className="flex-1 rounded-lg border border-border/30 bg-background py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted/30 transition-all">Cancel</button>
                                <button onClick={handleAdd} disabled={isSubmitting || !newApp.university || !newApp.course} className="flex-1 rounded-lg bg-primary py-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90  transition-all disabled:opacity-40">
                                    {isSubmitting ? 'Adding...' : 'Add Application'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="w-full max-w-md rounded-md border border-border bg-background shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">{selectedApp.university}</h3>
                                    <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{selectedApp.course}</p>
                                </div>
                                <button onClick={() => setSelectedAppId(null)} className="h-7 w-7 rounded-lg hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.keys(APP_STATUS_CONFIG) as Array<keyof typeof APP_STATUS_CONFIG>).map(status => (
                                            <button key={status} onClick={() => updateStatus(selectedApp.id, status)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all', selectedApp.status === status ? cn(APP_STATUS_CONFIG[status].border, APP_STATUS_CONFIG[status].bg, APP_STATUS_CONFIG[status].color) : 'border-border/30 bg-muted/20 text-muted-foreground hover:border-border')}>
                                                {APP_STATUS_CONFIG[status].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {selectedApp.status === 'interview' && (
                                    <div className="rounded-md border border-primary/20 bg-muted/20 p-4">
                                        <p className="text-[13px] text-foreground/80 leading-relaxed mb-4">Generate personalized AI interview prep for this application.</p>
                                        <button onClick={() => generatePrep(selectedApp.id)} disabled={isGeneratingPrep === selectedApp.id} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-all disabled:opacity-50">
                                            {isGeneratingPrep === selectedApp.id ? 'Generating...' : 'Generate Interview Prep'}
                                        </button>
                                    </div>
                                )}
                                {selectedApp.status === 'offer' && (
                                    <div className="rounded-md border border-primary/20 bg-muted/20 p-4 text-center">
                                        <p className="text-base font-bold text-foreground">Congratulations! 🎉</p>
                                        <p className="text-sm text-muted-foreground/70 mt-1">You've received an offer from {selectedApp.university}.</p>
                                    </div>
                                )}
                                <button onClick={() => handleDelete(selectedApp.id)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-destructive/15 text-destructive/50 hover:text-destructive hover:bg-destructive/5 transition-all text-[11px] font-semibold">
                                    <Trash2 className="h-3.5 w-3.5" />Remove Application
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ userId, generatedDocs, uploadedDocs, onFetchDoc, isFetchingDoc }: { userId: string | null | undefined; generatedDocs: any[]; uploadedDocs: any[]; onFetchDoc: (id: string, type: string) => void; isFetchingDoc: boolean }) {
    const { openDoc } = useDocumentViewer()
    const [showUpload, setShowUpload] = useState(false)
    const [docName, setDocName] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [localUploaded, setLocalUploaded] = useState(uploadedDocs)

    useEffect(() => { setLocalUploaded(uploadedDocs) }, [uploadedDocs])

    async function handleUpload() {
        if (!docName || !selectedFile || !userId) return
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('document_name', docName.trim())
            formData.append('file', selectedFile)
            formData.append('user_id', userId)
            const res = await fetch('/api/documents', { method: 'POST', body: formData })
            if (res.ok) {
                const data = await res.json()
                if (data.follow_up) window.dispatchEvent(new CustomEvent('new-ai-message', { detail: { content: data.follow_up, sender: 'assistant' } }))
                setDocName(''); setSelectedFile(null); setShowUpload(false)
                const updated = await fetch(`/api/documents?user_id=${userId}`)
                if (updated.ok) setLocalUploaded(await updated.json())
            }
        } finally { setIsUploading(false) }
    }

    async function handleDelete(docId: number) {
        if (!confirm('Delete this document?')) return
        try {
            await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
            setLocalUploaded(prev => prev.filter((d: any) => d.id !== docId))
        } catch (e) { console.error(e) }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">Document Vault</h3>
                    <p className="text-xs text-muted-foreground/60 mt-1">Uploaded originals and AI-generated documents</p>
                </div>
                <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 rounded-md border border-border/30 bg-card px-4 py-2 text-[11px] font-bold text-foreground hover:border-primary/30 transition-all">
                    <Upload className="h-3.5 w-3.5" />Upload Document
                </button>
            </div>

            {showUpload && (
                <div className="p-5 rounded-md border border-border/20 bg-background space-y-5 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">Add to Vault</h4>
                        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">Upload a document to make it available for the AI to analyze.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr] gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Document Alias</label>
                            <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Current Resume" className="w-full rounded-md border border-border/30 bg-muted/10 px-3 py-2.5 text-[13px] outline-none focus:border-foreground/30 focus:bg-background transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Upload File</label>
                            <label className="relative flex flex-col items-center justify-center w-full py-6 px-4 border border-dashed border-border/40 rounded-md bg-muted/5 hover:bg-muted/20 hover:border-foreground/20 transition-all cursor-pointer group">
                                <Upload className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground/70 mb-2 transition-colors" />
                                <span className="text-[12px] font-medium text-foreground/70 pointer-events-none mb-1 text-center line-clamp-1 break-all">
                                    {selectedFile ? selectedFile.name : 'Click or drop file to upload'}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 pointer-events-none">PDF, DOCX, TXT up to 5MB</span>
                                <input
                                    type="file"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-border/20 pt-4">
                        <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-md bg-muted/20 hover:bg-muted/40 text-xs font-semibold text-foreground transition-all">Cancel</button>
                        <button onClick={handleUpload} disabled={isUploading || !docName || !selectedFile} className="flex items-center gap-2 px-5 py-2 rounded-md bg-foreground text-background text-[13px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-foreground/90">
                            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {isUploading ? 'Uploading...' : 'Upload to Vault'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Uploaded */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Uploaded Documents</h4>
                    {localUploaded.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border/20 bg-muted/10">
                            <FileText className="h-8 w-8 text-muted-foreground/20 mb-3" />
                            <p className="text-[11px] text-muted-foreground/40 font-medium">No documents uploaded yet</p>
                        </div>
                    ) : localUploaded.map((doc: any) => (
                        <div key={doc.id} className="group flex items-center gap-3 p-4 rounded-lg border border-border/20 bg-card hover:border-border transition-all">
                            <div className="p-2.5 rounded-md bg-muted/30 border border-border/30"><FileText className="h-4 w-4 text-muted-foreground/70" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground truncate">{doc.document_name}</p>
                                <p className="text-[10px] text-muted-foreground/50 font-medium">{(doc.file_size / 1024).toFixed(0)} KB · Parsed</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openDoc({ type: doc.document_name, url: `/api/documents/${doc.id}/view` })} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Generated */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">AI-Generated Documents</h4>
                    {generatedDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border/20 bg-muted/10">
                            <Sparkles className="h-8 w-8 text-muted-foreground/20 mb-3" />
                            <p className="text-[11px] text-muted-foreground/40 font-medium">No documents generated yet</p>
                            <p className="text-[10px] text-muted-foreground/30 mt-1">Chat with AI to generate SOPs, CVs, and more</p>
                        </div>
                    ) : generatedDocs.flatMap((doc: any) => Object.keys(doc.document_previews || {}).map(type => ({ ...doc, activeDocType: type }))).map((item: any, i: number) => (
                        <div key={i} onClick={() => onFetchDoc(item.id, item.activeDocType)} className="group flex items-center gap-3 p-4 rounded-lg border border-border/20 bg-card hover:border-primary/20 transition-all cursor-pointer">
                            <div className="p-2.5 rounded-md bg-muted/30 border border-primary/15 group-hover:bg-primary/20 transition-all"><FileText className="h-4 w-4 text-primary" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground truncate capitalize">{item.activeDocType.replace(/_/g, ' ')}</p>
                                <p className="text-[10px] text-muted-foreground/50 font-medium">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-lg bg-muted/30 text-[9px] font-bold text-primary uppercase tracking-widest border border-primary/15">AI</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
    const { user, isLoaded, isSignedIn } = useUser()
    const { signOut } = useClerk()
    const userId = user?.id
    const { preferences, updatePreferences } = useUserPreferences()
    const { setTheme, theme: currentTheme } = useTheme()
    const { openDoc } = useDocumentViewer()

    const [profile, setProfile] = useState<ProfileData>({})
    const [goalsList, setGoalsList] = useState<string[]>([])
    const [todos, setTodos] = useState<TodoTask[]>([])
    const [generatedDocs, setGeneratedDocs] = useState<any[]>([])
    const [uploadedDocs, setUploadedDocs] = useState<any[]>([])
    const [completedMap, setCompletedMap] = useState<Record<string, boolean[]>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [selectedGoalIdx, setSelectedGoalIdx] = useState(0)
    const [isFetchingDoc, setIsFetchingDoc] = useState(false)
    const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false)
    const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'roadmap' | 'documents' | 'applications' | 'profile' | 'settings'>('chat')
    // Backend-authoritative profile completeness and journey state
    const [serverProfilePct, setServerProfilePct] = useState<number | null>(null)
    const [journeyState, setJourneyState] = useState<string>('')
    const [currentAction, setCurrentAction] = useState<ActionPayload | null>(null)

    // Sidebar document upload state
    const [sidebarUploadOpen, setSidebarUploadOpen] = useState(false)
    const [sidebarDocName, setSidebarDocName] = useState('')
    const [sidebarFile, setSidebarFile] = useState<File | null>(null)
    const [sidebarUploading, setSidebarUploading] = useState(false)

    const handleSidebarUpload = async () => {
        if (!sidebarDocName || !sidebarFile || !userId) return
        setSidebarUploading(true)
        try {
            const formData = new FormData()
            formData.append('document_name', sidebarDocName.trim())
            formData.append('file', sidebarFile)
            formData.append('user_id', userId)
            const res = await fetch('/api/documents', { method: 'POST', body: formData })
            if (res.ok) {
                const data = await res.json()
                if (data.follow_up) window.dispatchEvent(new CustomEvent('new-ai-message', { detail: { content: data.follow_up, sender: 'assistant' } }))
                setSidebarDocName(''); setSidebarFile(null); setSidebarUploadOpen(false)
                // Refresh uploaded docs
                const updated = await fetch(`/api/documents?user_id=${userId}`)
                if (updated.ok) setUploadedDocs(await updated.json())
            }
        } finally { setSidebarUploading(false) }
    }

    const handleSidebarDelete = async (docId: number) => {
        if (!confirm('Delete this document?')) return
        try {
            await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
            setUploadedDocs(prev => prev.filter((d: any) => d.id !== docId))
        } catch (e) { console.error(e) }
    }

    const mergeTodos = (incoming: TodoTask[]) => {
        setTodos(incoming)
        setCompletedMap(prev => {
            const next = { ...prev }
            for (const t of incoming) {
                const flatTasks = flattenSections(t)
                if (!next[t.goal] || next[t.goal].length !== flatTasks.length) {
                    next[t.goal] = t.completed ?? flatTasks.map(() => false)
                }
            }
            return next
        })
    }

    useEffect(() => {
        if (!userId) return
        async function fetchAll(isInitial = false) {
            if (isInitial) setIsLoading(true)
            try {
                const [sRes, tRes, gRes, uRes] = await Promise.all([
                    fetch(`/api/user/${userId}`),
                    fetch(`/api/user/${userId}/todos`),
                    fetch(`/api/documents/generated`).catch(() => ({ ok: false })),
                    fetch(`/api/documents?user_id=${userId}`).catch(() => ({ ok: false })),
                ])
                if (sRes.ok) {
                    const data = await sRes.json()
                    setProfile(data.profile_data || {})
                    const raw: string[] = data.goals || []
                    if (data.main_goal && !raw.includes(data.main_goal)) raw.unshift(data.main_goal)
                    setGoalsList(raw)
                    // Sync backend-authoritative profile completeness and journey state
                    if (typeof data.profile_progress === 'number') setServerProfilePct(data.profile_progress)
                    const js = data.conversation_state?.student_journey_state
                    if (js) setJourneyState(js)
                }
                if (tRes.ok) { const rawTodos = await tRes.json(); mergeTodos(normalizeTodos(rawTodos)) }
                if (gRes && (gRes as any).ok) { const docData = await (gRes as any).json(); if (docData.items) setGeneratedDocs(docData.items) }
                if (uRes && (uRes as any).ok) { setUploadedDocs(await (uRes as any).json()) }
            } catch (e) { console.error('Dashboard fetch error:', e) } finally { if (isInitial) setIsLoading(false) }
        }
        fetchAll(true)
        const id = setInterval(() => fetchAll(), 5000)
        return () => clearInterval(id)
    }, [userId])

    // Real-time profile progress from chat replies
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (typeof detail?.progress === 'number') setServerProfilePct(detail.progress)
        }
        window.addEventListener('profile-progress-updated', handler)
        return () => window.removeEventListener('profile-progress-updated', handler)
    }, [])

    const triggerRoadmapGeneration = async () => {
        if (!userId || isGeneratingRoadmap) return
        setIsGeneratingRoadmap(true)
        try {
            const res = await fetch(`/api/user/${userId}/generate-roadmap`, { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                if (data.triggered) {
                    // Poll more aggressively for the next 2 minutes
                    let polls = 0
                    const pollId = setInterval(async () => {
                        polls++
                        try {
                            const tRes = await fetch(`/api/user/${userId}/todos`)
                            if (tRes.ok) {
                                const rawTodos = await tRes.json()
                                const normalized = normalizeTodos(rawTodos)
                                if (normalized.length > 0 && flattenSections(normalized[0]).length > 0) {
                                    mergeTodos(normalized)
                                    setIsGeneratingRoadmap(false)
                                    clearInterval(pollId)
                                }
                            }
                        } catch { /* ignore */ }
                        if (polls >= 24) { // 2 min max
                            setIsGeneratingRoadmap(false)
                            clearInterval(pollId)
                        }
                    }, 5000)
                } else {
                    setIsGeneratingRoadmap(false)
                }
            } else {
                setIsGeneratingRoadmap(false)
            }
        } catch (e) {
            console.error('Roadmap trigger error:', e)
            setIsGeneratingRoadmap(false)
        }
    }

    const handleToggle = async (goal: string, idx: number) => {
        let nextCompleted: boolean[] = []
        setCompletedMap(prev => {
            const arr = [...(prev[goal] ?? [])]
            arr[idx] = !arr[idx]
            nextCompleted = arr
            return { ...prev, [goal]: arr }
        })

        if (!userId) return
        try {
            await fetch(`/api/user/${userId}/goal_progress`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goal,
                    completed: nextCompleted,
                    current_index: idx
                })
            })
        } catch (e) {
            console.error('Failed to sync progress:', e)
        }
    }

    const handleEdit = async (key: string, val: string) => {
        setProfile(prev => ({ ...prev, [key]: val || undefined }))
        if (!userId) return
        try { await fetch(`/api/user/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: val }) }) } catch (e) { console.error(e) }
    }

    const fetchAndOpenDoc = async (id: string, type: string) => {
        setIsFetchingDoc(true)
        try {
            const res = await fetch(`/api/documents/generated/${id}`)
            if (res.ok) { const data = await res.json(); if (data.documents && data.documents[type]) openDoc({ type, content: data.documents[type].content }) }
        } catch (e) { console.error(e) } finally { setIsFetchingDoc(false) }
    }

    const filledFields = Object.values(profile).filter(v => { if (!v) return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v as unknown)) return (v as unknown as unknown[]).length > 0; if (typeof v === 'object') return Object.keys(v as object).length > 0; return true }).length
    const clientProfilePct = Math.min(100, Math.round((filledFields / ESTIMATED_TOTAL_FIELDS) * 100))
    // Prefer the backend-weighted completeness; fall back to client estimate
    const profilePct = serverProfilePct ?? clientProfilePct
    const totalTasks = todos.reduce((a, t) => a + flattenSections(t).length, 0)
    const totalDone = Object.values(completedMap).reduce((a, arr) => a + arr.filter(Boolean).length, 0)
    const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0
    const activeGoal = goalsList[selectedGoalIdx]
    const activeTodo = todos.find(t => t.goal === activeGoal)

    const NAV_ITEMS = [
        { id: 'chat', label: 'Chat Consultant', icon: MessageSquare },
        { id: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
        { id: 'roadmap', label: 'My Roadmap', icon: MapPin },
        { id: 'documents', label: 'My Documents', icon: FileText },
        { id: 'applications', label: 'Applications', icon: Briefcase },
        { id: 'profile', label: 'My Profile', icon: User },
        { id: 'settings', label: 'Settings', icon: Settings },
    ]

    const ACTIVE_AGENTS = [
        { id: 'A1', label: 'Profiling', active: true },
        { id: 'A4', label: 'Goals', active: true },
        { id: 'A6', label: 'Roadmap', active: false },
        { id: 'A9', label: 'Tracker', active: false },
    ]

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex gap-2">
                    {[0, 150, 300].map(d => <div key={d} className="h-2 w-2 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted/30 border border-primary/20 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Loading your workspace...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden text-foreground">
            {/* ── Sidebar ── */}
            <aside className="w-[72px] lg:w-[260px] border-r border-border/20 bg-card/30 flex flex-col pt-6 pb-4 items-center lg:items-stretch shrink-0 overflow-hidden">
                {/* Logo */}
                <div className="px-5 mb-5 flex items-center gap-2.5 flex-shrink-0">
                    <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="hidden lg:flex flex-col">
                        <span className="font-semibold text-[13px] tracking-tight text-foreground">Placement AI</span>
                        <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest">Career Companion</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="px-3 space-y-0.5 flex-shrink-0">
                    {NAV_ITEMS.map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={cn(
                            'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all text-left group',
                            activeTab === item.id
                                ? 'bg-muted/40 text-foreground'
                                : 'text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground'
                        )}>
                            <item.icon className={cn('h-3.5 w-3.5 flex-shrink-0 transition-colors', activeTab === item.id ? 'text-foreground' : 'text-current')} />
                            <span className={cn('hidden lg:block text-[13px] transition-colors', activeTab === item.id ? 'font-semibold text-foreground' : 'font-medium')}>{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Documents section */}
                <div className="hidden lg:flex flex-col px-4 mt-2 mb-2 min-h-0 flex-1 overflow-hidden">
                    <div className="h-px bg-border/30 mb-4" />

                    {/* Section header */}
                    <div className="flex items-center justify-between px-1 mb-2 group/dh">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">My Documents</span>
                        <button
                            onClick={() => setSidebarUploadOpen(v => !v)}
                            title="Upload document"
                            className="h-5 w-5 rounded-md hover:bg-muted/50 flex items-center justify-center opacity-0 group-hover/dh:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                            <Upload className="h-3 w-3" />
                        </button>
                    </div>

                    {/* Inline upload form */}
                    {sidebarUploadOpen && (
                        <div className="mb-3 p-3 rounded-md border border-border/30 bg-card/60 space-y-3 animate-fade-in">
                            <input
                                value={sidebarDocName}
                                onChange={e => setSidebarDocName(e.target.value)}
                                placeholder="Document name..."
                                className="w-full h-8 px-2.5 text-[12px] bg-background rounded-md border border-border/30 outline-none focus:border-foreground/30 transition-colors"
                            />

                            <label className="relative flex flex-col items-center justify-center w-full py-4 px-2 border border-dashed border-border/40 rounded-md bg-muted/10 hover:bg-muted/30 hover:border-foreground/20 transition-all cursor-pointer group">
                                <Upload className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/70 mb-1.5 transition-colors" />
                                <span className="text-[10px] font-medium text-muted-foreground/60 group-hover:text-foreground/80 pointer-events-none line-clamp-1 break-all text-center px-2">
                                    {sidebarFile ? sidebarFile.name : 'Click to select file'}
                                </span>
                                <input
                                    type="file"
                                    onChange={e => setSidebarFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>

                            <div className="flex gap-2 pt-1">
                                <button onClick={() => { setSidebarUploadOpen(false); setSidebarDocName(''); setSidebarFile(null) }} className="flex-1 h-8 rounded-md bg-muted/20 hover:bg-muted/40 text-[11px] font-medium text-foreground transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSidebarUpload}
                                    disabled={sidebarUploading || !sidebarDocName || !sidebarFile}
                                    className="flex-1 h-8 rounded-md bg-foreground text-background text-[11px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:opacity-90 flex items-center justify-center gap-1.5"
                                >
                                    {sidebarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                    {sidebarUploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Document list — scrollable */}
                    <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar min-h-0">
                        {uploadedDocs.length === 0 && generatedDocs.length === 0 ? (
                            <button
                                onClick={() => setSidebarUploadOpen(true)}
                                className="w-full flex items-center gap-2.5 px-2 py-3 rounded-md border border-dashed border-border/20 text-muted-foreground/40 hover:border-primary/30 hover:text-muted-foreground/60 transition-all group"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                <span className="text-[11px] font-medium">Upload your first doc</span>
                            </button>
                        ) : (
                            <>
                                {uploadedDocs.map((doc: any) => (
                                    <div key={doc.id} className="group/doc relative flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDoc({ type: doc.document_name, url: `/api/documents/${doc.id}/view` })}>
                                        <div className="h-5 w-5 rounded-md bg-muted/40 border border-border/30 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-2.5 w-2.5 text-muted-foreground/60" />
                                        </div>
                                        <span className="flex-1 text-[12px] font-medium text-foreground/80 truncate pr-6">{doc.document_name}</span>
                                        <div className="absolute right-1 opacity-0 group-hover/doc:opacity-100 transition-opacity flex items-center gap-0.5">
                                            <button onClick={e => { e.stopPropagation(); openDoc({ type: doc.document_name, url: `/api/documents/${doc.id}/view` }) }} className="p-1 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-3 w-3" /></button>
                                            <button onClick={e => { e.stopPropagation(); handleSidebarDelete(doc.id) }} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
                                        </div>
                                    </div>
                                ))}
                                {generatedDocs.flatMap((doc: any) => Object.keys(doc.document_previews || {}).map(type => ({ ...doc, activeDocType: type }))).map((item: any, i: number) => (
                                    <div key={`gen-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => fetchAndOpenDoc(item.id, item.activeDocType)}>
                                        <div className="h-5 w-5 rounded-md bg-muted/30 border border-primary/15 flex items-center justify-center flex-shrink-0">
                                            <Sparkles className="h-2.5 w-2.5 text-primary" />
                                        </div>
                                        <span className="flex-1 text-[12px] font-medium text-foreground/80 truncate capitalize">{item.activeDocType.replace(/_/g, ' ')}</span>
                                        <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest flex-shrink-0">AI</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Active Agents (Removed for absolute minimalism) */}

                {/* Profile Footer */}
                <div className="px-3 flex-shrink-0">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/30 transition-all cursor-pointer group" onClick={() => setActiveTab('profile')}>
                        <Avatar className="h-7 w-7 rounded-full flex-shrink-0">
                            <AvatarImage src={user?.imageUrl} />
                            <AvatarFallback className="rounded-full text-[10px] bg-muted/30 text-foreground font-semibold">{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="hidden lg:flex flex-col flex-1 min-w-0">
                            <span className="text-[12px] font-semibold text-foreground/90 truncate">{user?.firstName || 'Student'}</span>
                            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                                {profilePct}% complete
                                {journeyState && journeyState !== 'UNKNOWN_STUDENT' && (
                                    <span className="ml-1 text-[9px] font-semibold text-primary/70 uppercase tracking-widest truncate">
                                        · {JOURNEY_STAGE_LABELS[journeyState] ?? journeyState.replace(/_/g, ' ').toLowerCase()}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col min-w-0 relative bg-background overflow-hidden">
                {/* Top bar */}
                <div className="h-10 border-b border-border/20 flex items-center justify-between px-6 bg-background z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">System Active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {activeTab === 'chat' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground/70 uppercase tracking-widest bg-muted/20 px-3 py-1 rounded-md border border-border/20">
                                <Sparkles className="h-3 w-3 text-muted-foreground/50" />AI Online
                            </div>
                        )}
                        <button onClick={() => signOut({ redirectUrl: '/sign-in' })} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all uppercase tracking-widest">
                            <span className="hidden sm:block">Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'chat' ? (
                        <div className="flex h-full overflow-hidden">
                            <div className={currentAction ? 'flex-1 min-w-0' : 'w-full'}>
                                <ChatInterface activeChatId={null} onActionPayload={(p) => setCurrentAction(p)} />
                            </div>
                            {currentAction && (
                                <div className="w-[420px] shrink-0 min-w-0">
                                    <ActionWorkspace
                                        action={currentAction}
                                        userId={userId ?? ''}
                                        onClose={() => setCurrentAction(null)}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                            <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-8 lg:py-10 space-y-8">

                                {/* Page header */}
                                <div className="space-y-1">
                                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                                        {activeTab === 'dashboard' ? `Welcome back${profile.student_name ? `, ${formatValue(profile.student_name)}` : ''}` : activeTab === 'roadmap' ? 'My Pathway Roadmap' : activeTab === 'documents' ? 'Document Vault' : activeTab === 'applications' ? 'Application Tracker' : activeTab === 'profile' ? 'My Profile' : 'Settings'}
                                    </h1>
                                    <p className="text-[12px] text-muted-foreground/60 leading-relaxed max-w-2xl">
                                        {activeTab === 'dashboard' ? "Here's your progress overview" : activeTab === 'roadmap' ? 'Your strategic pathway across all phases' : activeTab === 'documents' ? 'Uploaded originals and AI-generated documents' : activeTab === 'applications' ? 'Track every application in one place' : activeTab === 'profile' ? 'Your academic identity and profile data' : 'Workspace preferences'}
                                    </p>
                                </div>

                                {/* ── Dashboard Tab ── */}
                                {activeTab === 'dashboard' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                                            <StatCard label="Profile Score" value={`${profilePct}%`} sub="Personalization score" icon={TrendingUp} />
                                            <StatCard label="Days to Next" value="T-14" sub="Admission window" icon={Clock} />
                                            <StatCard label="Roadmap Steps" value={totalTasks || '—'} sub={`${totalDone} completed`} icon={MapPin} />
                                            <StatCard label="Documents" value={generatedDocs.length + uploadedDocs.length} sub="In secure vault" icon={FileText} />
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                                            {/* Roadmap summary */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground/40" /><span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Strategic Trajectory</span></div>
                                                    <button onClick={() => setActiveTab('roadmap')} className="text-[10px] font-semibold text-muted-foreground/40 hover:text-foreground transition-colors tracking-widest uppercase">View Details</button>
                                                </div>
                                                <div className="px-1 flex items-center gap-6">
                                                    <div className="flex-shrink-0"><RingProgress pct={overallPct} size={64} stroke={2} /></div>
                                                    <div className="space-y-1">
                                                        <h4 className="text-[13px] font-semibold text-foreground">Current Stage: Preparation</h4>
                                                        <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[200px]">Focused on academic alignment and document baseline.</p>
                                                        <div className="flex items-center gap-2 pt-1 font-mono">
                                                            <span className="text-[12px] font-bold text-foreground/80">{overallPct}%</span>
                                                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40">Progress</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {todos.length > 0 && (
                                                    <div className="border-t border-border/20 p-3 space-y-1.5">
                                                        {flattenSections(todos[0]).slice(0, 3).map((task, i) => (
                                                            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/15">
                                                                <div className="h-1 w-1 rounded-full bg-primary/50 flex-shrink-0" />
                                                                <span className="text-[11px] text-foreground/70 truncate">{task}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Recent docs */}
                                            <div className="space-y-3 pt-6 lg:pt-0">
                                                <div className="flex items-center px-1 mb-1">
                                                    <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground/40" /><span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Recent Documents</span></div>
                                                </div>
                                                <div className="space-y-1.5 px-1">
                                                    {generatedDocs.slice(0, 4).map((doc: any, i: number) => (
                                                        <div key={i} onClick={() => setActiveTab('documents')} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/20 transition-all cursor-pointer group">
                                                            <div className="p-1.5 rounded-md bg-muted/30"><FileText className="h-2.5 w-2.5 text-primary" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-medium text-foreground truncate capitalize">{Object.keys(doc.document_previews || {})[0]?.replace(/_/g, ' ')}</p>
                                                                <p className="text-[10px] text-muted-foreground/40">{new Date(doc.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                            <ArrowUpRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                                                        </div>
                                                    ))}
                                                    {generatedDocs.length === 0 && uploadedDocs.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center py-6 text-center">
                                                            <Sparkles className="h-5 w-5 text-muted-foreground/15 mb-1.5" />
                                                            <p className="text-[10px] text-muted-foreground/30">No documents yet</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Agent activity */}
                                        <div className="rounded-md border border-border/30 bg-card/30 p-4">
                                            <h3 className="text-[9px] font-bold uppercase tracking-widest text-primary mb-3">Agent Activity</h3>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                {[{ id: 'A1', label: 'Profiling Engine', status: 'Building your profile', active: true }, { id: 'A5', label: 'Gap Analyzer', status: `${generatedDocs.length > 0 ? 'Analysis complete' : 'Awaiting profile'}`, active: false }, { id: 'A6', label: 'Pathway Planner', status: `${goalsList.length > 0 ? 'Roadmap updated' : 'Awaiting goals'}`, active: goalsList.length > 0 }, { id: 'A7', label: 'Docs Engine', status: `${generatedDocs.length > 0 ? `${generatedDocs.length} docs ready` : 'SOP template ready'}`, active: generatedDocs.length > 0 }].map(agent => (
                                                    <div key={agent.id} className={cn('rounded-lg p-2.5 border', agent.active ? 'border-primary/15 bg-muted/20' : 'border-border/20 bg-muted/5')}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={cn('h-5 w-5 rounded-md flex items-center justify-center text-[7px] font-black border', agent.active ? 'border-primary/30 bg-muted/30 text-primary' : 'border-border/20 text-muted-foreground/40')}>{agent.id}</div>
                                                            <span className="text-[10px] font-bold text-foreground/80">{agent.label}</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-snug">{agent.status}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Roadmap Tab ── */}
                                {activeTab === 'roadmap' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <StatCard label="Pathway Steps" value={totalTasks || '—'} sub="Actionable items" icon={MapPin} />
                                            <StatCard label="Overall Progress" value={`${overallPct}%`} sub="Steps completed" icon={TrendingUp} />
                                        </div>
                                        {goalsList.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-5 rounded-lg border border-dashed border-border/20 bg-card/20 px-8 py-24 text-center">
                                                <Sparkles className="h-10 w-10 text-primary/30" />
                                                <div className="space-y-2">
                                                    <p className="text-lg font-bold text-foreground">No pathway generated yet</p>
                                                    <p className="text-[12px] text-muted-foreground/50 max-w-xs">Chat with the AI consultant to set your goals and generate your strategic roadmap.</p>
                                                </div>
                                                <button onClick={() => setActiveTab('chat')} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary/90 transition-all">Start Chat →</button>
                                            </div>
                                        ) : (
                                            <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
                                                <div className="space-y-3">
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary px-1">Strategic Tracks</h3>
                                                    {goalsList.map((goal, idx) => (
                                                        <GoalCard key={idx} goal={goal} todo={todos.find(t => t.goal === goal)} completedMap={completedMap} isActive={selectedGoalIdx === idx} onClick={() => setSelectedGoalIdx(idx)} />
                                                    ))}
                                                </div>
                                                <div className="space-y-3">
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary px-1">Action Steps</h3>
                                                    {activeTodo ? (
                                                        <TaskList todo={activeTodo} completed={completedMap[activeGoal] ?? []} onToggle={(idx) => handleToggle(activeGoal, idx)} />
                                                    ) : isGeneratingRoadmap ? (
                                                        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/20 bg-card/20 px-8 py-24 text-center">
                                                            <Loader2 className="h-6 w-6 text-primary/40 animate-spin" />
                                                            <p className="text-[13px] font-semibold text-foreground/70">Generating your roadmap…</p>
                                                            <p className="text-[11px] text-muted-foreground/50">This can take up to 2 minutes. We&apos;ll update automatically.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/20 bg-card/20 px-8 py-24 text-center">
                                                            <Sparkles className="h-8 w-8 text-primary/30" />
                                                            <p className="text-[13px] font-semibold text-foreground/70">Action plan not ready yet</p>
                                                            <p className="text-[11px] text-muted-foreground/50 max-w-xs">Continue chatting to complete your profile, or generate a plan now.</p>
                                                            <button
                                                                onClick={triggerRoadmapGeneration}
                                                                className="mt-1 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                                                                disabled={isGeneratingRoadmap}
                                                            >
                                                                Generate Roadmap Now
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Documents Tab ── */}
                                {activeTab === 'documents' && (
                                    <DocumentsTab userId={userId} generatedDocs={generatedDocs} uploadedDocs={uploadedDocs} onFetchDoc={fetchAndOpenDoc} isFetchingDoc={isFetchingDoc} />
                                )}

                                {/* ── Applications Tab ── */}
                                {activeTab === 'applications' && <ApplicationTrackerTab userId={userId} />}

                                {/* ── Profile Tab ── */}
                                {activeTab === 'profile' && (
                                    <div className="space-y-8">
                                        {/* Profile header card */}
                                        <div className="rounded-md border border-primary/15 bg-muted/20 p-4 flex items-center gap-4">
                                            <div className="relative flex-shrink-0">
                                                <RingProgress pct={profilePct} size={64} stroke={4} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Avatar className="h-10 w-10 rounded-full">
                                                        <AvatarImage src={user?.imageUrl} />
                                                        <AvatarFallback className="rounded-full text-xs bg-muted/30 text-primary font-bold">{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <h2 className="text-sm font-semibold text-foreground">{profile.student_name ? formatValue(profile.student_name) : user?.firstName || 'Student'}</h2>
                                                {profile.location && <p className="text-[11px] text-muted-foreground/60">{formatValue(profile.location)}</p>}
                                                <div className="flex items-center gap-2 pt-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-0.5 w-20 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${profilePct}%` }} /></div>
                                                        <span className="text-[10px] font-bold text-primary">{profilePct}%</span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground/40">profile complete</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Profile sections */}
                                        <div className="space-y-3">
                                            {getDynamicSections(profile).map((section, idx) => (
                                                <ProfileSectionCard key={idx} section={section} profile={profile} onEdit={handleEdit} defaultOpen={idx === 0} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Settings Tab ── */}
                                {activeTab === 'settings' && (
                                    <div className="space-y-8 max-w-2xl">
                                        <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
                                            <div className="px-5 py-4 border-b border-border/30">
                                                <h3 className="text-sm font-bold text-foreground">Appearance</h3>
                                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Choose your preferred theme</p>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-3">
                                                {[{ id: 'dark', name: 'Midnight Dark', desc: 'Deep, focused environment', color: '#0D0F1A' }, { id: 'light', name: 'Minimalist Light', desc: 'Clean and airy', color: '#F0F2FF' }, { id: 'solar', name: 'Solar Sand', desc: 'Warm tones', color: '#FDF6E3' }, { id: 'emerald', name: 'Emerald Forest', desc: 'Green accents', color: '#064E3B' }].map(t => (
                                                    <button key={t.id} onClick={() => updatePreferences({ theme: t.id })} className={cn('p-3 rounded-lg border text-left transition-all', currentTheme === t.id ? 'border-primary bg-muted/20' : 'border-border/30 hover:border-border/60')}>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="h-4 w-4 rounded-full border border-border/20 shadow-sm" style={{ backgroundColor: t.color }} />
                                                            {currentTheme === t.id && <div className="h-1.5 w-1.5 rounded-full bg-primary ml-auto" />}
                                                        </div>
                                                        <p className="text-[13px] font-semibold text-foreground/90">{t.name}</p>
                                                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{t.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
                                            <div className="px-5 py-4 border-b border-border/30">
                                                <h3 className="text-sm font-bold text-foreground">Account</h3>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/20">
                                                    <Avatar className="h-9 w-9 rounded-full"><AvatarImage src={user?.imageUrl} /><AvatarFallback className="rounded-full text-sm bg-muted/30 text-primary font-bold">{user?.firstName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">{user?.fullName || user?.firstName}</p>
                                                        <p className="text-[11px] text-muted-foreground/60">{user?.primaryEmailAddress?.emailAddress}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => signOut({ redirectUrl: '/sign-in' })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-destructive/20 text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-all text-sm font-semibold">
                                                    <LogOut className="h-4 w-4" />Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
