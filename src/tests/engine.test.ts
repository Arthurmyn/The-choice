import { describe, expect, it } from 'vitest';
import { getStories } from '../data';
import {
  allLines,
  buildTimeline,
  deriveState,
  enumeratePaths,
  pathKey,
  submitDecision,
  summarizePath,
} from '../engine/narrativeEngine';
import { resolveEnding } from '../engine/endingResolver';
import { validateStory } from '../engine/storyValidator';
import { buildMapLayout, highlightPath } from '../engine/flowchart';
import { disclosure, levelOf, trendOf } from '../engine/indicators';
import {
  emptyProgress,
  loadProgress,
  parseProgress,
  restarted,
  saveProgress,
  storyKey,
  withDecision,
} from '../engine/progressManager';
import type { DecisionRecord, Story } from '../engine/types';

const story = getStories('en')[0];
const KEYS = ['#trust', '#safety', '#resources', '#participation'];

/** Each chapter: which second decision follows each first answer, which ending each last answer reaches, and who analyses it. */
const CHAPTERS = [
  { index: 0, id: 'infected-survivor', d2: { isolate_force: 'd2_isolate', stay_watch: 'd2_watch', group_decide: 'd2_group' }, ending: { one_decides: 'R_E1', consent_only: 'R_E2', group_challenge: 'R_E3' }, philosophers: ['hobbes', 'locke', 'rousseau'] },
  { index: 1, id: 'last-medicine', d2: { give_leo: 'd2_leo', give_nadia: 'd2_nadia', put_group: 'd2_group' }, ending: { need_first: 'R2_E1', lottery: 'R2_E2', weigh_usefulness: 'R2_E3' }, philosophers: ['hobbes', 'locke', 'rousseau'] },
  { index: 2, id: 'who-controls', d2: { keep_leader: 'd2_leader', call_vote: 'd2_vote', create_council: 'd2_council' }, ending: { silence: 'R3_E1', voice: 'R3_E2', may_leave: 'R3_E3' }, philosophers: ['hobbes', 'locke', 'rousseau', 'popper', 'castells'] },
] as const;

const rec = (ids: [string, string][]): DecisionRecord[] => ids.map(([nodeId, choiceId], i) => ({ nodeId, choiceId, timestamp: i }));

describe.each(CHAPTERS)('$id: structure', (c) => {
  const s = getStories('en')[c.index];

  it('validates in both languages', () => {
    for (const lang of ['en', 'ru'] as const) expect(validateStory(getStories(lang)[c.index])).toEqual([]);
  });

  it('has 3 options at D1, 2 at each D2 and 3 at D3, so 18 paths', () => {
    const d = (id: string) => (s.nodes[id].type === 'decision' ? (s.nodes[id] as { choices: unknown[] }).choices.length : -1);
    expect(d('d1')).toBe(3);
    expect(Object.values(c.d2).map(d)).toEqual([2, 2, 2]);
    expect(d('d3')).toBe(3);
    expect(enumeratePaths(s)).toHaveLength(18);
  });

  it('has three endings, recorded voice-over, a content notice and the Memory Archive items', () => {
    expect(Object.keys(s.endings).sort()).toEqual(Object.values(c.ending).sort());
    expect(s.voice).not.toBe(false);
    expect(s.notice).toBeTruthy();
    const inv = Object.values(s.nodes).find((n) => n.type === 'investigation');
    expect(inv && inv.type === 'investigation' ? inv.items.length : 0).toBe(3);
  });
});

describe('registry', () => {
  it('holds the three chapters in order and no earlier story', () => {
    expect(getStories('en').map((s) => s.id)).toEqual(['infected-survivor', 'last-medicine', 'who-controls']);
    expect(getStories('ru').map((s) => s.id)).toEqual(['infected-survivor', 'last-medicine', 'who-controls']);
  });

  it('The Infected Survivor has its five characters and the three Memory Archive items', () => {
    expect(Object.keys(story.characters).sort()).toEqual(['aida', 'dana', 'leo', 'marat', 'timur']);
    const inv = Object.values(story.nodes).find((n) => n.type === 'investigation');
    expect(inv && inv.type === 'investigation' ? inv.items.map((i) => i.id) : []).toEqual(['wound', 'log', 'account']);
  });
});

