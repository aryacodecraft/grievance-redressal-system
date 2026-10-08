"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en, { type MessageKey, type Messages } from "./en";
import hi from "./hi";
import bn from "./bn";
import te from "./te";
import mr from "./mr";
import ta from "./ta";
import gu from "./gu";
import kn from "./kn";
import ml from "./ml";
import pa from "./pa";
import or from "./or";

/** Native-name picker entries — language names are never translated. */
export const LANGUAGES = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["bn", "বাংলা"],
  ["te", "తెలుగు"],
  ["mr", "मराठी"],
  ["ta", "தமிழ்"],
  ["gu", "ગુજરાતી"],
  ["kn", "ಕನ್ನಡ"],
  ["ml", "മലയാളം"],
  ["pa", "ਪੰਜਾਬੀ"],
  ["or", "ଓଡ଼ିଆ"],
] as const;

export type LanguageCode = (typeof LANGUAGES)[number][0];

const translations: Record<LanguageCode, Messages> = { en, hi, bn, te, mr, ta, gu, kn, ml, pa, or };

const I18nContext = createContext<{
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
} | null>(null);

/** Replace `{name}` placeholders; unknown placeholders are left as-is. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem("grievai-language") as LanguageCode | null;
    return saved && translations[saved] ? saved : "en";
  });
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function changeLanguage(next: LanguageCode) {
    setLanguage(next);
    localStorage.setItem("grievai-language", next);
  }
  const value = useMemo(
    () => ({
      language,
      setLanguage: changeLanguage,
      // Missing keys fall back to English, then to the key itself — a
      // translation gap degrades to readable copy, never to a blank UI.
      t: (key: MessageKey, vars?: Record<string, string | number>) =>
        interpolate(translations[language][key] ?? en[key] ?? key, vars),
    }),
    [language]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

/** Map a backend category key ("water") to its localized-name message key. */
export function departmentKey(category: string): MessageKey {
  const k = category.charAt(0).toUpperCase() + category.slice(1);
  const key = `dname${k}` as MessageKey;
  return key in en ? key : "dnameOther";
}

export type { MessageKey, Messages } from "./en";
