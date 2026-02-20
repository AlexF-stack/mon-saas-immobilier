import { getRequestConfig } from 'next-intl/server';
import enMessages from '../messages/en.json';
import frMessages from '../messages/fr.json';

export const locales = ['en', 'fr'] as const;
export const defaultLocale = 'en' as const;
type AppLocale = (typeof locales)[number];

const messages = {
  en: enMessages,
  fr: frMessages,
};

function isAppLocale(locale: string): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale && isAppLocale(locale) ? locale : defaultLocale;

  return {
    locale: resolvedLocale,
    timeZone: 'UTC',
    messages: messages[resolvedLocale],
  };
});
