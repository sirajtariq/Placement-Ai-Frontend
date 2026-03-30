'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { GraduationCap, Copy, Check, FileText, X, Download, Printer } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Document {
    type: string
    content?: string
    url?: string
    mimeType?: string
}

interface DocumentViewerContextType {
    openDoc: (doc: Document) => void
    closeDoc: () => void
}

const DocumentViewerContext = createContext<DocumentViewerContextType | undefined>(undefined)

export function DocumentViewerProvider({ children }: { children: React.ReactNode }) {
    const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
    const [copied, setCopied] = useState(false)

    const openDoc = useCallback((doc: Document) => {
        setViewingDoc(doc)
    }, [])

    const closeDoc = useCallback(() => {
        setViewingDoc(null)
    }, [])

    const downloadDocument = useCallback((doc: Document) => {
        if (!doc.content) return;
        const blob = new Blob([doc.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.type.replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const handleCopy = useCallback((content: string | undefined) => {
        if (!content) return;
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const contextValue = useMemo(() => ({ openDoc, closeDoc }), [openDoc, closeDoc])

    return (
        <DocumentViewerContext.Provider value={contextValue}>
            {children}

            <AnimatePresence>
                {viewingDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] flex flex-col bg-background/98 backdrop-blur-sm overflow-hidden shadow-2xl"
                    >
                        {/* Immersive Header (Refined for Industry Grade) */}
                        <header className="flex items-center justify-between px-6 py-2.5 border-b border-border/40 bg-background/60 backdrop-blur-md z-20">
                            <div className="flex items-center gap-4">
                                <div className="h-7 w-7 rounded-[4px] bg-foreground flex items-center justify-center shadow-sm">
                                    <FileText className="h-3.5 w-3.5 text-background" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-bold tracking-tight text-foreground/90 capitalize leading-none mb-0.5">
                                        {viewingDoc.type.replace(/_/g, ' ')}
                                    </h3>
                                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">Verified Professional Proof</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center p-1 rounded-[6px] border border-border/30 bg-muted/10">
                                    <button
                                        onClick={() => handleCopy(viewingDoc.content)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-foreground/60 hover:text-foreground hover:bg-background rounded-[4px] transition-all duration-200 active:scale-95 group"
                                    >
                                        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                        <span className="hidden sm:inline uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
                                    </button>

                                    <button
                                        onClick={() => downloadDocument(viewingDoc)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-foreground/60 hover:text-foreground hover:bg-background rounded-[4px] transition-all duration-200 active:scale-95"
                                    >
                                        <Download className="h-3 w-3" />
                                        <span className="hidden sm:inline uppercase tracking-wider">Export</span>
                                    </button>

                                    <div className="w-px h-3 bg-border/40 mx-1" />

                                    <button
                                        onClick={() => window.print()}
                                        className="p-1 px-2 hover:bg-background rounded-[4px] transition-all duration-200 text-foreground/50 hover:text-foreground active:scale-95"
                                        title="Print"
                                    >
                                        <Printer className="h-3 w-3" />
                                    </button>
                                </div>

                                <button
                                    onClick={closeDoc}
                                    className="p-1.5 hover:bg-red-500/5 hover:text-red-600 rounded-[4px] transition-all duration-200 active:scale-95"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </header>

                        {/* Immersive Scroll View */}
                        <div className="flex-1 overflow-y-auto w-full flex justify-center bg-muted/5 selection:bg-foreground selection:text-background py-16 px-4 md:px-8 custom-scrollbar">
                            <motion.div
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="w-full max-w-[850px] relative"
                            >
                                {/* Decorative Page Shadow Stack */}
                                <div className="absolute -inset-2 bg-gradient-to-b from-foreground/5 to-transparent blur-3xl opacity-20 -z-10" />

                                {/* The Paper Surface (Refined Sans-Serif) */}
                                <div className="bg-background min-h-[1100px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1),0_10px_30px_-15px_rgba(0,0,0,0.05)] border border-border/30 rounded-[2px] p-12 md:p-20 relative overflow-hidden">
                                    {/* Subtle Paper Texture Overlay */}
                                    <div className="absolute inset-0 opacity-[0.015] pointer-events-none grayscale contrast-125" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/natural-paper.png")' }} />

                                    <article className="relative z-10 prose prose-slate dark:prose-invert max-w-none 
                                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
                                        prose-h1:text-[30px] prose-h1:leading-tight prose-h1:mb-8 prose-h1:pb-6 prose-h1:border-b border-border/40
                                        prose-h2:text-[20px] prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-foreground/90
                                        prose-h3:text-[16px] prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-foreground/80
                                        prose-p:text-[14px] prose-p:leading-[1.7] prose-p:text-foreground/70 prose-p:mb-5
                                        prose-li:text-[14px] prose-li:leading-[1.7] prose-li:text-foreground/65 prose-li:my-1.5
                                        prose-strong:text-foreground prose-strong:font-bold
                                        prose-blockquote:border-l-[1px] prose-blockquote:border-foreground/30 prose-blockquote:bg-muted/[0.03] prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:rounded-sm prose-blockquote:italic
                                        selection:bg-foreground selection:text-background">
                                        {viewingDoc.url ? (
                                            <div className="w-full h-full min-h-[800px] flex flex-col">
                                                {viewingDoc.mimeType?.startsWith('image/') ? (
                                                    <img src={viewingDoc.url} alt={viewingDoc.type} className="max-w-full h-auto rounded-lg shadow-sm" />
                                                ) : (
                                                    <iframe
                                                        src={viewingDoc.url}
                                                        className="w-full flex-1 min-h-[1000px] border-0 rounded-lg"
                                                        title={viewingDoc.type}
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {viewingDoc.content || ''}
                                            </ReactMarkdown>
                                        )}
                                    </article>

                                    {/* Page Footer Decoration */}
                                    <div className="mt-16 pt-8 border-t border-border/30 flex items-center justify-between opacity-30 select-none pointer-events-none">
                                        <span className="text-[9px] font-semibold tracking-widest uppercase">Placement AI Document Service</span>
                                        <span className="text-[9px] font-semibold tracking-widest uppercase">ID: {viewingDoc.type.toUpperCase()}-01</span>
                                    </div>
                                </div>

                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DocumentViewerContext.Provider>
    )
}

export const useDocumentViewer = () => {
    const context = useContext(DocumentViewerContext)
    if (!context) throw new Error('useDocumentViewer must be used within DocumentViewerProvider')
    return context
}
