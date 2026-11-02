import { describe, expect, it } from 'vitest';
import { stories as allStories } from '../data';

/** Stories small enough to enumerate every path. The Last Journey is covered in lastJourney.test.ts. */
const stories = allStories.filter((s) => s.exhaustive !== false);
import {
  allLines,
  buildTimeline,
  deriveState,
  enumeratePaths,
  joinVariants,
  pathKey,
  submitDecision,
  summarizePath,
} from '../engine/narrativeEngine';
import { resolveEnding } from '../engine/endingResolver';
import { validateStory } from '../engine/storyValidator';
import { buildMapLayout, highlightPath } from '../engine/flowchart';
import {
  emptyProgress,
  loadProgress,
  parseProgress,
  restarted,
  saveProgress,
  storyKey,
  withDecision,
} from '../engine/progressManager';
import type { DecisionRecord } from '../engine/types';

const [story1, story2] = stories;

const EXPECT_ENDINGS: Record<string, Record<string, string>> = {
  'release-today': { postpone: 'R_E1', limited: 'R_E2', full: 'R_E3' },
  'speak-for-someone-else': { truthful: 'L_E1', false: 'L_E2', reveal: 'L_E3' },
};

describe('story files', () => {
  it.each(stories.map((s) => [s.id, s] as const))('%s validates', (_id, s) => {
    expect(validateStory(s)).toEqual([]);
  });

  it('has 12 paths per story, 24 in total', () => {
    expect(enumeratePaths(story1)).toHaveLength(12);
    expect(enumeratePaths(story2)).toHaveLength(12);
  });
});

describe.each(stories.map((s) => [s.id, s] as const))('all paths of %s', (_id, story) => {
  const paths = enumeratePaths(story);

  it.each(paths.map((p) => [pathKey(p), p] as const))('path %s', (_key, history) => {
    const state = deriveState(story, history);
    expect(state.valid).toBe(true);
    expect(state.complete).toBe(true);

    // Ending is decided only by the third decision.
    const last = history[history.length - 1];
    expect(state.endingId).toBe(EXPECT_ENDINGS[story.id][last.choiceId]);

    // Decision history is ordered d1, d2, d3 and flags derive from it.
    expect(history.map((h) => h.nodeId)).toEqual(['d1', 'd2', 'd3']);
    const flagCount = Object.keys(state.flags).length;
    expect(flagCount).toBe(2);

    // Conditional text matches flags exactly.
    const resolved = resolveEnding(story, history);
    expect(resolved).not.toBeNull();
    expect(resolved!.fragments).toHaveLength(2);
    for (const line of resolved!.lines) {
      expect(line.text.length).toBeGreaterThan(0);
    }

    // Timeline: scenes, decisions, reactions and ending.
    const beats = buildTimeline(story, state).map((b) => b.key);
    expect(beats).toContain('d1:reaction');
    expect(beats).toContain('d3:reaction');
    expect(beats[beats.length - 1]).toBe('ending');

    // Analysis exists for the exact ending and each flag.
    for (const ph of ['kant', 'mill', 'aristotle'] as const) {
      const a = story.analysis[ph];
      expect(a.application.byEnding[state.endingId!]).toBeTruthy();
      expect(a.limitation[state.endingId!]).toBeTruthy();
      for (const [f, v] of Object.entries(state.flags)) {
        expect(a.application.byFlag[`${f}=${v}`]).toBeTruthy();
      }
    }

    // Flowchart highlights exactly the played path.
    const layout = buildMapLayout(story);
    const hi = highlightPath(story, layout, history);
    expect(hi.visitedNodes.size).toBe(1 + 3 + 3 + 1);
    for (const rec of history) {
      expect(hi.visitedNodes.has(`choice:${rec.nodeId}:${rec.choiceId}`)).toBe(true);
    }
    expect(hi.visitedNodes.has(`ending:${state.endingId}`)).toBe(true);

    // Save round trip.
    const storage = new MemoryStorage();
    let progress = emptyProgress(story.id);
    progress = withDecision(story, progress, history, 123);
    expect(saveProgress(progress, storage)).toBe(true);
    const loaded = loadProgress(story, storage);
    expect(loaded.recovered).toBe(false);
    expect(loaded.progress.history).toEqual(history);
    expect(Object.keys(loaded.progress.completed)).toEqual([pathKey(history)]);
  });
});

