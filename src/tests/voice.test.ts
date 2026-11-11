import { describe, expect, it } from 'vitest';
import { stories } from '../data';
import { assignVoices, voiceScore } from '../hooks/voice';

const voices = [
  { name: 'Fred', lang: 'en-US' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Karen', lang: 'en-AU' },
  { name: 'Moira', lang: 'en-IE' }, { name: 'Daniel', lang: 'en-GB' }, { name: 'Alex', lang: 'en-US' },
  { name: 'Oliver (Enhanced)', lang: 'en-GB' }, { name: 'Ralph', lang: 'en-US' }, { name: 'Milena', lang: 'ru-RU' },
];

describe('character voices', () => {
  it('every character has a voice profile', () => {
    for (const s of stories) for (const c of Object.values(s.characters)) expect(c.voice, `${s.id}/${c.id}`).toBeTruthy();
  });

  it('never uses robotic novelty voices and prefers natural ones', () => {
    for (const s of stories) {
      const m = assignVoices(voices, Object.values(s.characters));
      for (const v of m.values()) {
        expect(['Fred', 'Ralph', 'Milena']).not.toContain(v.name);
        expect(v.lang.startsWith('en')).toBe(true);
      }
      expect(m.get('narrator')).toBeTruthy();
    }
    expect(voiceScore({ name: 'Oliver (Enhanced)', lang: 'en-GB' })).toBeGreaterThan(voiceScore({ name: 'Karen', lang: 'en-AU' }));
  });

  it('gives the protagonist the best voice of their gender, and everyone distinct voices', () => {
    const cast = [
      { id: 'zed', voice: { gender: 'm' as const, pitch: 1, rate: 1 } },
      { id: 'you', role: 'Courier (you)', voice: { gender: 'm' as const, pitch: 1, rate: 1 } },
      { id: 'ada', voice: { gender: 'f' as const, pitch: 1, rate: 1 } },
    ];
    const m = assignVoices(voices, cast);
    expect(m.get('you')?.name).toBe('Oliver (Enhanced)');
    const names = [...m.values()].map((v) => v.name);
    expect(m.size).toBe(cast.length + 1);
    expect(new Set(names).size).toBe(names.length);
    for (const c of cast) {
      const n = m.get(c.id)!.name;
      if (c.voice!.gender === 'f') expect(['Samantha', 'Karen', 'Moira']).toContain(n);
      if (c.voice!.gender === 'm') expect(['Daniel', 'Alex', 'Oliver (Enhanced)']).toContain(n);
    }
  });

  it('is deterministic and survives having no voices', () => {
    const cast = Object.values(stories[0].characters);
    expect([...assignVoices(voices, cast)].map(([k, v]) => k + v.name)).toEqual([...assignVoices([...voices].reverse(), cast)].map(([k, v]) => k + v.name));
    expect(assignVoices([], cast).size).toBe(0);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { getStories, LANGS } from '../data';
import { allLines } from '../engine/narrativeEngine';

describe('recorded voice-over', () => {
  it.each(LANGS)('%s: every spoken line has a recorded clip', (lang) => {
    const manifest = JSON.parse(readFileSync(`public/voice/${lang}/manifest.json`, 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const s of getStories(lang).filter((x) => x.voice !== false)) {
      const lines = allLines(s);
      for (const l of lines) {
        const key = `${l.speaker ?? 'narrator'}|${l.text}`;
        const file = manifest[key];
        if (!file || !existsSync(`public/voice/${lang}/${file}`)) missing.push(key.slice(0, 60));
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('recorded voice for every chapter', () => {
  it('no chapter opts out of the recorded clips, and every character has a profile for the fallback', () => {
    for (const s of stories) {
      expect(s.voice).not.toBe(false);
      for (const c of Object.values(s.characters)) expect(c.voice).toBeTruthy();
    }
  });

  it('every speaker has a clip in both languages, so no line falls back to the browser voice', () => {
    for (const lang of ['en', 'ru'] as const) {
      const manifest = JSON.parse(readFileSync(`public/voice/${lang}/manifest.json`, 'utf8')) as Record<string, string>;
      const speakers = new Set(Object.keys(manifest).map((k) => k.split('|')[0]));
      for (const s of getStories(lang)) for (const c of Object.keys(s.characters)) expect(speakers.has(c), `${lang}/${c}`).toBe(true);
      expect(speakers.has('narrator')).toBe(true);
    }
  });
});
