'use client'

import { useState, useEffect } from 'react'
import { Flame, Target, Trophy, Target as TargetIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays, isSameDay, parseISO } from 'date-fns'

interface MomentumData {
    current_streak: number
    longest_streak: number
    total_completions: number
    activity_log: { date: string, note: string }[]
    roadmap_progress: {
        completed: number
        total: number
        percentage: number
    }
    deadlines: { date: string, university: string, status: string }[]
}

interface Props {
    userId: string | null
}

export function MomentumPanel({ userId }: Props) {
    const [data, setData] = useState<MomentumData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Generate last 14 weeks (98 days) for the heatmap
    const totalDays = 98
    const [heatmapDays, setHeatmapDays] = useState<Date[]>([])

    useEffect(() => {
        const days = []
        for (let i = totalDays - 1; i >= 0; i--) {
            days.push(subDays(new Date(), i))
        }
        setHeatmapDays(days)
    }, [])

    useEffect(() => {
        async function fetchMomentum() {
            if (!userId) return
            try {
                const res = await fetch(`/api/applications/${userId}/momentum`)
                if (res.ok) {
                    setData(await res.json())
                }
            } catch (e) {
                console.error("Failed to fetch momentum", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchMomentum()

        // Refresh every minute to catch updates
        const interval = setInterval(fetchMomentum, 60000)
        return () => clearInterval(interval)
    }, [userId])

    if (isLoading) return null
    if (!data) return null

    // Determine Heatmap color for a specific day
    const getDayIntensity = (day: Date) => {
        if (!data.activity_log) return 0
        const activeLog = data.activity_log.find(l => isSameDay(parseISO(l.date), day))
        return activeLog ? 1 : 0
    }

    // Determine if day has a deadline
    const getDeadline = (day: Date) => {
        if (!data.deadlines) return null
        return data.deadlines.find(d => isSameDay(parseISO(d.date), day))
    }

    // Milestones (25%, 50%, 75%, 100%)
    const pct = data.roadmap_progress.percentage || 0
    const milestoneStr = pct >= 100 ? "Completion" :
        pct >= 75 ? "Deep Phase" :
            pct >= 50 ? "Halfway" :
                pct >= 25 ? "Getting Started" : "Initiation"

    return (
        <div className="w-full flex flex-col gap-6 p-6 rounded-2xl border border-border bg-background">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Activity & Momentum</h3>
                    <p className="text-xs text-muted-foreground/80 mt-1">Consistency is the single biggest predictor of admission success.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Streak Metric */}
                <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                        <Flame className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</p>
                        <p className="text-lg font-bold tabular-nums text-foreground">{data.current_streak} <span className="text-sm font-medium text-muted-foreground">days</span></p>
                    </div>
                </div>

                {/* Total Tasks Metric */}
                <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                        <TargetIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roadmap</p>
                        <p className="text-lg font-bold tabular-nums text-foreground">{data.roadmap_progress.completed}<span className="text-sm font-medium text-muted-foreground">/{data.roadmap_progress.total || 0}</span></p>
                    </div>
                </div>

                {/* Milestone Progress */}
                <div className="col-span-1 md:col-span-2 flex flex-col justify-center gap-2 py-2 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Phase</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">{milestoneStr} — {pct}%</p>
                    </div>
                    <div className="h-2 w-full bg-border/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-foreground transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="flex flex-col gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
                <div className="w-[850px] flex gap-1">
                    {/* Render columns (weeks) */}
                    {Array.from({ length: 14 }).map((_, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-1">
                            {Array.from({ length: 7 }).map((_, dayIndex) => {
                                const dayObj = heatmapDays[weekIndex * 7 + dayIndex]
                                if (!dayObj) return <div key={dayIndex} className="w-4 h-4" />

                                const intensity = getDayIntensity(dayObj)
                                const deadline = getDeadline(dayObj)
                                const isToday = isSameDay(dayObj, new Date())

                                return (
                                    <div
                                        key={dayIndex}
                                        title={`${format(dayObj, 'MMM d, yyyy')}${intensity ? ' — Active' : ''}${deadline ? ` — Deadline: ${deadline.university}` : ''}`}
                                        className={cn(
                                            "w-4 h-4 rounded-[3px] transition-all cursor-help relative group",
                                            intensity ? "bg-foreground" : "bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                                            isToday && !intensity && "border border-foreground/30",
                                            deadline && "ring-1 ring-offset-1 ring-red-500"
                                        )}
                                    >
                                        {deadline && (
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium mt-1 w-[850px]">
                    <p>Last 98 days</p>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm ring-1 ring-offset-1 ring-red-500 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"><div className="w-1 h-1 rounded-full bg-red-500" /></div>
                            <span>Deadline</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
                            <span>Idle</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-foreground" />
                            <span>Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
