import Link from 'next/link'
import ThemeToggle from '@/components/ui/theme-toggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'

type MarketplaceHeaderProps = {
    locale: string
    isAuthenticated: boolean
}

export function MarketplaceHeader({ locale, isAuthenticated }: MarketplaceHeaderProps) {
    return (
        <header className="sticky top-0 z-20 border-b border-border/70 bg-[rgb(var(--card)/0.86)] backdrop-blur-xl">
            <div className="container-app relative flex flex-wrap items-center gap-3 py-4 sm:gap-4">
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                />
                <Link
                    href={`/${locale}`}
                    className="group flex items-center gap-2 text-base font-semibold text-primary"
                >
                    <span className="elevation-1 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white transition-transform [transition-duration:var(--motion-hover)] [transition-timing-function:var(--ease-standard)] group-hover:-translate-y-px">
                        I
                    </span>
                    <span className="hidden sm:inline">ImmoSaaS</span>
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                    <Link
                        href={`/${locale}/marketplace`}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80 hover:text-primary"
                    >
                        Marketplace
                    </Link>
                    <Link
                        href={`/${locale}#features`}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors [transition-duration:var(--motion-hover)] hover:bg-surface/80 hover:text-primary"
                    >
                        Features
                    </Link>
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <div className="elevation-1 hidden items-center gap-1 rounded-full border border-border/70 bg-card/75 p-1 backdrop-blur-sm sm:flex">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                    {isAuthenticated ? (
                        <Button asChild size="sm" className="whitespace-nowrap rounded-full">
                            <Link href={`/${locale}/dashboard`}>Dashboard</Link>
                        </Button>
                    ) : (
                        <Button asChild variant="outline" size="sm" className="whitespace-nowrap rounded-full">
                            <Link href={`/${locale}/login`}>Connexion</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}