describe.each(CHAPTERS.flatMap((c) => (['en', 'ru'] as const).map((lang) => ({ ...c, lang }))))('$id, all 18 paths ($lang)', (c) => {
  const s = getStories(c.lang)[c.index];
  const paths = enumeratePaths(s);
  const D2_OF = c.d2 as Record<string, string>;
  const ENDING_OF = c.ending as Record<string, string>;

  it.each(paths.map((p) => [pathKey(p), p] as const))('path %s', (_key, history) => {
    const state = deriveState(s, history);
    expect(state.valid).toBe(true);
    expect(state.complete).toBe(true);

    // The ending is decided only by the third decision.
    const [d1, d2, d3] = history;
    expect(state.endingId).toBe(ENDING_OF[d3.choiceId]);
    expect(history.map((h) => h.nodeId)).toEqual(['d1', D2_OF[d1.choiceId], 'd3']);
    expect(d2.nodeId).toBe(D2_OF[d1.choiceId]);

    // Indicators stay inside 0 to 10.
    for (const k of KEYS) {
      const v = Number(state.flags[k]);
      expect(v, k).toBeGreaterThanOrEqual(0);
      expect(v, k).toBeLessThanOrEqual(10);
    }

    // Two story flags (the other choices are in the history) and two ending fragments.
    expect(Object.keys(state.flags).filter((k) => !k.startsWith('#')).sort()).toEqual(['d1', 'd2']);
    const resolved = resolveEnding(s, history)!;
    expect(resolved.fragments).toHaveLength(2);
    expect(resolved.lines.length).toBeGreaterThan(3);

    // Timeline.
    const beats = buildTimeline(s, state).map((b) => b.key);
    expect(beats).toContain('d1:reaction');
    expect(beats).toContain('d3:reaction');
    expect(beats[beats.length - 1]).toBe('ending');

    // Analysis exists for the exact ending and for every choice flag.
    expect(Object.keys(s.analysis)).toEqual([...c.philosophers]);
    for (const ph of c.philosophers) {
      const a = s.analysis[ph];
      expect(a.application.byEnding[state.endingId!]).toBeTruthy();
      expect(a.limitation[state.endingId!]).toBeTruthy();
      for (const f of ['d1', 'd2']) expect(a.application.byFlag[`${f}=${state.flags[f]}`]).toBeTruthy();
    }

    // The map highlights exactly the played path.
    const hi = highlightPath(s, buildMapLayout(s), history);
    expect(hi.visitedNodes.size).toBe(1 + 3 + 3 + 1);
    expect(hi.visitedNodes.has(`ending:${state.endingId}`)).toBe(true);

    // "How the system worked" lists every decision, and the stated effects add up to what happened.
    const rows = disclosure(s, history);
    expect(rows.map((r) => r.stage)).toEqual(['D1', 'D2', 'D3']);
    for (const k of KEYS) {
      const declared = rows.reduce((n, r) => n + (r.effects.find((e) => e.key === k)?.delta ?? 0), 0);
      expect(Number(state.flags[k]) - Number(s.initial![k]), k).toBe(declared);
    }

    // Save round trip.
    const storage = new MemoryStorage();
    const progress = withDecision(s, emptyProgress(s.id), history, 123);
    expect(saveProgress(progress, storage)).toBe(true);
    const loaded = loadProgress(s, storage);
    expect(loaded.recovered).toBe(false);
    expect(loaded.progress.history).toEqual(history);
    expect(Object.keys(loaded.progress.completed)).toEqual([pathKey(history)]);
  });
});

