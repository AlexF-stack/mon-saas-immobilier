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
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
            <div className="container-app flex items-center gap-4 py-4">
                <Link
                    href={`/${locale}`}
                    className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                        I
                    </span>
                    <span>ImmoSaaS</span>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    <Link
                        href={`/${locale}/marketplace`}
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                        Marketplace
                    </Link>
                    <Link
                        href={`/${locale}#features`}
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                        Features
                    </Link>
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageSwitcher />
                    {isAuthenticated ? (
                        <Button asChild size="sm">
                            <Link href={`/${locale}/dashboard`}>Dashboard</Link>
                        </Button>
                    ) : (
                        <Button asChild size="sm">
                            <Link href={`/${locale}/login`}>Connexion</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}
