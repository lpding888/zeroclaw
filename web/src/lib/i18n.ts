import { useState, useEffect } from 'react';
import { getStatus } from './api';
import en from '@/locales/en.json';
import tr from '@/locales/tr.json';
import zhCN from '@/locales/zh-CN.json';

export type Locale = 'en' | 'tr' | 'zh-CN';

const LOCALE_STORAGE_KEY = 'zeroclaw.locale';

export const translations: Record<Locale, Record<string, string>> = {
  en,
  tr,
  'zh-CN': zhCN,
};

const normalizeLocale = (value?: string | null): Locale => {
  const normalized = value?.trim().toLowerCase();

  if (normalized?.startsWith('zh')) {
    return 'zh-CN';
  }

  if (normalized?.startsWith('tr')) {
    return 'tr';
  }

  return 'en';
};

const readStoredLocale = (): Locale | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return normalizeLocale(raw);
};

let currentLocale: Locale = readStoredLocale() ?? 'zh-CN';

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function t(key: string): string {
  return translations[currentLocale]?.[key] ?? translations.en[key] ?? key;
}

export function tLocale(key: string, locale: Locale): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

const ERROR_PHRASE_KEYS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /failed to fetch|networkerror|network request failed|network error/i, key: 'error.network' },
  { pattern: /timed? out|timeout/i, key: 'error.timeout' },
  { pattern: /unauthorized/i, key: 'error.unauthorized' },
  { pattern: /forbidden/i, key: 'error.forbidden' },
  { pattern: /invalid toml/i, key: 'error.invalid_toml' },
];

const API_STATUS_KEYS: Record<number, string> = {
  400: 'error.api_400',
  401: 'error.api_401',
  403: 'error.api_403',
  404: 'error.api_404',
  409: 'error.api_409',
  422: 'error.api_422',
  429: 'error.api_429',
  500: 'error.api_500',
  503: 'error.api_503',
};

const extractErrorDetail = (raw: string): string => {
  const text = raw.trim();
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const fromError = typeof parsed.error === 'string' ? parsed.error : '';
    const fromMessage = typeof parsed.message === 'string' ? parsed.message : '';
    return (fromError || fromMessage || text).trim();
  } catch {
    return text;
  }
};

const localizePhrase = (message: string): string => {
  for (const { pattern, key } of ERROR_PHRASE_KEYS) {
    if (pattern.test(message)) {
      return t(key);
    }
  }

  return message;
};

export function localizeErrorMessage(message: string, fallbackKey = 'common.error'): string {
  const raw = message.trim();
  if (!raw) {
    return t(fallbackKey);
  }

  const apiMatch = raw.match(/^API\s+(\d{3}):\s*(.*)$/i);
  if (apiMatch) {
    const [, statusCode = '0', detailRaw = ''] = apiMatch;
    const status = Number.parseInt(statusCode, 10);
    const detail = extractErrorDetail(detailRaw);
    const statusText = t(API_STATUS_KEYS[status] ?? 'error.api_generic');
    if (!detail) {
      return statusText;
    }

    const localizedDetail = localizePhrase(detail);
    return `${statusText}: ${localizedDetail}`;
  }

  return localizePhrase(raw);
}

export function useLocale(): { locale: Locale; t: (key: string) => string } {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  useEffect(() => {
    let cancelled = false;

    const stored = readStoredLocale();
    if (stored) {
      setLocale(stored);
      setLocaleState(stored);
      return () => {
        cancelled = true;
      };
    }

    getStatus()
      .then((status) => {
        if (cancelled) {
          return;
        }

        const detected = normalizeLocale(status.locale);
        setLocale(detected);
        setLocaleState(detected);
      })
      .catch(() => {
        // Keep default locale on error
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    locale,
    t: (key: string) => tLocale(key, locale),
  };
}