describe('indicators', () => {
  it('reads values as words and trends as arrows', () => {
    expect([0, 2, 3, 4, 5, 7, 8, 10].map(levelOf)).toEqual(['Low', 'Low', 'Strained', 'Strained', 'Stable', 'Stable', 'High', 'High']);
    expect([trendOf(5, 6), trendOf(5, 4), trendOf(5, 5)]).toEqual(['up', 'down', 'same']);
  });

  it('starts at Trust 6, Safety 5, Resources 5, Participation 5', () => {
    expect(story.initial).toMatchObject({ '#trust': '6', '#safety': '5', '#resources': '5', '#participation': '5' });
  });

  it('applies the stated effect of each option', () => {
    const at = (ids: [string, string][]) => deriveState(story, rec(ids)).flags;
    expect(at([['d1', 'isolate_force']])).toMatchObject({ '#safety': '7', '#trust': '4', '#participation': '4', '#resources': '5' });
    expect(at([['d1', 'group_decide']])).toMatchObject({ '#participation': '7', '#trust': '7', '#safety': '4', '#resources': '4' });
    expect(at([['d1', 'stay_watch'], ['d2_watch', 'let_leave']])).toMatchObject({ '#resources': '3', '#trust': '6', '#participation': '6', '#safety': '3' });
  });

  it.each(CHAPTERS)('no option of $id improves all four indicators', (ch) => {
    const s = getStories('en')[ch.index];
    expect(s.initial).toMatchObject({ '#trust': '6', '#safety': '5', '#resources': '5', '#participation': '5' });
    for (const n of Object.values(s.nodes)) {
      if (n.type !== 'decision') continue;
      for (const c of n.choices) {
        const sums = KEYS.map((k) => (c.apply ?? []).reduce((t, a) => t + (a.effects?.[k] ?? 0), 0));
        expect(sums.every((x) => x > 0), `${n.id}/${c.id}`).toBe(false);
        expect(sums.some((x) => x < 0), `${n.id}/${c.id}`).toBe(true);
      }
    }
  });

  it('clamps to the 0 to 10 range', () => {
    const big: Story = structuredClone(story);
    const d1 = big.nodes.d1;
    if (d1.type !== 'decision') throw new Error();
    d1.choices[0].apply = [{ effects: { '#safety': 40, '#trust': -40 } }];
    const f = deriveState(big, rec([['d1', 'isolate_force']])).flags;
    expect(f['#safety']).toBe('10');
    expect(f['#trust']).toBe('0');
  });
});

describe('conditional endings', () => {
  it('names what the player actually did', () => {
    const h = rec([['d1', 'isolate_force'], ['d2_isolate', 'key_marat'], ['d3', 'one_decides']]);
    const r = resolveEnding(story, h)!;
    expect(r.fragments).toEqual(['You had Aida locked in before the group had spoken.', 'The only key stayed with Marat.']);
    expect(r.lines.map((l) => l.text)).toContain('The door was already chained. Now it is the policy.');
    expect(r.lines.map((l) => l.text)).not.toContain('The group that once voted now waits to be told.');
  });

  it('changes with the earlier decisions, not only the last', () => {
    const a = resolveEnding(story, rec([['d1', 'group_decide'], ['d2_group', 'all_vote'], ['d3', 'group_challenge']]))!;
    const b = resolveEnding(story, rec([['d1', 'isolate_force'], ['d2_isolate', 'hear_door'], ['d3', 'group_challenge']]))!;
    expect(a.ending.id).toBe(b.ending.id);
    expect(a.fragments).not.toEqual(b.fragments);
    expect(a.lines.map((l) => l.text)).not.toEqual(b.lines.map((l) => l.text));
  });

  it('keeps every ending unresolved: no ending says who was right', () => {
    for (const lang of ['en', 'ru'] as const) {
      for (const e of getStories(lang).flatMap((x) => Object.values(x.endings))) {
        const last = e.scene.lines.filter((l) => !l.when).at(-1)!;
        expect(last.text.trim().endsWith('?'), e.id).toBe(true);
        expect(e.unresolved.trim().endsWith('?'), e.id).toBe(true);
      }
    }
  });

  it('writes each ending as 80 to 110 words', () => {
    for (const e of getStories('en').flatMap((x) => Object.values(x.endings))) {
      const base = e.scene.lines.filter((l) => !l.when).map((l) => l.text).join(' ');
      const withVariant = [...e.scene.lines.filter((l) => !l.when).map((l) => l.text), e.scene.lines.find((l) => l.when)!.text].join(' ');
      const n = (t: string) => t.split(/\s+/).filter(Boolean).length;
      expect(n(base), e.id).toBeGreaterThanOrEqual(80);
      expect(n(withVariant), e.id).toBeLessThanOrEqual(110);
    }
  });
});

