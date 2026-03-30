'use client'

import {
    GraduationCap,
    BookOpen,
    Briefcase,
    FileEdit,
    FlaskConical,
    Languages,
    Brain,
    Target,
    ArrowLeft
} from 'lucide-react'

interface ExploreAgentsProps {
    onBack: () => void
}

const agents = [
    {
        id: 'study-advisor',
        name: 'Study Advisor',
        description: 'Get personalized study plans and academic guidance tailored to your goals.',
        icon: GraduationCap,
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
        id: 'career-coach',
        name: 'Career Coach',
        description: 'Explore career paths, internships, and professional development opportunities.',
        icon: Briefcase,
        color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
        id: 'essay-reviewer',
        name: 'Essay Reviewer',
        description: 'Get detailed feedback on your personal statements and application essays.',
        icon: FileEdit,
        color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
        id: 'test-prep',
        name: 'Test Prep',
        description: 'Prepare for SAT, GRE, IELTS, and other standardized tests with practice.',
        icon: Target,
        color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
        id: 'research-assistant',
        name: 'Research Assistant',
        description: 'Find research opportunities, build proposals, and strengthen your portfolio.',
        icon: FlaskConical,
        color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
    {
        id: 'language-tutor',
        name: 'Language Tutor',
        description: 'Practice conversational skills and improve your academic writing fluency.',
        icon: Languages,
        color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
    {
        id: 'scholarship-finder',
        name: 'Scholarship Finder',
        description: 'Discover scholarships and financial aid matching your profile and goals.',
        icon: BookOpen,
        color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
    {
        id: 'ai-mentor',
        name: 'AI Mentor',
        description: 'Get holistic mentorship combining academic, career, and personal growth advice.',
        icon: Brain,
        color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    },
]


/**
 * ExploreAgents component displays a grid of available specialized AI mentors.
 * Each agent card features a unique icon, color theme, and description.
 */
export function ExploreAgents({ onBack }: ExploreAgentsProps) {
    return (
        <div className="flex-1 flex flex-col h-screen">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-10">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                            aria-label="Back to Chat"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to Chat
                        </button>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Explore Agents
                        </h1>
                        <p className="text-muted-foreground mt-1.5 text-sm">
                            Specialized AI agents to help with different aspects of your academic journey.
                        </p>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
                        {agents.map((agent, i) => {
                            const Icon = agent.icon
                            return (
                                <div
                                    key={agent.id}
                                    role="listitem"
                                    onClick={onBack}
                                    aria-label={`Select ${agent.name} agent`}
                                    className="group rounded-xl border border-border/60 bg-card p-5 hover:border-border hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-in outline-none focus-visible:ring-2 focus-visible:ring-ring click-scale"
                                    style={{ animationDelay: `${i * 40}ms` }}
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && onBack()}
                                >
                                    <div className={`h-10 w-10 rounded-xl ${agent.color} flex items-center justify-center mb-3.5`} aria-hidden="true">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-sm font-semibold mb-1">
                                        {agent.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                                        {agent.description}
                                    </p>
                                    <span className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors inline-flex items-center gap-1">
                                        Start Chat <span aria-hidden="true">→</span>
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
