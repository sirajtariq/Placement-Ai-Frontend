'use client'

import { createContext, useContext, useState } from 'react'

type ViewType = 'chat' | 'dashboard'

interface ViewContextType {
    activeView: ViewType
    setActiveView: (view: ViewType) => void
}

const ViewContext = createContext<ViewContextType | undefined>(undefined)

export function ViewProvider({ children }: { children: React.ReactNode }) {
    const [activeView, setActiveView] = useState<ViewType>('chat')

    return (
        <ViewContext.Provider value={{ activeView, setActiveView }}>
            {children}
        </ViewContext.Provider>
    )
}

export const useView = () => {
    const context = useContext(ViewContext)
    if (!context) throw new Error('useView must be used within ViewProvider')
    return context
}
