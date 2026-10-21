import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import en from './locales/en.json';

export const defaultNS = 'translation';
export const resources = { en: { translation: en } } as const;
export const supportedLanguages = Object.keys(resources) as (keyof typeof resources)[];

function deviceLanguage(): string {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (supportedLanguages as string[]).includes(code) ? code : 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

/** Typed translation hook; importing this module guarantees i18n is initialised. */
export function useT() {
  return useTranslation().t;
}

export { i18n };
