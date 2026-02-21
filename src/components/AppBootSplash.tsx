'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOOT_SCREEN_DURATION_MS = 900

export default function AppBootSplash() {
    const [visible, setVisible] = useState(true)
    const [exiting, setExiting] = useState(false)

    useEffect(() => {
        const startExitTimer = window.setTimeout(
            () => setExiting(true),
            BOOT_SCREEN_DURATION_MS - 220
        )
        const hideTimer = window.setTimeout(
            () => setVisible(false),
            BOOT_SCREEN_DURATION_MS
        )

        return () => {
            window.clearTimeout(startExitTimer)
            window.clearTimeout(hideTimer)
        }
    }, [])

    if (!visible) {
        return null
    }

    return (
        <div
            aria-hidden
            className={cn(
                'pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-background/92 backdrop-blur-xl transition-opacity duration-300',
                exiting && 'opacity-0'
            )}
        >
            <div className="flex flex-col items-center gap-4 text-primary">
                <div className="boot-logo-ring">
                    <span className="boot-logo-core">
                        <Building2 className="h-5 w-5" />
                    </span>
                </div>
                <p className="text-xs uppercase tracking-[0.26em] text-secondary">
                    ImmoSaaS
                </p>
            </div>
        </div>
    )
}
