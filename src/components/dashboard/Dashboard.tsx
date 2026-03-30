'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useView } from '@/components/providers/ViewProvider'
import { useUserPreferences } from '@/components/providers/UserPreferencesProvider'
import {
    GraduationCap, Target, FileText,
    Bookmark, MapPin, BookOpen, Layers, Award,
    Briefcase, Clock, Pencil, Check, X,
    TrendingUp, User, Sparkles, ChevronDown, BarChart3,
    ArrowUpRight, ChevronRight, Settings, Palette, CheckCircle2, Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallback } from 'react'
import { useDocumentViewer } from '@/components/providers/DocumentViewerProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
    // Core identity
    student_name?: string
    location?: string
    life_stage?: string
    // Current studies — keys must match what extraction.py saves
    current_level?: string
    current_institution?: string
    current_field?: string          // extraction.py: 'current_field' (was 'current_major')
    current_courses?: string
    current_gpa?: string
    academic_confidence?: string    // extraction.py: 'academic_confidence' (was 'academic_feel')
    // Academic history — legacy flat fields
    past_qual_1?: string
    past_qual_2?: string
    // Abilities
    strong_subjects?: string
    technical_skills?: string       // extraction.py: 'technical_skills' (was 'tech_skills')
    soft_skills?: string
    certifications?: string
    // Experience
    projects?: string
    internships?: string
    clubs?: string                  // extraction.py: 'clubs' (was 'competitions')
    competitions?: string           // keep for backward-compat
    // Achievements
    awards?: string
    // Direction
    future_direction?: string
    study_abroad?: string
    career_motivation?: string
    // Constraints
    budget?: string
    test_scores?: string
    test_status?: string
    timeline?: string
    // Dynamic catch-all — extraction.py may save arrays/objects (previous_education, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: string | string[] | Record<string, unknown> | undefined
}


// Section: { name, tasks }
interface TodoSection {
    name: string
    tasks: string[]
}

// New enriched types from improved agent (ResearchResponse)
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

// Per-goal todo item — handles legacy flat, legacy sections, and new enriched format
interface TodoTask {
    goal: string
    // Legacy formats
    sections?: TodoSection[]
    tasks?: string[]
    // New formats
    summary?: string
    steps?: StepItem[]
    links?: LinkItem[]
    documents?: DocumentItem[]
    warnings?: string[]

    // Completion tracking
    completed?: boolean[]
}

// Raw API response shape from /api/user/:userId/todos
type RawTodosResponse =
    | Record<string, TodoSection[] | any>
    | Array<{ goal: string; sections?: TodoSection[]; tasks?: string[]; completed?: boolean[]; steps?: StepItem[] }>

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Normalize whatever the API returns into a consistent TodoTask[].
 * The roadmap engine saves sections via save_todo_list(user_id, goal, organized_sections)
 * where organized_sections = [{name, tasks}, ...].
 */
/**
 * Normalize whatever the API returns into a consistent TodoTask[].
 */
function normalizeTodos(raw: RawTodosResponse): TodoTask[] {
    if (!raw) return []

    // Dict format: { "MIT Masters": [{name, tasks}], ... }
    if (!Array.isArray(raw)) {
        return Object.entries(raw).map(([goal, value]) => {
            // Check if value is the new ResearchResponse format (has steps array)
            if (value && typeof value === 'object' && !Array.isArray(value) && 'steps' in value) {
                const steps = value.steps as StepItem[]
                const flatTasks = steps.map(s => s.title)
                return {
                    goal,
                    steps,
                    summary: value.summary,
                    links: value.links,
                    documents: value.documents,
                    warnings: value.warnings,
                    completed: flatTasks.map(() => false)
                }
            }

            // value might be sections array OR legacy flat tasks array
            if (Array.isArray(value) && value.length > 0) {
                // Detect if it's sections (objects with .name) or flat strings
                if (typeof value[0] === 'object' && 'name' in value[0]) {
                    const sections = value as TodoSection[]
                    const flatTasks = sections.flatMap(s => s.tasks)
                    return { goal, sections, completed: flatTasks.map(() => false) }
                }
                // Legacy: flat string array
                const tasks = value as unknown as string[]
                return { goal, tasks, completed: tasks.map(() => false) }
            }
            return { goal, sections: [], completed: [] }
        })
    }

    // Array format: [{goal, sections, completed?}, ...]
    return raw.map(item => {
        // New enriched format
        if (item.steps && item.steps.length > 0) {
            const flatTasks = item.steps.map((s: any) => s.title)
            const completed = item.completed && item.completed.length === flatTasks.length
                ? item.completed
                : flatTasks.map(() => false)
            return { ...item, completed }
        }
        // Legacy sections
        if (item.sections && item.sections.length > 0) {
            const flatTasks = item.sections.flatMap((s: any) => s.tasks)
            const completed = item.completed && item.completed.length === flatTasks.length
                ? item.completed
                : flatTasks.map(() => false)
            return { ...item, completed }
        }
        // Legacy flat tasks
        if (item.tasks && item.tasks.length > 0) {
            const completed = item.completed && item.completed.length === item.tasks.length
                ? item.completed
                : item.tasks.map(() => false)
            return { ...item, completed }
        }
        return { ...item, sections: [], completed: [] }
    })
}

// Helper: flatten sections into a tasks array
function flattenSections(todo: TodoTask): string[] {
    if (todo.steps && todo.steps.length > 0)
        return todo.steps.map(s => s.title)
    if (todo.sections && todo.sections.length > 0)
        return todo.sections.flatMap(s => s.tasks)
    return todo.tasks ?? []
}

// Helper: total + done counts for a todo
function todoProgress(todo: TodoTask, completed: boolean[]): { done: number; total: number; pct: number } {
    const tasks = flattenSections(todo)
    const total = tasks.length
    const done = completed.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { done, total, pct }
}

// ─── Smart formatter ──────────────────────────────────────────────────────────

