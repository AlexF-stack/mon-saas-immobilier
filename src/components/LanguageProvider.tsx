'use client';

import type { ComponentProps, ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

type IntlLocale = NonNullable<ComponentProps<typeof NextIntlClientProvider>['locale']>;
type IntlMessages = ComponentProps<typeof NextIntlClientProvider>['messages'];

interface LanguageProviderProps {
  children: ReactNode;
  locale: IntlLocale;
  messages: IntlMessages;
  timeZone?: string;
}

export default function LanguageProvider({
  children,
  locale,
  messages,
  timeZone,
}: LanguageProviderProps) {
  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
