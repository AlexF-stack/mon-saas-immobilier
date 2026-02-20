import { redirect } from "next/navigation";
import ThemeRegistry from "@/components/ThemeRegistry";
import LanguageProvider from "@/components/LanguageProvider";
import "../globals.css";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";

const locales = ['en', 'fr'] as const;
type AppLocale = (typeof locales)[number];
const messagesMap = {
  en: enMessages,
  fr: frMessages,
} as const;

function isAppLocale(locale: string): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Validate locale (params is a Promise in Next's dynamic route handlers)
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    redirect('/en');
  }

  // Get messages
  const messages = messagesMap[locale];

  return (
    <>
      <ThemeRegistry>
        <LanguageProvider locale={locale} messages={messages}>
          {children}
        </LanguageProvider>
      </ThemeRegistry>
    </>
  )
}
