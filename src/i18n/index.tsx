import { useCallback } from 'react';
import type { Lang } from '../data';
import { useGame } from '../hooks/useGameState';
import { RU } from './ru';

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const base = lang === 'ru' ? (RU[key] ?? key) : key;
  return vars ? base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : base;
}

/** The text key is the English phrase itself; Russian is looked up in ./ru. */
export function useT(): (key: string, vars?: Vars) => string {
  const { settings } = useGame();
  const lang = settings.lang;
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}

export function useLang(): Lang {
  return useGame().settings.lang;
}

export function detectLang(): Lang {
  const l = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return l.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