const ACRONYMS = new Set([
    'cs', 'ml', 'ai', 'nlp', 'cv', 'ds', 'it', 'ui', 'ux', 'oop', 'api',
    'gpa', 'gre', 'sat', 'act', 'ielts', 'toefl', 'gmat', 'phd', 'bsc', 'msc', 'ba', 'ma', 'mba',
    'lums', 'iba', 'nust', 'fast', 'pu', 'uet', 'mit', 'uc', 'nyu', 'lse',
    'us', 'uk', 'uae', 'eu', 'usa',
    'sql', 'html', 'css', 'aws', 'gcp', 'c++', 'c#', 'r',
    'os', 'db',
])

const SMALL_WORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'so', 'yet',
    'at', 'by', 'for', 'in', 'of', 'on', 'to', 'up', 'via', 'with', 'as', 'vs', 'etc',
])

function formatValue(raw: string | unknown): string {
    // Guard: handle non-string values gracefully
    if (raw === null || raw === undefined) return ''
    if (typeof raw !== 'string') {
        if (Array.isArray(raw)) {
            // Arrays are now handled directly by the UI mapper, but just in case formatValue is called on an array:
            return raw.map(item => {
                if (typeof item === 'object' && item !== null) {
                    const obj = item as Record<string, any>
                    // Generic fallback: just concatenate all values with bullets
                    return Object.values(obj).filter(v => v !== null && v !== undefined && v !== '').join(' • ')
                }
                return String(item)
            }).join(', ')
        }
        if (typeof raw === 'object' && raw !== null) {
            return Object.entries(raw as object)
                .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                .join(', ')
        }
        return String(raw)
    }
    if (!raw.trim()) return raw
    const tokens = raw.trim().split(/(\s+|,\s*|\/\s*)/)
    let wordCount = 0
    return tokens
        .map((tok) => {
            if (!tok || /^[\s,/]+$/.test(tok)) return tok
            const lo = tok.toLowerCase()
            if (ACRONYMS.has(lo)) { wordCount++; return lo.toUpperCase() }
            if (wordCount > 0 && SMALL_WORDS.has(lo)) { wordCount++; return lo }
            wordCount++
            return lo.charAt(0).toUpperCase() + lo.slice(1)
        })
        .join('')
}


// Dynamic Section Grouping Logic
function getDynamicSections(profile: ProfileData) {
    const keys = Object.keys(profile).filter(k =>
        !k.startsWith('asked_') && !k.startsWith('doc_') && !k.startsWith('_')
    )

    // Sort keys alphabetically for consistency
    keys.sort()

    const sectionsData = [
        { label: 'Identity', icon: User, match: ['name', 'location', 'stage', 'city', 'country'] },
        { label: 'Current Studies', icon: GraduationCap, match: ['current', 'university', 'program', 'semester', 'degree', 'gpa'] },
        { label: 'Academic History', icon: BookOpen, match: ['academic', 'past', 'education', 'school', 'qual', 'level'] },
        { label: 'Abilities', icon: Layers, match: ['skill', 'subject', 'tool', 'language', 'cert'] },
        { label: 'Experience & Achievements', icon: Briefcase, match: ['project', 'intern', 'work', 'club', 'award', 'compet', 'volunteer', 'research', 'publication'] },
        { label: 'Direction & Constraints', icon: Target, match: ['direction', 'career', 'goal', 'budget', 'timeline', 'visa', 'test', 'motivation', 'study'] },
    ]

    const result = sectionsData.map(s => ({ ...s, fields: [] as { key: string, label: string }[] }))
    const used = new Set<string>()

    for (const key of keys) {
        const lowerKey = key.toLowerCase()
        let placed = false
        for (const s of result) {
            if (s.match.some(m => lowerKey.includes(m))) {
                s.fields.push({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })
                placed = true
                used.add(key)
                break
            }
        }
    }

    const otherFields = keys.filter(k => !used.has(k)).map(key => ({
        key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }))

    if (otherFields.length > 0) {
        result.push({ label: 'Other Information', icon: Sparkles, fields: otherFields, match: [] })
    }

    return result.filter(s => s.fields.length > 0)
}

// We rely on dynamic fields now, so there's no fixed TOTAL
const ESTIMATED_TOTAL_FIELDS = 20

// ─── Ring progress SVG ────────────────────────────────────────────────────────

function RingProgress({ pct, size = 40, stroke = 3 }: {
    pct: number
    size?: number
    stroke?: number
}) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="currentColor" strokeWidth={stroke} className="text-border" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="currentColor" strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-foreground transition-all duration-700 ease-out" />
        </svg>
    )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon }: {
    label: string
    value: string | number
    sub: string
    icon: React.ElementType
}) {
    return (
        <div className="rounded-[12px] border border-border/50 bg-background px-4 py-4 space-y-2 shadow-sm transition-all hover:border-foreground/20 group">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-[6px] bg-foreground/[0.03] group-hover:bg-foreground/[0.06] transition-colors border border-border/30">
                    <Icon className="h-4 w-4 text-foreground/70" />
                </div>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80 capitalize">
                    {label.toLowerCase()}
                </span>
            </div>
            <p className="text-[22px] font-semibold text-foreground/90 tracking-tight truncate leading-none mt-1">
                {value}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground/60 truncate leading-none">{sub}</p>
        </div>
    )
}

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({ label, value, onSave }: {
    label: string
    value?: string
    onSave: (val: string) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value || '')
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => { if (editing) ref.current?.focus() }, [editing])

    const commit = () => { onSave(draft.trim()); setEditing(false) }
    const cancel = () => { setDraft(value || ''); setEditing(false) }

    if (editing) {
        return (
            <div className="flex flex-col gap-1.5 p-2 bg-foreground/[0.02] rounded-[8px] border border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1">
                    {label}
                </span>
                <div className="flex items-center gap-1.5">
                    <input
                        ref={ref}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') commit()
                            if (e.key === 'Escape') cancel()
                        }}
                        className="flex-1 rounded-[6px] border border-foreground/20 bg-background px-2.5 py-1 text-[13px] text-foreground/90 outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground/30 shadow-sm"
                        placeholder={`Enter ${label.toLowerCase()}…`}
                    />
                    <button onClick={commit}
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-foreground text-background bg-foreground hover:bg-foreground/90 transition-colors shadow-sm">
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={cancel}
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-border/60 bg-background text-muted-foreground hover:bg-accent/80 transition-colors shadow-sm">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="group flex flex-col gap-1 cursor-pointer p-2 rounded-[8px] border border-transparent hover:border-border/50 hover:bg-foreground/[0.015] transition-all" onClick={() => setEditing(true)}>
            <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1">
                {label}
            </span>
            <div className="flex items-start gap-2 justify-between px-1">
                {value ? (
                    <span className="text-[14px] text-foreground/90 font-medium leading-[1.6]">
                        {formatValue(value)}
                    </span>
                ) : (
                    <span className="text-[13px] text-muted-foreground/40 italic font-normal">
                        Add {label.toLowerCase()}...
                    </span>
                )}
                <Pencil className="h-3 w-3 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-40 text-foreground transition-opacity" />
            </div>
        </div>
    )
}

