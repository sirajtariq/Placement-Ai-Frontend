import { memo, useState, useCallback, useMemo } from 'react'
import { GraduationCap, Copy, Check, FileText, X, Download, Maximize2, Github, ExternalLink, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { useDocumentViewer } from '@/components/providers/DocumentViewerProvider'

interface MessageBubbleProps {
    message: {
        id: number
        content: string
        sender: 'user' | 'assistant'
        timestamp: string
        documents?: { type: string; content: string; id: string; country?: string }[]
    }
    userImage?: string | null
    userAvatar?: string | null
    clerkImage?: string
}

export const MessageBubble = memo(function MessageBubble({ message, userImage, userAvatar, clerkImage }: MessageBubbleProps) {
    const isUser = message.sender === 'user'
    const [copied, setCopied] = useState(false)
    const { openDoc } = useDocumentViewer()

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const renderUserIcon = (type: string | null | undefined) => {
        // Use DiceBear Micah collection for premium animated character style avatars
        const seed = type || 'Felix';
        const avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${seed}&backgroundColor=transparent`;

        return (
            <div className="h-full w-full bg-muted/30 flex items-center justify-center">
                <img src={avatarUrl} alt="Avatar" className="h-[90%] w-[90%] object-contain" />
            </div>
        );
    }

    return (
        <div className={cn(
            'flex gap-3 max-w-3xl mx-auto animate-fade-in group relative mb-4',
            isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
            {/* AI Avatar */}
            {!isUser && (
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-foreground/[0.03] flex items-center justify-center mt-0.5" aria-hidden="true">
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
            )}

            <div className={cn(
                'flex flex-col',
                isUser ? 'items-end' : 'items-start',
                'max-w-[75%]'
            )}>
                {/* Meta Info on hover */}
                <div className={cn(
                    "flex items-center gap-2 mb-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200",
                    isUser ? "flex-row-reverse" : "flex-row"
                )}>
                    <span className="text-[11px] text-muted-foreground/60 font-medium tracking-wide">
                        {message.timestamp}
                    </span>
                    {!isUser && (
                        <button
                            onClick={handleCopy}
                            className="p-1 rounded-md hover:bg-foreground/[0.05] text-muted-foreground/40 hover:text-foreground/80 transition-colors click-scale"
                            title="Copy message"
                            aria-label="Copy message"
                        >
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                    )}
                </div>

                <div className={cn(
                    'text-sm leading-relaxed transition-all duration-200',
                    isUser ? 'bg-muted border border-border/50 text-foreground px-4 py-2.5 rounded-xl font-medium text-right shadow-sm' : 'text-foreground/90 pt-0.5'
                )}>
                    <div className="whitespace-pre-wrap flex flex-col gap-2">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                a: ({ node, ...props }) => (
                                    <a
                                        {...props}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground underline underline-offset-2 font-medium transition-colors"
                                    />
                                ),
                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-1 space-y-1" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-1 space-y-1" {...props} />,
                                li: ({ node, ...props }) => <li className="leading-snug" {...props} />,
                                strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>

                    {message.documents && message.documents.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-4">
                            {message.documents.map((doc, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => openDoc(doc)}
                                    aria-label={`View ${doc.type.replace(/_/g, ' ')}`}
                                    className="group/doc relative flex flex-col w-[180px] h-[240px] rounded-md border border-border/30 bg-background overflow-hidden hover:border-foreground/30 hover:shadow-xl transition-all duration-300 transform "
                                >
                                    {/* Mini PDF Preview Overlay */}
                                    <div className="flex-1 w-full bg-muted/20 p-3 overflow-hidden pointer-events-none relative select-none">
                                        <div className="scale-[0.35] origin-top-left w-[250%] opacity-40 grayscale group-hover/doc:grayscale-0 group-hover/doc:opacity-60 transition-all duration-500">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                                                    h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-1" {...props} />,
                                                    p: ({ node, ...props }) => <p className="text-sm leading-relaxed mb-1" {...props} />,
                                                }}
                                            >
                                                {doc.content.slice(0, 800)}
                                            </ReactMarkdown>
                                        </div>
                                        {/* Gradient Fade */}
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
                                    </div>

                                    {/* Card Footer */}
                                    <div className="p-3 border-t border-border/40 bg-background z-20">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                                            <h4 className="text-[11px] font-bold text-foreground/80 tracking-tight uppercase truncate">{doc.type.replace(/_/g, ' ')}</h4>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium truncate">
                                            {doc.country ? `${doc.country} Format` : 'Professional Draft'}
                                        </p>
                                    </div>

                                    {/* Hover Action Blur */}
                                    <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover/doc:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                        <div className="bg-background/90 text-[10px] font-bold px-3 py-1.5 rounded-full border border-border/50 shadow-sm text-foreground uppercase tracking-widest">View Full</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* User Avatar */}
            {
                isUser && (
                    <div className="flex-shrink-0 h-6 w-6 rounded-full overflow-hidden flex items-center justify-center bg-foreground/[0.03] mt-0.5">
                        {userImage ? (
                            <img
                                src={userImage}
                                alt="You"
                                className="h-full w-full object-cover"
                            />
                        ) : clerkImage ? (
                            <img
                                src={clerkImage}
                                alt="You"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            renderUserIcon(userAvatar)
                        )}
                    </div>
                )
            }

            {/* Premium Full-Screen Document Viewer removed from here - now in DocumentViewerProvider */}
        </div >
    )
})
