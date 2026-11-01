import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