// ─── Array Item Dropdown Card ──────────────────────────────────────────────────

// ─── Editable Table Cell ───────────────────────────────────────────────────────

function EditableTableCell({ value, onSave }: { value: string, onSave: (val: string) => void }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => { if (editing) ref.current?.focus() }, [editing])

    const commit = () => { onSave(draft.trim()); setEditing(false) }
    const cancel = () => { setDraft(value || ''); setEditing(false) }

    if (editing) {
        return (
            <div className="flex items-center gap-1.5 min-w-[140px]">
                <input
                    ref={ref}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') cancel()
                    }}
                    className="flex-1 min-w-[80px] rounded bg-background border border-foreground/30 px-2 py-1 text-[13px] text-foreground/90 outline-none focus:border-foreground/50 transition-colors shadow-sm"
                />
                <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={commit} className="p-1 rounded border border-foreground bg-foreground text-background hover:bg-foreground/90 transition-colors">
                        <Check className="h-3 w-3" />
                    </button>
                    <button onClick={cancel} className="p-1 rounded border border-border/80 bg-background text-muted-foreground hover:bg-muted/50 transition-colors">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div
            onClick={() => setEditing(true)}
            className="group flex items-center justify-between cursor-pointer rounded px-2.5 py-1 -mx-2.5 hover:bg-foreground/[0.03] transition-colors border border-transparent hover:border-border/50 min-h-[28px]"
        >
            <span className="text-foreground/85 font-medium">{value}</span>
        </div>
    )
}

// ─── Array Group Card (Table) ──────────────────────────────────────────────────

