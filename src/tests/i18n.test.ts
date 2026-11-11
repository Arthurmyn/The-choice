import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPhilosophy, getReferences, getStories, LANGS } from '../data';
import { enumeratePaths, allLines, deriveState } from '../engine/narrativeEngine';
import { resolveEnding } from '../engine/endingResolver';
import { validateStory } from '../engine/storyValidator';
import { RU } from '../i18n/ru';
import { translate } from '../i18n';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });

describe('interface translation', () => {
  it('every t("...") key used in the code has a Russian translation', () => {
    const files = walk('src').filter((p) => !p.includes('/tests/') && !p.endsWith('i18n/ru.ts'));
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
        const key = (m[1] ?? m[2]).replace(/\\'/g, "'");
        if (!(key in RU)) missing.add(`${f}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('keeps placeholders in translations', () => {
    for (const [k, v] of Object.entries(RU)) {
      const ph = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(v), k).toEqual(ph(k));
    }
  });

  it('interpolates and falls back to English', () => {
    expect(translate('ru', 'Line {n} of {m}', { n: 2, m: 5 })).toBe('Реплика 2 из 5');
    expect(translate('en', 'Line {n} of {m}', { n: 2, m: 5 })).toBe('Line 2 of 5');
    expect(translate('ru', 'No such key')).toBe('No such key');
  });
});

const TEXT_KEYS = new Set(['title', 'category', 'minutes', 'synopsis', 'disclaimer', 'notice', 'name', 'role', 'text', 'label', 'description', 'preview', 'mapLabel', 'result', 'situation', 'subtitle', 'unresolved', 'kicker', 'finding', 'argument', 'limitation', 'info', 'pressures', 'themes', 'body', 'questions', 'byEnding', 'byFlag', 'conflicts', 'values', 'caption', 'source']);
const DICTS = new Set(['byEnding', 'byFlag', 'limitation', 'conflicts', 'values', 'caption']);
type J = string | number | boolean | null | J[] | { [k: string]: J };
function mask(o: J, key = '', inText = false): J {
  if (typeof o === 'string') return inText ? '§' : o;
  if (Array.isArray(o)) return o.map((x) => mask(x, key, inText));
  if (o && typeof o === 'object') {
    const out: { [k: string]: J } = {};
    for (const [k, v] of Object.entries(o)) out[k] = mask(v, k, TEXT_KEYS.has(k) || (inText && DICTS.has(key)));
    return out;
  }
  return o;
}

describe('languages', () => {
  const en = getStories('en');
  it.each(LANGS)('%s stories validate and have all 18 paths each', (lang) => {
    for (const s of getStories(lang)) {
      expect(validateStory(s)).toEqual([]);
      expect(enumeratePaths(s)).toHaveLength(18);
    }
  });

  it('translations are structurally identical to English (ids, logic, conditions, endings)', () => {
    getStories('ru').forEach((ru, i) => {
      expect(mask(ru as unknown as J)).toEqual(mask(en[i] as unknown as J));
    });
  });

  it('translated text is not left in English', () => {
    for (const s of getStories('ru')) {
      for (const l of allLines(s)) expect(/[А-Яа-яЁё]/.test(l.text), l.text).toBe(true);
      for (const e of Object.values(s.endings)) expect(/[А-Яа-яЁё]/.test(e.title + e.result + e.unresolved)).toBe(true);
      expect(/[А-Яа-яЁё]/.test(s.notice ?? '')).toBe(true);
      for (const a of Object.values(s.analysis)) expect(/[А-Яа-яЁё]/.test(a.argument)).toBe(true);
    }
    for (const p of Object.values(getPhilosophy('ru').philosophers)) expect(/[А-Яа-яЁё]/.test(p.name + p.question)).toBe(true);
  });

  it('philosophy files have the same shape in both languages', () => {
    const shape = (o: J): J => (typeof o === 'string' ? '§' : Array.isArray(o) ? o.map(shape) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : o);
    const ids = (o: J): J => (Array.isArray(o) ? o.map(ids) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'years').map(([k, v]) => [k, k === 'id' ? v : ids(v)])) : typeof o === 'string' ? '§' : o);
    expect(ids(getPhilosophy('ru') as unknown as J)).toEqual(ids(getPhilosophy('en') as unknown as J));
    expect(shape(getReferences('ru') as unknown as J)).toEqual(shape(getReferences('en') as unknown as J));
    expect(Object.keys(getReferences('ru'))).toEqual(Object.keys(getReferences('en')));
  });

  it('a saved path resolves to the same ending in both languages', () => {
    const s0en = getStories('en')[0];
    const s0ru = getStories('ru')[0];
    for (const p of enumeratePaths(s0en)) {
      expect(deriveState(s0ru, p).endingId).toBe(deriveState(s0en, p).endingId);
      expect(deriveState(s0ru, p).flags).toEqual(deriveState(s0en, p).flags);
      expect(resolveEnding(s0ru, p)!.fragments).toHaveLength(resolveEnding(s0en, p)!.fragments.length);
    }
  });
});
