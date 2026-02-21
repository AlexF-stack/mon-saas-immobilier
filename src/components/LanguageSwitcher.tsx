"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

const SUPPORTED_LOCALES = new Set(["en", "fr"])

export default function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname() || "/"
  const searchParams = useSearchParams()
  const query = searchParams ? searchParams.toString() : ""

  const pathSegments = pathname.split("/").filter(Boolean)
  const hasLocalePrefix = SUPPORTED_LOCALES.has(pathSegments[0] ?? "")
  const current = hasLocalePrefix ? pathSegments[0] : "en"

  function switchTo(locale: string) {
    const normalizedLocale = SUPPORTED_LOCALES.has(locale) ? locale : "en"
    const restSegments = hasLocalePrefix ? pathSegments.slice(1) : pathSegments
    const localizedPath =
      `/${[normalizedLocale, ...restSegments].join("/")}`.replace(/\/+$/, "") || `/${normalizedLocale}`
    const url = query ? `${localizedPath}?${query}` : localizedPath
    router.replace(url)
  }

  return (
    <div className={className}>
      <label htmlFor="lang-select" className="sr-only">
        Language
      </label>
      <div className="inline-flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="1" />
          <path
            d="M2 12h20M12 2c2 3 2 7 2 10s0 7-2 10"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        <select
          id="lang-select"
          value={current}
          onChange={(e) => switchTo(e.target.value)}
          aria-label="Select language"
          className="w-[102px] rounded-md border border-border bg-transparent px-2 py-1 text-sm text-primary"
        >
          <option value="en">English</option>
          <option value="fr">Francais</option>
        </select>
      </div>
    </div>
  )
}
