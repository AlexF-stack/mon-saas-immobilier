interface PageLoadingProps {
    label?: string
}

export default function PageLoading({
    label = 'Chargement de la page...',
}: PageLoadingProps) {
    return (
        <div className="page-loading-shell px-6">
            <div className="elevation-1 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card/80 p-6 backdrop-blur-sm">
                <div className="page-loading-bar-track shimmer-surface">
                    <span className="page-loading-bar" />
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    {label}
                </p>
            </div>
        </div>
    )
}
