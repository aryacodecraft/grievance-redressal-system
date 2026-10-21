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

/**
 * Languages offered in the UI picker (DEC-026: English, Hindi, Marathi only).
 *
 * The other bundled packs (bn, te, ta, gu, kn, ml, pa, or) are kept in-tree
 * and in the `translations` registry below, but hidden from the picker.
 * To unhide a language, add its `[code, label]` entry here — one line, no
 * other gating. Native names are never translated.
 */
export const LANGUAGES = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["mr", "मराठी"],
] as const;

export type LanguageCode = (typeof LANGUAGES)[number][0];

/** Every bundled pack, including picker-hidden ones. Keep this exhaustive:
 *  removing an import orphans its file silently. */
const translations: Record<LanguageCode | "bn" | "te" | "ta" | "gu" | "kn" | "ml" | "pa" | "or", Messages> = { en, hi, bn, te, mr, ta, gu, kn, ml, pa, or };

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
  // Use the same default for SSR and the first client render; restore browser
  // preferences only after hydration to avoid locale-dependent HTML mismatch.
  const [language, setLanguage] = useState<LanguageCode>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("grievai-language");
      // Only picker-offered languages are valid at runtime; a saved code for a
      // hidden language (e.g. from before DEC-026) falls back to English.
      if (saved && LANGUAGES.some(([code]) => code === saved)) {
        setLanguage(saved as LanguageCode);
      }
    } catch {
      /* ignore unavailable browser storage */
    }
  }, []);
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