describe('story 1 conditional endings', () => {
  const text = (h: string[]) => {
    const history: DecisionRecord[] = ['d1', 'd2', 'd3'].map((n, i) => ({ nodeId: n, choiceId: h[i], timestamp: 0 }));
    return resolveEnding(story1, history)!.fragments;
  };
  it('verified + explicit', () => {
    expect(text(['verify', 'disclose', 'postpone'])).toEqual([
      'Your decision was based on a personal test using synthetic data.',
      'The team received a clear description of the cross-organization risk before deciding.',
    ]);
  });
  it('reported + vague', () => {
    expect(text(['trust-report', 'delay', 'full'])).toEqual([
      "Your decision relied on the tester's report. You did not personally reproduce the issue.",
      'The risk was initially hidden behind a general description of a technical problem.',
    ]);
  });
});

describe('story 2 adaptive group message', () => {
  const msg = (choices: string[]) => {
    const history: DecisionRecord[] = ['d1', 'd2', 'd3'].map((n, i) => ({ nodeId: n, choiceId: choices[i], timestamp: 0 }));
    const st = deriveState(story2, history);
    const d3 = story2.nodes.d3;
    if (d3.type !== 'decision') throw new Error();
    const choice = d3.choices.find((c) => c.id === choices[2])!;
    if (choice.interaction?.type !== 'chat') throw new Error();
    const me = choice.interaction.messages.find((m) => m.from === 'me')!;
    return joinVariants(me.parts, st.flags);
  };

  it('truthful, minimal + checked', () => {
    expect(msg(['ask', 'check', 'truthful'])).toBe(
      'Daniyar has an urgent family matter. I will leave the details private. The calendar contains an old entry. Alina was not assigned to this shift.',
    );
  });
  it('truthful, absent + uncertain', () => {
    expect(msg(['skip', 'skip-check', 'truthful'])).toBe(
      "Daniyar's circumstances are personal. He can decide what he wants to share. Before assigning responsibility to Alina, let's verify the schedule.",
    );
  });
  it('the false story keeps the lie and adds the correction', () => {
    expect(msg(['ask', 'check', 'false'])).toMatch(/^Yes, he was with me collecting materials\. The calendar contains an old entry/);
  });
  it('privacy ending reflects that the message was already read', () => {
    const history: DecisionRecord[] = ['ask', 'check', 'reveal'].map((c, i) => ({ nodeId: ['d1', 'd2', 'd3'][i], choiceId: c, timestamp: 0 }));
    const r = resolveEnding(story2, history)!;
    expect(r.lines.some((l) => /read/i.test(l.text) || /Seen by 6/.test(l.text))).toBe(true);
    expect(r.consequences.join(' ')).toMatch(/did not undo what had been read/);
  });
});

