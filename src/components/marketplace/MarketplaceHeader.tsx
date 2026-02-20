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
        <header className="sticky top-0 z-20 border-b border-border bg-[rgb(var(--card)/0.86)] backdrop-blur-md">
            <div className="container-app flex items-center gap-4 py-4">
                <Link
                    href={`/${locale}`}
                    className="flex items-center gap-2 text-base font-semibold text-primary"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                        I
                    </span>
                    <span>ImmoSaaS</span>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    <Link
                        href={`/${locale}/marketplace`}
                        className="text-sm font-medium text-secondary transition-colors hover:text-primary"
                    >
                        Marketplace
                    </Link>
                    <Link
                        href={`/${locale}#features`}
                        className="text-sm font-medium text-secondary transition-colors hover:text-primary"
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
