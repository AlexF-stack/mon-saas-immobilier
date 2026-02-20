'use client';

import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleLanguageChange = (newLocale: string) => {
    // Replace locale in pathname
    // Remove current locale prefix
    let newPathname = pathname;
    
    if (pathname.startsWith(`/${locale}`)) {
      newPathname = pathname.slice(locale.length + 1); // Remove /{locale}
    }
    
    // Add new locale prefix
    newPathname = `/${newLocale}${newPathname}`;
    
    router.push(newPathname || `/${newLocale}`);
  };

  const currentLanguage = languages.find(lang => lang.code === locale);
  
  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-fit gap-2 border-border bg-background">
        <SelectValue placeholder={currentLanguage?.label || 'Language'} />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