describe('engine safety', () => {
  it('rejects duplicate, out-of-order and invalid submissions', () => {
    const first = submitDecision(story1, [], 'd1', 'verify', 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(submitDecision(story1, first.history, 'd1', 'verify').ok).toBe(false);
    expect(submitDecision(story1, first.history, 'd3', 'postpone').ok).toBe(false);
    expect(submitDecision(story1, first.history, 'd2', 'nonsense').ok).toBe(false);
    expect(submitDecision(story1, [], 'd1', 'nonsense').ok).toBe(false);
  });

  it('refuses decisions after the ending', () => {
    const [p] = enumeratePaths(story1);
    expect(submitDecision(story1, p, 'd3', 'full').ok).toBe(false);
  });

  it('flags tampered histories as invalid', () => {
    const bad: DecisionRecord[] = [{ nodeId: 'd2', choiceId: 'disclose', timestamp: 0 }];
    expect(deriveState(story1, bad).valid).toBe(false);
  });

  it('summarizes the path in order', () => {
    const [p] = enumeratePaths(story1);
    expect(summarizePath(story1, p).map((i) => i.stage)).toEqual(['D1', 'D2', 'D3']);
  });
});

describe('progress persistence', () => {
  it('recovers from corrupted data and keeps a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(storyKey(story1.id), '{not json');
    const r = loadProgress(story1, storage);
    expect(r.recovered).toBe(true);
    expect(r.progress.history).toEqual([]);
    expect(storage.getItem(`${storyKey(story1.id)}:corrupt`)).toBe('{not json');
  });

  it('discards outdated versions and impossible histories', () => {
    expect(parseProgress(story1, JSON.stringify({ version: 0 })).recovered).toBe(true);
    const bad = { ...emptyProgress(story1.id), history: [{ nodeId: 'd3', choiceId: 'full', timestamp: 1 }] };
    const r = parseProgress(story1, JSON.stringify(bad));
    expect(r.progress.history).toEqual([]);
    expect(r.recovered).toBe(true);
  });

  it('restart keeps completed runs and clears the active run', () => {
    const [p] = enumeratePaths(story1);
    let progress = withDecision(story1, emptyProgress(story1.id), p, 5);
    progress = restarted(progress, 6);
    expect(progress.history).toEqual([]);
    expect(Object.keys(progress.completed)).toHaveLength(1);
  });

  it('reports failure when storage is unavailable', () => {
    expect(saveProgress(emptyProgress(story1.id), null)).toBe(false);
    const full = { setItem() { throw new Error('quota'); } } as unknown as Storage;
    expect(saveProgress(emptyProgress(story1.id), full)).toBe(false);
  });

  it('keeps stories separate', () => {
    expect(storyKey(story1.id)).not.toBe(storyKey(story2.id));
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

/* ---------- Localisation ---------- */
import { getStories, LANGS } from '../data';

const TEXT_KEYS = new Set(['title', 'category', 'minutes', 'synopsis', 'disclaimer', 'name', 'role', 'text', 'label', 'description', 'preview', 'mapLabel', 'result', 'situation', 'subtitle', 'unresolved', 'kicker', 'finding', 'argument', 'limitation', 'info', 'pressures', 'themes', 'body', 'rows', 'output', 'log', 'resultText', 'doneText', 'app', 'channel', 'day', 'time', 'assignee', 'note', 'button', 'sendLabel', 'questions', 'byEnding', 'byFlag', 'conflicts', 'values', 'caption']);
const DICTS = new Set(['byEnding', 'byFlag', 'limitation', 'conflicts', 'values', 'caption']);
type J = string | number | boolean | null | J[] | { [k: string]: J };
function mask(o: J, key = '', inText = false): J {
  if (typeof o === 'string') return inText ? '§' : o;
  if (Array.isArray(o)) return o.map((x) => mask(x, key, inText));
  if (o && typeof o === 'object') {
    const out: { [k: string]: J } = {};
    for (const [k, v] of Object.entries(o)) out[k] = k === 'accounts' ? v : mask(v, k, TEXT_KEYS.has(k) || (inText && DICTS.has(key)));
    return out;
  }
  return o;
}

describe('languages', () => {
  const en = getStories('en');
  it.each(LANGS)('%s stories validate and have all 12 paths each', (lang) => {
    for (const s of getStories(lang).filter((x) => x.exhaustive !== false)) {
      expect(validateStory(s)).toEqual([]);
      expect(enumeratePaths(s)).toHaveLength(12);
    }
  });

  it('translations are structurally identical to English (ids, logic, conditions, endings)', () => {
    getStories('ru').forEach((ru, i) => {
      expect(mask(ru as unknown as J)).toEqual(mask(en[i] as unknown as J));
    });
  });

  it('translated text is not left in English', () => {
    for (const s of getStories('ru')) {
      const lines = allLines(s);
      for (const l of lines) expect(/[А-Яа-яЁё]/.test(l.text), l.text).toBe(true);
      for (const e of Object.values(s.endings)) expect(/[А-Яа-яЁё]/.test(e.title + e.result)).toBe(true);
    }
  });

  it('a saved path resolves to the same ending in both languages', () => {
    const s0en = getStories('en')[0];
    const s0ru = getStories('ru')[0];
    for (const p of enumeratePaths(s0en)) {
      expect(deriveState(s0ru, p).endingId).toBe(deriveState(s0en, p).endingId);
      expect(resolveEnding(s0ru, p)!.fragments).toHaveLength(resolveEnding(s0en, p)!.fragments.length);
    }
  });
});
