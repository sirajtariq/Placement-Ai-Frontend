'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
    Check,
    ArrowRight,
    Upload,
    Sparkles,
    Camera
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast, Toaster } from 'sonner'
import { useUserPreferences } from '@/components/providers/UserPreferencesProvider'

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES = [
    { id: 'dark', name: 'Midnight Obsidian', description: 'Deep, focused dark mode', color: 'bg-[#0f172a]' },
    { id: 'light', name: 'Minimalist Slate', description: 'Clean and airy light mode', color: 'bg-slate-50' },
    { id: 'solar', name: 'Solar Sand', description: 'Warm tones', color: 'bg-[#fdf6e3]' },
    { id: 'emerald', name: 'Emerald Forest', description: 'Green accents', color: 'bg-[#064e3b]' },
]

const AVATARS = [
    { id: 'smart', name: 'Scholar', trait: 'Intellectual', emoji: '🤓' },
    { id: 'sporty', name: 'Athlete', trait: 'High Energy', emoji: '🏃' },
    { id: 'creative', name: 'Artist', trait: 'Visionary', emoji: '🎨' },
    { id: 'zen', name: 'Sage', trait: 'Calm', emoji: '🧘' },
]

// ─── Main Onboarding Component ────────────────────────────────────────────────

export default function OnboardingPage() {
    const { user, isLoaded } = useUser()
    const router = useRouter()
    const { setTheme } = useTheme()
    const { updatePreferences } = useUserPreferences()
    const [step, setStep] = useState(1)
    const totalSteps = 3

    // State
    const [selectedTheme, setSelectedTheme] = useState('dark')
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1)
        else finishOnboarding()
    }

    const finishOnboarding = async () => {
        if (!user) return

        try {
            await updatePreferences({
                theme: selectedTheme,
                avatar: selectedAvatar,
                profile_pic: profilePicUrl,
                onboarding_completed: true as any,
            })

            await fetch('/api/user/onboarding-complete', { method: 'POST' })

            // Force a reload of the user object to get the new publicMetadata
            // before we redirect to the home page where the guard runs.
            await user.reload()

            toast.success('Welcome aboard! Redirecting...')
            setTimeout(() => router.push('/'), 1500)
        } catch (error) {
            console.error(error)
            toast.error('Something went wrong. Please try again.')
        }
    }

    if (!isLoaded) return null

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 font-sans">
            <Toaster position="top-center" richColors />

            <div className="w-full max-w-lg bg-card rounded-[12px] border border-border/50 shadow-sm overflow-hidden animate-modal-in flex flex-col">
                {/* Progress Bar */}
                <div className="h-[3px] w-full bg-border/40">
                    <motion.div
                        className="h-full bg-foreground"
                        initial={{ width: 0 }}
                        animate={{ width: `${(step / totalSteps) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                <div className="p-8 sm:p-10 space-y-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="space-y-1.5">
                                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground/90">Style your workspace</h1>
                                    <p className="text-[13px] text-muted-foreground/80 leading-relaxed">Choose a theme that inspires your focus.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {THEMES.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setSelectedTheme(t.id)
                                                setTheme(t.id)
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-[8px] border text-left transition-all group",
                                                selectedTheme === t.id
                                                    ? "border-foreground bg-foreground/[0.03]"
                                                    : "border-border/60 hover:border-border hover:bg-foreground/[0.015]"
                                            )}
                                        >
                                            <div className={cn("h-4 w-4 rounded-full border border-border flex-shrink-0 shadow-sm", t.color)} />
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-medium leading-none mb-1 text-foreground/90">{t.name}</p>
                                                <p className="text-[11px] text-muted-foreground/60 truncate">{t.description}</p>
                                            </div>
                                            {selectedTheme === t.id && <Check className="h-3.5 w-3.5 text-foreground ml-auto flex-shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="space-y-1.5">
                                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground/90">Choose your persona</h1>
                                    <p className="text-[13px] text-muted-foreground/80 leading-relaxed">Pick an avatar that represents your academic energy.</p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {AVATARS.map((a) => (
                                        <button
                                            key={a.id}
                                            onClick={() => setSelectedAvatar(a.id)}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-4 rounded-[8px] border transition-all",
                                                selectedAvatar === a.id
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
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="space-y-1.5">
                                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground/90">Profile Picture</h1>
                                    <p className="text-[13px] text-muted-foreground/80 leading-relaxed">Upload a picture to personalize your experience.</p>
                                </div>

                                <div className="flex flex-col items-center gap-6">
                                    <div className="relative group">
                                        <div className="h-[90px] w-[90px] rounded-full border border-dashed border-border flex items-center justify-center overflow-hidden bg-foreground/[0.01] transition-colors group-hover:border-foreground/30 group-hover:bg-foreground/[0.03]">
                                            {profilePicUrl || user?.imageUrl ? (
                                                <img src={profilePicUrl || user?.imageUrl} alt="Profile" className="h-full w-full object-cover" />
                                            ) : (
                                                <Camera className="h-6 w-6 text-muted-foreground/30" />
                                            )}
                                        </div>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                                            <Upload className="h-5 w-5 text-white" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0]
                                                    if (!file) return
                                                    setUploading(true)
                                                    const reader = new FileReader()
                                                    reader.onload = (ev) => {
                                                        setProfilePicUrl(ev.target?.result as string)
                                                        setUploading(false)
                                                    }
                                                    reader.readAsDataURL(file)
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Click to upload photo</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between pt-4">
                        {step > 1 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="text-[12px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors px-2 py-1.5 rounded-[6px] hover:bg-foreground/[0.02]"
                            >
                                Back
                            </button>
                        ) : <div />}

                        <button
                            onClick={handleNext}
                            disabled={uploading || (step === 2 && !selectedAvatar)}
                            className="bg-foreground text-background text-[12px] font-medium px-5 py-2 rounded-[6px] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:pointer-events-none hover:bg-foreground/90"
                        >
                            {step === totalSteps ? 'Finish Setting Up' : 'Continue'}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex gap-1.5">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-[3px] rounded-full transition-colors",
                            step === i ? "bg-foreground/40 w-4" : "bg-foreground/10 w-[3px]"
                        )}
                    />
                ))}
            </div>
        </div>
    )
}