function ArrayGroupCard({ title, items, fKey, onEdit, fullArray }: { title: string, items: any[], fKey: string, onEdit: (k: string, v: any) => void, fullArray: any[] }) {
    const [open, setOpen] = useState(false)

    // Collect all keys to form columns, excluding the title key for grouped items
    const allKeys = Array.from(new Set(items.flatMap(item => Object.keys(item))))

    // Determine which key was used for grouping to exclude it from table
    const groupKeys = ['qualification', 'degree', 'institution', 'company', 'category', 'type']
    const usedGroupKey = groupKeys.find(gk => items.every(item => item[gk] === title))

    const displayKeys = allKeys.filter(k => k !== usedGroupKey && k !== 'id' && !k.startsWith('_'))

    // Sort keys intelligently
    const important = ['subject', 'course', 'role', 'position', 'name', 'grade', 'percentage']
    const sortedKeys = displayKeys.sort((a, b) => {
        if (important.includes(a) && !important.includes(b)) return -1
        if (!important.includes(a) && important.includes(b)) return 1
        return 0
    })

    return (
        <div className={cn(
            'rounded-xl border transition-all duration-300 overflow-hidden',
            open ? 'border-border bg-card shadow-sm' : 'border-border/60 bg-foreground/[0.015] hover:border-border hover:bg-foreground/[0.03]'
        )}>
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-md bg-background border border-border/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Bookmark className="h-3.5 w-3.5 text-muted-foreground/80" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-semibold text-foreground/90">{title}</span>
                        <span className="text-[10px] bg-foreground/10 border border-foreground/5 px-2 py-0.5 rounded-full text-foreground/70 font-semibold tracking-wide">
                            {items.length} {items.length === 1 ? 'Item' : 'Items'}
                        </span>
                    </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground/50 transition-transform duration-300", open && "rotate-180")} />
            </button>

            {open && (
                <div className="border-t border-border/60 bg-background/40 overflow-x-auto scroller-style">
                    <table className="w-full text-left text-[13px] border-collapse min-w-[400px]">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/10">
                                {sortedKeys.map(k => (
                                    <th key={k} className="px-5 py-3 font-semibold text-muted-foreground/80 capitalize tracking-wide whitespace-nowrap">
                                        {k.replace(/_/g, ' ')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {items.map((item, i) => (
                                <tr key={i} className="hover:bg-muted/30 transition-colors group">
                                    {sortedKeys.map(k => (
                                        <td key={k} className="px-5 py-2.5 whitespace-nowrap align-middle">
                                            <EditableTableCell
                                                value={item[k] !== undefined && item[k] !== null ? String(item[k]) : '-'}
                                                onSave={newVal => {
                                                    const newArray = [...fullArray]
                                                    const trueIndex = fullArray.indexOf(item)
                                                    if (trueIndex > -1) {
                                                        newArray[trueIndex] = { ...fullArray[trueIndex], [k]: newVal }
                                                        onEdit(fKey, newArray)
                                                    }
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function renderArray(val: any[], fKey: string, onEdit: (k: string, v: any) => void) {
    if (val.length === 0) return null

    // Check if these are plain strings/numbers or objects
    const isObjects = val.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))
    if (!isObjects) {
        return (
            <div className="col-span-1 sm:col-span-2 space-y-2 mt-2" key={fKey}>
                <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1 capitalize">
                    {fKey.replace(/_/g, ' ')}
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                    {val.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-foreground/[0.03] border border-border/60 text-[13px] font-medium text-foreground/80 shadow-sm">
                            {String(item)}
                        </span>
                    ))}
                </div>
            </div>
        )
    }

    // Attempt to dynamically group objects (e.g. O Levels, A Levels)
    const groupKeys = ['qualification', 'degree', 'institution', 'company', 'category', 'type']
    let chosenGroupKey = ''
    for (const gk of groupKeys) {
        if (val.some(item => item[gk])) {
            chosenGroupKey = gk
            break
        }
    }

    if (chosenGroupKey) {
        const groups: Record<string, any[]> = {}
        const ungrouped: any[] = []
        val.forEach(item => {
            const gVal = item[chosenGroupKey]
            if (gVal) {
                const title = String(gVal)
                if (!groups[title]) groups[title] = []
                groups[title].push(item)
            } else {
                ungrouped.push(item)
            }
        })

        return (
            <div className="col-span-1 sm:col-span-2 space-y-2 mt-2" key={fKey}>
                <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1 capitalize">
                    {fKey.replace(/_/g, ' ')}
                </span>
                <div className="flex flex-col gap-2 mt-1">
                    {Object.entries(groups).map(([title, items]) => (
                        <ArrayGroupCard key={title} title={title} items={items} fKey={fKey} onEdit={onEdit} fullArray={val} />
                    ))}
                    {ungrouped.length > 0 && (
                        <ArrayGroupCard title="Other" items={ungrouped} fKey={fKey} onEdit={onEdit} fullArray={val} />
                    )}
                </div>
            </div>
        )
    }

    // Disparate objects, no grouping key found
    return (
        <div className="col-span-1 sm:col-span-2 space-y-2 mt-2" key={fKey}>
            <span className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-1 capitalize">
                {fKey.replace(/_/g, ' ')}
            </span>
            <ArrayGroupCard title={`${val.length} Entries`} items={val} fKey={fKey} onEdit={onEdit} fullArray={val} />
        </div>
    )
}

// ─── Collapsible profile section ──────────────────────────────────────────────

function ProfileSectionCard({ section, profile, onEdit, defaultOpen = false }: {
    section: { label: string, icon: any, fields: { key: string, label: string }[] }
    profile: ProfileData
    onEdit: (key: string, val: string) => void
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    const Icon = section.icon
    const filled = section.fields.filter(f => profile[f.key] !== undefined && profile[f.key] !== null && profile[f.key] !== '').length
    const total = section.fields.length
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0
    const allDone = total > 0 && filled === total

    return (
        <div className={cn(
            'rounded-xl border transition-all duration-200',
            open
                ? 'border-border bg-card'
                : 'border-border/50 bg-card/60 hover:border-border hover:bg-card/80',
        )}>
            <button
                onClick={() => setOpen(v => !v)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background">
                    <Icon className="h-3.5 w-3.5 text-foreground/60" />
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground/90">
                    {section.label}
                </span>
                <div className="flex items-center gap-3 mr-1">
                    {allDone ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Complete
                        </span>
                    ) : (
                        <>
                            <div className="h-1 w-16 rounded-full bg-border overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-foreground/60 transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">
                                {filled}/{total}
                            </span>
                        </>
                    )}
                </div>
                <ChevronDown className={cn(
                    'h-4 w-4 text-muted-foreground/50 transition-transform duration-200 flex-shrink-0',
                    open && 'rotate-180',
                )} />
            </button>

            {open && (
                <div className="border-t border-border/60 px-5 pt-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    {section.fields.map(f => {
                        const val = profile[f.key]
                        if (Array.isArray(val) && val.length > 0) {
                            return renderArray(val, f.key, onEdit)
                        }

                        return (
                            <EditableField
                                key={f.key}
                                label={f.label}
                                value={val as string | undefined}
                                onSave={newVal => onEdit(f.key, newVal)}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, todo, completedMap, isActive, onClick }: {
    goal: string
    todo?: TodoTask
    completedMap: Record<string, boolean[]>
    isActive: boolean
    onClick: () => void
}) {
    const completed = completedMap[goal] ?? []
    const tasks = todo ? flattenSections(todo) : []
    const total = tasks.length
    const done = completed.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    return (
        <button
            onClick={onClick}
            className={cn(
                'group w-full text-left rounded-xl border px-4 py-4 transition-all duration-150',
                isActive
                    ? 'border-foreground/25 bg-foreground/5 shadow-sm'
                    : 'border-border/50 bg-card/50 hover:border-border hover:bg-card',
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
                    isActive ? 'border-foreground/50' : 'border-border',
                )}>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-foreground/70" />}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                        {formatValue(goal)}
                    </p>
                    {total > 0 ? (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-0.5 rounded-full bg-border overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-foreground/55 transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="text-[10px] tabular-nums text-muted-foreground flex-shrink-0">
                                {done}/{total}
                            </span>
                        </div>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/70 animate-pulse" />
                            Generating plan…
                        </span>
                    )}
                </div>

                <ArrowUpRight className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 mt-0.5 transition-all',
                    isActive
                        ? 'text-foreground/40 opacity-100'
                        : 'text-foreground/0 group-hover:text-foreground/30 group-hover:opacity-100',
                )} />
            </div>
        </button>
    )
}

// ─── Collapsible todo section ─────────────────────────────────────────────────

// ─── Collapsible todo section (Legacy Formats) ─────────────────────────────────────────────────

function TodoSectionRow({ section, taskOffset, completed, onToggle, defaultOpen = true }: {
    section: TodoSection
    taskOffset: number       // index offset into the flat completed[] array
    completed: boolean[]
    onToggle: (idx: number) => void
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    const total = section.tasks.length
    const sectionCompleted = section.tasks.map((_, i) => completed[taskOffset + i])
    const done = sectionCompleted.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const allDone = total > 0 && done === total

    return (
        <div className={cn(
            'group rounded-xl border transition-all duration-200 overflow-hidden',
            open
                ? 'border-border bg-card shadow-sm'
                : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/70',
        )}>
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
                style={{
                    background: open
                        ? 'linear-gradient(to right, rgba(0,0,0,0.01), transparent)'
                        : 'none',
                }}
            >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-border/70 bg-gradient-to-br from-background to-muted/20">
                    <Layers className="h-3.5 w-3.5 text-foreground/50 group-hover:text-foreground/80 transition-colors" />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground/95 tracking-tight truncate leading-tight">
                        {section.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 opacity-80">
                        <div className="flex-1 max-w-[120px] h-[3px] rounded-full bg-border overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-700 ease-out',
                                    allDone ? 'bg-emerald-500' : 'bg-foreground/50'
                                )}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-[10px] tabular-nums font-medium text-muted-foreground">
                            {done}/{total}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {allDone && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                    )}
                    <ChevronRight className={cn(
                        'h-4 w-4 text-muted-foreground/40 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,',
                        open && 'rotate-90 text-foreground/60',
                    )} />
                </div>
            </button>

            <div className={cn(
                'grid transition-all duration-300 ease-in-out',
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}>
                <div className="overflow-hidden">
                    <div className="border-t border-border/40 bg-card/30 px-2 py-2 flex flex-col gap-0.5">
                        {section.tasks.map((task, idx) => {
                            const globalIdx = taskOffset + idx
                            const isDone = completed[globalIdx]
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onToggle(globalIdx)}
                                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-card/80 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                                >
                                    <div className={cn(
                                        'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border shadow-sm transition-all duration-200',
                                        isDone
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-border/80 bg-background hover:border-foreground/40'
                                    )}>
                                        {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                    </div>
                                    <span className={cn(
                                        'text-[13px] leading-relaxed transition-all duration-200',
                                        isDone
                                            ? 'text-muted-foreground/60 line-through decoration-muted-foreground/30'
                                            : 'text-foreground/90 font-medium'
                                    )}>
                                        {formatValue(task)}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Step row for new enriched format ──────────────────────────────────────────

function TodoStepRow({ step, index, isDone, onToggle, isInitialState = false }: {
    step: StepItem
    index: number
    isDone: boolean
    onToggle: () => void
    isInitialState?: boolean
}) {
    // Only open the first one initially if it's the initial render.
    // If not initial, default to closed unless otherwise driven by parent state or preference.
    // However, to keep it simple, let's open first incomplete step.
    const [open, setOpen] = useState(isInitialState && !isDone)

    // Automatically close when marked done, or open if not done and it's the first render basically
    useEffect(() => {
        if (isDone) setOpen(false)
    }, [isDone])

    return (
        <div className={cn(
            'group rounded-xl border transition-all duration-200 overflow-hidden',
            open
                ? 'border-border bg-card shadow-sm'
                : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/70',
        )}>
            <div className="flex w-full items-start px-4 py-3.5 gap-3">
                <button
                    onClick={onToggle}
                    className={cn(
                        'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border shadow-sm transition-all duration-200 cursor-pointer',
                        isDone
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-border/80 bg-background hover:border-foreground/40'
                    )}
                >
                    {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0" onClick={() => setOpen(!open)}>
                    <div className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                            STEP {step.step_number}
                        </span>
                        <h3 className={cn(
                            "text-sm font-semibold tracking-tight leading-tight transition-all",
                            isDone ? "text-muted-foreground line-through decoration-muted-foreground/30" : "text-foreground/95"
                        )}>
                            {step.title}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                        className="text-muted-foreground/40 hover:text-foreground/60 transition-colors p-1"
                    >
                        <ChevronDown className={cn(
                            'h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                            open && 'rotate-180 text-foreground/60',
                        )} />
                    </button>
                </div>
            </div>

            <div className={cn(
                'grid transition-all duration-300 ease-in-out',
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}>
                <div className="overflow-hidden">
                    <div className="border-t border-border/40 bg-card/30 px-11 py-3 text-[13px] leading-relaxed text-muted-foreground">
                        <p className={cn(isDone && 'opacity-60')}>
                            {step.description}
                        </p>

                        {step.links && step.links.length > 0 && (
                            <div className="mt-4 flex flex-col gap-2">
                                <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase opacity-80 mb-1">Recommended Resources</h4>
                                <div className="flex flex-wrap gap-2">
                                    {step.links.map((link, idx) => {
                                        let hostname = link;
                                        try { hostname = new URL(link).hostname.replace('www.', '') } catch (e) { }
                                        return (
                                            <a
                                                key={idx}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent/50 hover:text-foreground",
                                                    isDone ? "opacity-60 grayscale" : "text-foreground/80 hover:border-accent"
                                                )}
                                            >
                                                <Bookmark className="h-3 w-3 text-emerald-500/70" />
                                                <span className="truncate max-w-[200px]">{hostname}</span>
                                                <ArrowUpRight className="h-2.5 w-2.5 opacity-50" />
                                            </a>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Task list (with sections) ────────────────────────────────────────────────

function TaskList({ todo, completed, onToggle }: {
    todo: TodoTask
    completed: boolean[]
    onToggle: (idx: number) => void
}) {
    const flatTasks = flattenSections(todo)
    const total = flatTasks.length
    const done = completed.filter(Boolean).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    // Determine what mode we're in
    const isEnriched = !!(todo.steps && todo.steps.length > 0)

    // Legacy mapping
    const sections: TodoSection[] = !isEnriched && (todo.sections && todo.sections.length > 0)
        ? todo.sections
        : !isEnriched ? [{ name: 'Action Plan', tasks: todo.tasks ?? [] }] : []

    // Pre-compute task offsets for legacy grouping
    const offsets: number[] = []
    let cursor = 0
    for (const s of sections) {
        offsets.push(cursor)
        cursor += s.tasks.length
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3.5 bg-background/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Bookmark className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
                        <span className="text-xs font-medium text-foreground/80 truncate">
                            {formatValue(todo.goal)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        <RingProgress pct={pct} size={28} stroke={2.5} />
                        <span className="text-xs tabular-nums font-semibold text-foreground/70 w-9">
                            {pct}%
                        </span>
                    </div>
                </div>

                {/* Plan Content */}
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                    {todo.summary && (
                        <div className="rounded-lg bg-muted/30 px-4 py-3 border border-border/40">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" />
                                Strategy Overview
                            </h4>
                            <p className="text-[13px] leading-relaxed text-foreground/80">
                                {todo.summary}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {isEnriched ? (
                            // Render enriched steps
                            todo.steps!.map((step, idx) => (
                                <TodoStepRow
                                    key={idx}
                                    step={step}
                                    index={idx}
                                    isDone={completed[idx] ?? false}
                                    onToggle={() => onToggle(idx)}
                                    isInitialState={idx === done} // open the current next step
                                />
                            ))
                        ) : (
                            // Render legacy sections
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                {sections.map((section, si) => (
                                    <TodoSectionRow
                                        key={si}
                                        section={section}
                                        taskOffset={offsets[si]}
                                        completed={completed}
                                        onToggle={onToggle}
                                        defaultOpen={si === 0}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Progress */}
                <div className="border-t border-border/50 bg-background/30 px-5 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                        {done} of {total} steps completed
                    </span>
                    <div className="h-1 w-20 rounded-full bg-border overflow-hidden">
                        <div
                            className="h-full rounded-full bg-foreground/55 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Supplemental Enriched Data Widgets */}
            {isEnriched && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {todo.warnings && todo.warnings.length > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 col-span-1 md:col-span-2 overflow-hidden">
                            <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400/90 uppercase tracking-widest">
                                    Critical Warnings
                                </h4>
                            </div>
                            <div className="p-4">
                                <ul className="flex flex-col gap-2">
                                    {todo.warnings.map((w, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/80 leading-relaxed">
                                            <span className="text-amber-500 mt-0.5">•</span>
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {todo.documents && todo.documents.length > 0 && (
                        <div className="rounded-xl border border-border bg-card overflow-hidden">
                            <div className="border-b border-border/50 bg-muted/20 px-4 py-2.5 flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <h4 className="text-xs font-semibold text-foreground/75 uppercase tracking-widest">
                                    Documents Needed
                                </h4>
                            </div>
                            <div className="p-3">
                                <ul className="flex flex-col gap-2">
                                    {todo.documents.map((doc, i) => (
                                        <li key={i} className="rounded-lg border border-border/40 bg-background/50 p-2.5">
                                            <p className="text-[13px] font-medium text-foreground/90">{doc.name}</p>
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{doc.description}</p>
                                            {doc.url && (
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                                                    Template / Example <ArrowUpRight className="h-2.5 w-2.5" />
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
    const { user, isLoaded, isSignedIn } = useUser()
    const userId = user?.id

    const [profile, setProfile] = useState<ProfileData>({})
    const [goalsList, setGoalsList] = useState<string[]>([])
    const [todos, setTodos] = useState<TodoTask[]>([])
    const [generatedDocs, setGeneratedDocs] = useState<any[]>([])
    const [uploadedDocs, setUploadedDocs] = useState<any[]>([])
    const { openDoc } = useDocumentViewer()

    const [isFetchingDoc, setIsFetchingDoc] = useState(false)

    // Per-goal flat completion state — keyed by goal string
    const [completedMap, setCompletedMap] = useState<Record<string, boolean[]>>({})

    const [isLoading, setIsLoading] = useState(true)
    const [selectedGoalIdx, setSelectedGoalIdx] = useState(0)
    const [activeTab, setActiveTab] = useState<'goals' | 'profile' | 'documents' | 'settings'>('goals')

    const { preferences: prefs, updatePreferences } = useUserPreferences()

    // Merge incoming todos without destroying local completion state
    const mergeTodos = (incoming: TodoTask[]) => {
        setTodos(incoming)
        setCompletedMap(prev => {
            const next = { ...prev }
            for (const t of incoming) {
                const flatTasks = flattenSections(t)
                if (!next[t.goal] || next[t.goal].length !== flatTasks.length) {
                    // Seed from API completion data if present, else all false
                    next[t.goal] = t.completed ?? flatTasks.map(() => false)
                }
                // If length matches, keep existing local toggle state
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
                    fetch(`/api/documents?user_id=${userId}`).catch(() => ({ ok: false }))
                ])
                if (sRes.ok) {
                    const data = await sRes.json()
                    setProfile(data.profile_data || {})
                    const raw: string[] = data.goals || []
                    if (data.main_goal && !raw.includes(data.main_goal)) raw.unshift(data.main_goal)
                    setGoalsList(raw)
                    // Prefs are now handled by UserPreferencesProvider
                }
                if (tRes.ok) {
                    const rawTodos: RawTodosResponse = await tRes.json()
                    mergeTodos(normalizeTodos(rawTodos))
                }

                // Handle generated docs
                if (gRes && (gRes as any).ok) {
                    const docData = await (gRes as any).json();
                    if (docData.items) setGeneratedDocs(docData.items)
                }
                // Handle uploaded docs
                if (uRes && (uRes as any).ok) {
                    const uData = await (uRes as any).json();
                    setUploadedDocs(uData)
                }
            } catch (e) {
                console.error('Dashboard fetch error:', e)
            } finally {
                if (isInitial) setIsLoading(false)
            }
        }

        if (userId) {
            fetchAll(true)
            const id = setInterval(() => fetchAll(), 5000)
            return () => clearInterval(id)
        }
    }, [userId])

    const handleToggle = (goal: string, idx: number) => {
        setCompletedMap(prev => {
            const arr = [...(prev[goal] ?? [])]
            arr[idx] = !arr[idx]
            return { ...prev, [goal]: arr }
        })
    }

    const fetchAndOpenDoc = async (id: string, type: string) => {
        setIsFetchingDoc(true);
        try {
            const res = await fetch(`/api/documents/generated/${id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.documents && data.documents[type]) {
                    openDoc({ type, content: data.documents[type].content });
                }
            }
        } catch (e) {
            console.error("Failed to fetch doc", e);
        } finally {
            setIsFetchingDoc(false);
        }
    }

    const handleEdit = async (key: string, val: string) => {
        // Optimistically update local state
        setProfile(prev => ({ ...prev, [key]: val || undefined }))

        // Persist to backend
        if (!userId) return
        try {
            await fetch(`/api/user/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: val }),
            })
        } catch (e) {
            console.error('Failed to save profile field:', e)
        }
    }

    const { setTheme, theme: currentTheme } = useTheme()

    const handleUpdatePref = (newPrefs: any) => {
        updatePreferences(newPrefs)
    }

    const filledFields = Object.values(profile).filter(v => {
        if (!v) return false
        if (typeof v === 'string') return v.trim() !== ''
        // profile_data can contain dynamic fields (arrays/objects from LLM extraction)
        if (Array.isArray(v as unknown)) return (v as unknown as unknown[]).length > 0
        if (typeof v === 'object') return Object.keys(v as object).length > 0
        return true
    }).length

    const profilePct = Math.min(100, Math.round((filledFields / ESTIMATED_TOTAL_FIELDS) * 100))

    // Overall progress across all todos
    const totalTasks = todos.reduce((a, t) => a + flattenSections(t).length, 0)
    const totalDone = Object.values(completedMap).reduce((a, arr) => a + arr.filter(Boolean).length, 0)
    const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

    const activeGoal = goalsList[selectedGoalIdx]
    const activeTodo = todos.find(t => t.goal === activeGoal)

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex-1 h-screen overflow-y-auto bg-background flex items-center justify-center">
                <div className="flex gap-2">
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce-gpu" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex-1 h-screen overflow-y-auto bg-background">
                <div className="mx-auto max-w-5xl px-6 lg:px-10 py-10 space-y-5 animate-pulse">
                    <div className="h-10 w-56 rounded-xl bg-border/30" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-xl bg-border/20" />
                        ))}
                    </div>
                    <div className="h-10 w-40 rounded-xl bg-border/20" />
                    <div className="h-72 rounded-xl bg-border/20" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 h-screen overflow-y-auto bg-background">
            <div className="mx-auto max-w-5xl px-6 lg:px-10 py-8 lg:py-12 pb-24 space-y-7">

                {/* ── Header ───────────────────────────────────────────── */}
                <header className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
                            {profile.student_name
                                ? `${formatValue(profile.student_name)}'s Overview`
                                : 'Your Overview'}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-snug">
                            {profile.current_institution
                                ? `${formatValue(profile.current_institution)}${profile.current_major ? ` · ${formatValue(profile.current_major)}` : ''}`
                                : 'Keep chatting — your profile fills in automatically.'}
                        </p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2.5 rounded-full border border-border/60 bg-card/60 pl-3 pr-4 py-2">
                        <RingProgress pct={profilePct} size={22} stroke={2.5} />
                        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                            {profilePct}% profiled
                        </span>
                    </div>
                </header>

                {/* ── Stat strip ───────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        label="Goals"
                        value={goalsList.length || '—'}
                        sub={goalsList.length > 0
                            ? `${goalsList.length} path${goalsList.length !== 1 ? 's' : ''} identified`
                            : 'Still forming'}
                        icon={Target}
                    />
                    <StatCard
                        label="Progress"
                        value={`${overallPct}%`}
                        sub={totalTasks > 0
                            ? `${totalDone} of ${totalTasks} steps done`
                            : 'No plans yet'}
                        icon={TrendingUp}
                    />
                    <StatCard
                        label="Profile"
                        value={`${filledFields}/${Math.max(filledFields, ESTIMATED_TOTAL_FIELDS)}`}
                        sub="Fields gathered"
                        icon={BarChart3}
                    />
                    <StatCard
                        label="Location"
                        value={profile.location ? formatValue(profile.location) : '—'}
                        sub={profile.life_stage
                            ? formatValue(profile.life_stage)
                            : 'Stage unknown'}
                        icon={MapPin}
                    />
                </div>

                {/* ── Tab nav ──────────────────────────────────────────── */}
                <div className="flex gap-1 rounded-xl border border-border/60 bg-card/40 p-1 w-fit">
                    {(['goals', 'profile', 'documents', 'settings'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                'rounded-lg px-5 py-1.5 text-xs font-semibold transition-all duration-150',
                                activeTab === tab
                                    ? 'bg-foreground text-background shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab === 'goals' ? 'Goals & Plans' : tab === 'profile' ? 'Academic Profile' : tab === 'documents' ? 'Documents' : 'Settings'}
                        </button>
                    ))}
                </div>

                {/* ── Goals tab ────────────────────────────────────────── */}
                {activeTab === 'goals' && (
                    goalsList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-20 text-center">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background">
                                <Sparkles className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground/80">
                                    No paths identified yet
                                </p>
                                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                    Keep chatting with the consultant. Once your direction is clear, goals and action plans will appear here automatically.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                            {/* Goal selector */}
                            <div className="space-y-2">
                                <p className="px-1 mb-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                                    Identified paths
                                </p>
                                {goalsList.map((goal, idx) => (
                                    <GoalCard
                                        key={idx}
                                        goal={goal}
                                        todo={todos.find(t => t.goal === goal)}
                                        completedMap={completedMap}
                                        isActive={selectedGoalIdx === idx}
                                        onClick={() => setSelectedGoalIdx(idx)}
                                    />
                                ))}
                            </div>

                            {/* Action plan with sections */}
                            <div>
                                <p className="px-1 mb-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                                    Action plan
                                </p>
                                {activeTodo ? (
                                    <TaskList
                                        todo={activeTodo}
                                        completed={completedMap[activeGoal] ?? []}
                                        onToggle={(idx) => handleToggle(activeGoal, idx)}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-card/30 px-8 py-14 text-center">
                                        <FileText className="h-5 w-5 text-muted-foreground/50" />
                                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                            We're still building the step-by-step plan for this path. It'll appear here once ready.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* ── Profile tab ──────────────────────────────────────── */}
                {activeTab === 'profile' && (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/30 px-4 py-3 mb-4">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Click any field to edit it. Changes are saved to your profile automatically.
                            </p>
                        </div>

                        {getDynamicSections(profile).length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-20 text-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background">
                                    <User className="h-5 w-5 text-muted-foreground/60" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground/80">
                                        Your profile is currently empty
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                        Start chatting with the AI consultant. As you share details about your academic background, they will appear here automatically.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            getDynamicSections(profile).map((section, i) => (
                                <ProfileSectionCard
                                    key={section.label}
                                    section={section as any}
                                    profile={profile}
                                    onEdit={handleEdit}
                                    defaultOpen={i < 2}
                                />
                            ))
                        )}
                    </div>
                )}

                {/* ── Documents tab ──────────────────────────────────────── */}
                {activeTab === 'documents' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {(generatedDocs.length === 0 && uploadedDocs.length === 0) ? (
                            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-20 text-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background">
                                    <FileText className="h-5 w-5 text-muted-foreground/60" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground/80">
                                        No documents found
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                        Documents you upload or generate with the AI consultant will appear here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {generatedDocs.length > 0 && (
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-2 px-1">
                                            <Sparkles className="h-4 w-4 text-primary/60" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">Generated by AI</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {generatedDocs.flatMap((doc: any) =>
                                                Object.keys(doc.document_previews || {}).map(type => ({ ...doc, activeDocType: type }))
                                            ).map((item: any, i: number) => {
                                                const docType = item.activeDocType;
                                                const preview = item.document_previews[docType];
                                                return (
                                                    <div
                                                        key={`gen-${item.id}-${docType}`}
                                                        className="group/doc relative flex flex-col w-full h-[320px] rounded-xl border border-border/40 bg-background overflow-hidden hover:border-foreground/30 hover:shadow-xl transition-all duration-300 transform active:scale-[0.98] shadow-sm"
                                                    >
                                                        {/* Preview */}
                                                        <div className="flex-1 w-full bg-muted/20 p-4 overflow-hidden pointer-events-none relative select-none">
                                                            <div className="scale-[0.4] origin-top-left w-[250%] opacity-40 grayscale group-hover/doc:grayscale-0 group-hover/doc:opacity-60 transition-all duration-500">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                                                                        h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-1" {...props} />,
                                                                        p: ({ node, ...props }) => <p className="text-sm leading-relaxed mb-1" {...props} />,
                                                                    }}
                                                                >
                                                                    {preview?.content?.slice(0, 1000) || "No preview available"}
                                                                </ReactMarkdown>
                                                            </div>
                                                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
                                                        </div>

                                                        {/* Footer */}
                                                        <div className="p-4 border-t border-border/40 bg-background z-20">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <FileText className="h-4 w-4 text-foreground/60" aria-hidden="true" />
                                                                <h4 className="text-[12px] font-bold text-foreground/80 tracking-tight uppercase truncate">{docType.replace(/_/g, ' ')}</h4>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] text-muted-foreground font-medium truncate">
                                                                    {new Date(item.created_at).toLocaleDateString()}
                                                                </p>
                                                                <button
                                                                    onClick={() => fetchAndOpenDoc(item.id, docType)}
                                                                    disabled={isFetchingDoc}
                                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                                                                >
                                                                    {isFetchingDoc ? 'Loading...' : 'Open'}
                                                                    <ArrowUpRight className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div
                                                            className="absolute inset-0 bg-foreground/5 opacity-0 group-hover/doc:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] cursor-pointer"
                                                            onClick={() => fetchAndOpenDoc(item.id, docType)}
                                                        >
                                                            <div className="bg-background/90 text-[10px] font-bold px-4 py-2 rounded-full border border-border/50 shadow-sm text-foreground uppercase tracking-widest">
                                                                {isFetchingDoc ? 'Fetching...' : 'View Full Document'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {uploadedDocs.length > 0 && (
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-2 px-1">
                                            <FileText className="h-4 w-4 text-primary/60" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">Uploaded Documents</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {uploadedDocs.map((doc: any) => (
                                                <div
                                                    key={`up-${doc.id}`}
                                                    className="group/doc relative flex flex-col w-full h-32 rounded-xl border border-border/40 bg-background overflow-hidden hover:border-foreground/30 hover:shadow-xl transition-all duration-300 transform active:scale-[0.98] shadow-sm p-4"
                                                >
                                                    <div className="flex items-center gap-4 h-full">
                                                        <div className="h-10 w-10 rounded-lg bg-foreground/[0.03] border border-border/40 flex items-center justify-center flex-shrink-0">
                                                            <FileText className="h-5 w-5 text-muted-foreground/60" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-semibold text-foreground/90 truncate mb-1">{doc.document_name}</h4>
                                                            <p className="text-[10px] text-muted-foreground font-medium truncate uppercase tracking-wider">
                                                                {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.uploaded_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => openDoc({ type: doc.document_name, url: `/api/documents/${doc.id}/view` })}
                                                            className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                                                        >
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Settings tab ─────────────────────────────────────── */}
                {activeTab === 'settings' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 lg:p-8 space-y-8">

                            {/* Theme Selector */}
                            {/* Theme Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground/70">
                                    <Palette className="h-4 w-4" />
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Appearance</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'light', name: 'Minimalist Slate', color: 'bg-slate-50' },
                                        { id: 'dark', name: 'Midnight Obsidian', color: 'bg-[#0f172a]' },
                                        { id: 'solar', name: 'Solar Sand', color: 'bg-[#fdf6e3]' },
                                        { id: 'emerald', name: 'Emerald Forest', color: 'bg-[#064e3b]' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => updatePreferences({ theme: t.id })}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-[8px] border transition-all text-left",
                                                currentTheme === t.id
                                                    ? "border-foreground bg-foreground/[0.03]"
                                                    : "border-border/60 hover:border-border hover:bg-foreground/[0.015]"
                                            )}
                                        >
                                            <div className={cn("h-4 w-4 rounded-full border border-border flex-shrink-0 shadow-sm", t.color)} />
                                            <span className="text-[12px] font-medium text-foreground/90 truncate">{t.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-border/40" />

                            {/* Persona Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground/70">
                                    <User className="h-4 w-4" />
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Study Persona</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { id: 'smart', name: 'Scholar', trait: 'Intellectual' },
                                        { id: 'sporty', name: 'Athlete', trait: 'High Energy' },
                                        { id: 'creative', name: 'Artist', trait: 'Visionary' },
                                        { id: 'zen', name: 'Sage', trait: 'Calm' },
                                    ].map((a) => (
                                        <button
                                            key={a.id}
                                            onClick={() => updatePreferences({ avatar: a.id })}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-4 rounded-[8px] border transition-all",
                                                prefs.avatar === a.id
                                                    ? "border-foreground bg-foreground/[0.03]"
                                                    : "border-border/60 hover:border-border hover:bg-foreground/[0.015]"
                                            )}
                                        >
                                            <div className="h-[42px] w-[42px] rounded-full overflow-hidden bg-muted/30 border border-border/50 flex flex-shrink-0 items-center justify-center">
                                                <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${a.id}&backgroundColor=transparent`} alt={a.name} className="h-[90%] w-[90%] object-contain" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[12px] font-medium leading-none mb-1 text-foreground/90">{a.name}</p>
                                                <p className="text-[10px] text-muted-foreground/60">{a.trait}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-border/40" />

                        </div>
                    </div>
                )}

                {/* Premium Full-Screen Document Viewer removed from here - now in DocumentViewerProvider */}


            </div>
        </div>
    )
}
