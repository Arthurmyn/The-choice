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
    const cast = Object.values(stories[0].characters);
    const m = assignVoices(voices, cast);
    expect(m.get('alex')?.name).toBe('Oliver (Enhanced)');
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
    const cast = Object.values(stories[1].characters);
    expect([...assignVoices(voices, cast)].map(([k, v]) => k + v.name)).toEqual([...assignVoices([...voices].reverse(), cast)].map(([k, v]) => k + v.name));
    expect(assignVoices([], cast).size).toBe(0);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { getStories, LANGS } from '../data';

describe('recorded voice-over', () => {
  it.each(LANGS)('%s: every spoken line has a recorded clip', (lang) => {
    const manifest = JSON.parse(readFileSync(`public/voice/${lang}/manifest.json`, 'utf8')) as Record<string, string>;
    const missing: string[] = [];
    for (const s of getStories(lang)) {
      const lines = [
        ...Object.values(s.nodes).flatMap((n) => (n.type === 'decision' ? n.choices.flatMap((c) => c.reaction.lines) : n.scene.lines)),
        ...Object.values(s.endings).flatMap((e) => e.scene.lines),
      ];
      for (const l of lines) {
        const key = `${l.speaker ?? 'narrator'}|${l.text}`;
        const file = manifest[key];
        if (!file || !existsSync(`public/voice/${lang}/${file}`)) missing.push(key.slice(0, 60));
      }
    }
    expect(missing).toEqual([]);
  });
});
