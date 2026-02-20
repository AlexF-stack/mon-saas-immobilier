'use client';

import type { ComponentProps, ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

type IntlLocale = NonNullable<ComponentProps<typeof NextIntlClientProvider>['locale']>;
type IntlMessages = ComponentProps<typeof NextIntlClientProvider>['messages'];

interface LanguageProviderProps {
  children: ReactNode;
  locale: IntlLocale;
  messages: IntlMessages;
}

export default function LanguageProvider({
  children,
  locale,
  messages,
}: LanguageProviderProps) {
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