describe('engine safety', () => {
  it('rejects duplicate, out-of-order and invalid submissions', () => {
    const first = submitDecision(story, [], 'd1', 'isolate_force', 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(submitDecision(story, first.history, 'd1', 'isolate_force').ok).toBe(false);
    expect(submitDecision(story, first.history, 'd3', 'one_decides').ok).toBe(false);
    expect(submitDecision(story, first.history, 'd2_watch', 'let_leave').ok).toBe(false);
    expect(submitDecision(story, first.history, 'd2_isolate', 'nonsense').ok).toBe(false);
    expect(submitDecision(story, [], 'd1', 'nonsense').ok).toBe(false);
  });

  it('refuses decisions after the ending', () => {
    const [p] = enumeratePaths(story);
    expect(submitDecision(story, p, 'd3', 'one_decides').ok).toBe(false);
  });

  it('flags tampered histories as invalid', () => {
    expect(deriveState(story, rec([['d2_isolate', 'key_marat']])).valid).toBe(false);
    expect(deriveState(story, rec([['d1', 'isolate_force'], ['d2_watch', 'let_leave']])).valid).toBe(false);
  });

  it('summarizes the path in order', () => {
    const [p] = enumeratePaths(story);
    expect(summarizePath(story, p).map((i) => i.stage)).toEqual(['D1', 'D2', 'D3']);
  });

  it('has a line for every character who speaks', () => {
    for (const l of allLines(story)) if (l.speaker) expect(story.characters[l.speaker], l.speaker).toBeTruthy();
  });
});

describe('progress persistence', () => {
  it('recovers from corrupted data and keeps a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(storyKey(story.id), '{not json');
    const r = loadProgress(story, storage);
    expect(r.recovered).toBe(true);
    expect(r.progress.history).toEqual([]);
    expect(storage.getItem(`${storyKey(story.id)}:corrupt`)).toBe('{not json');
  });

  it('discards outdated versions and impossible histories', () => {
    expect(parseProgress(story, JSON.stringify({ version: 0 })).recovered).toBe(true);
    const bad = { ...emptyProgress(story.id), history: [{ nodeId: 'd3', choiceId: 'one_decides', timestamp: 1 }] };
    const r = parseProgress(story, JSON.stringify(bad));
    expect(r.progress.history).toEqual([]);
    expect(r.recovered).toBe(true);
  });

  it('restart keeps completed runs and clears the active run', () => {
    const [p] = enumeratePaths(story);
    let progress = withDecision(story, emptyProgress(story.id), p, 5);
    progress = restarted(progress, 6);
    expect(progress.history).toEqual([]);
    expect(Object.keys(progress.completed)).toHaveLength(1);
  });

  it('reports failure when storage is unavailable', () => {
    expect(saveProgress(emptyProgress(story.id), null)).toBe(false);
    const full = { setItem() { throw new Error('quota'); } } as unknown as Storage;
    expect(saveProgress(emptyProgress(story.id), full)).toBe(false);
  });
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  key(i: number): string | null { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string): void { this.data.delete(k); }
  setItem(k: string, v: string): void { this.data.set(k, v); }
}
