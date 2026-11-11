import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPhilosophy, getReferences, getStories, LANGS } from '../data';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (p.includes('_archive')) return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('no em dashes or en dashes', () => {
  const DASH = /[–—]/;

  it('in story, philosophy and interface text', () => {
    const files = walk('src').filter((p) => /\.(ts|tsx|json|css)$/.test(p) && !p.includes('/tests/') && !/\.(m4a)$/.test(p));
    const offenders: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (DASH.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('in the loaded data of every language', () => {
    for (const lang of LANGS) {
      expect(DASH.test(JSON.stringify(getStories(lang)))).toBe(false);
      expect(DASH.test(JSON.stringify(getPhilosophy(lang)))).toBe(false);
      expect(DASH.test(JSON.stringify(getReferences(lang)))).toBe(false);
    }
  });
});

describe('philosophy layer', () => {
  const story = getStories('en')[0];
  const all = JSON.stringify(story.analysis) + JSON.stringify(story.lenses) + JSON.stringify(story.reflection);

  it('covers Hobbes, Locke and Rousseau, with the three blocks and a source each', () => {
    expect(Object.keys(story.analysis)).toEqual(['hobbes', 'locke', 'rousseau']);
    const refs = getReferences('en');
    for (const [id, a] of Object.entries(story.analysis)) {
      expect(a.argument.length, id).toBeGreaterThan(200);
      expect(Object.keys(a.application.byEnding)).toHaveLength(3);
      expect(Object.keys(a.limitation)).toHaveLength(3);
      expect(Object.keys(a.application.byFlag)).toHaveLength(9);
      expect(refs[a.reference as 'hobbes']).toBeTruthy();
    }
    expect(getReferences('en').hobbes.location).toBe('chapters 13, 14, 17 and 21');
    expect(getReferences('en').locke.location).toBe('chapters 2, 9, 14 and 19');
    expect(getReferences('en').rousseau.location).toMatch(/book I chapter 6.*book II chapter 3.*book IV chapter 6/);
  });

  it('names Popper and Castells as short further lenses, and keeps the collision and three questions', () => {
    expect(story.lenses!.text).toMatch(/Popper/);
    expect(story.lenses!.text).toMatch(/Castells/);
    expect(story.lenses!.text.length).toBeLessThan(700);
    expect(new Set(Object.values(story.reflection.conflicts)).size).toBe(1);
    expect(story.reflection.questions).toHaveLength(3);
  });

  it('carries the neutral Kazakhstan card with its source', () => {
    expect(story.context!.text).toMatch(/March 2020 Kazakhstan declared a nationwide state of emergency/);
    expect(story.context!.text).toMatch(/who decides, how far, and can it be challenged\?/);
    expect(story.context!.source).toBe('Amangeldinova et al., 2020');
  });

  it('never claims a philosopher would choose an option, never quotes, never ranks', () => {
    expect(all).not.toMatch(/\bwould (choose|pick|vote|select|have chosen|endorse|approve)\b/i);
    expect(all).not.toMatch(/\bthe (right|correct|best|worst) (choice|option|answer|ending)\b/i);
    expect(all).not.toMatch(/\bscore\b|\branking\b|\bgood ending\b|\bbad ending\b/i);
    // Paraphrase only: no quotation marks around source text in the philosophy layer.
    expect(JSON.stringify(story.analysis)).not.toMatch(/\\"/);
  });

  it('labels the application as this game\'s interpretation', () => {
    const note = getPhilosophy('en').note;
    expect(note).toMatch(/paraphrase/);
    expect(note).toMatch(/this game's interpretation/);
  });
});

describe('no moral score anywhere in the story', () => {
  it('has no total, rank or verdict field and ending titles do not judge', () => {
    const story = getStories('en')[0];
    expect(Object.keys(story)).not.toContain('score');
    for (const e of Object.values(story.endings)) expect(e.title).not.toMatch(/good|bad|best|worst|win|lose|fail/i);
    expect(story.indicators).toHaveLength(4);
    expect(story.resources).toBeUndefined();
  });
});

describe('characters', () => {
  it('are the five named people with mixed names and no trait that decides who is worth protecting', () => {
    const story = getStories('en')[0];
    expect(Object.values(story.characters).map((c) => c.name)).toEqual(['Aida', 'Marat', 'Dana', 'Timur', 'Leo']);
  });
});
