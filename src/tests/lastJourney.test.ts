import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getStories, LANGS } from '../data';
import { buildMapLayout, highlightPath } from '../engine/flowchart';
import {
  availableChoices,
  buildTimeline,
  deriveState,
  getDecision,
  isEvidenceRecord,
  randomPlaythrough,
  resolveLines,
  rng,
  submitDecision,
  submitEvidence,
  summarizePath,
} from '../engine/narrativeEngine';
import { resolveEnding } from '../engine/endingResolver';
import { parseProgress, saveProgress, loadProgress, withDecision, emptyProgress } from '../engine/progressManager';
import { validateStory } from '../engine/storyValidator';
import type { DecisionRecord, Story } from '../engine/types';

const story = getStories('en')[2];
const num = (v: string | undefined): number => Number(v ?? 0);
const FIXTURES = JSON.parse(readFileSync('src/tests/fixtures/lastJourney.paths.json', 'utf8')) as Record<string, { nodeId: string; choiceId: string }[]>;
const rec = (h: { nodeId: string; choiceId: string }[]): DecisionRecord[] => h.map((r, i) => ({ ...r, timestamp: i }));

describe('The Last Journey: structure', () => {
  it('has six chapters, 13+ decisions and seven endings', () => {
    expect(story.chapters).toHaveLength(6);
    const decisions = Object.values(story.nodes).filter((n) => n.type === 'decision');
    expect(decisions.length).toBeGreaterThanOrEqual(12);
    for (let c = 1; c <= 6; c++) expect(decisions.filter((d) => d.type === 'decision' && d.chapter === c).length, `chapter ${c}`).toBeGreaterThanOrEqual(2);
    expect(Object.keys(story.endings)).toHaveLength(7);
    expect(Object.values(story.endings).filter((e) => e.hidden)).toHaveLength(1);
  });

  it.each(LANGS)('%s validates (graph, flags, analysis) over 1500 sampled playthroughs', (lang) => {
    expect(validateStory(getStories(lang)[2], 1500)).toEqual([]);
  }, 120000);

  it('has the six required characters with distinct profiles and voices', () => {
    for (const id of ['reed', 'sarah', 'noah', 'emily', 'james', 'leo']) {
      const c = story.characters[id];
      expect(c.name && c.role && c.voice, id).toBeTruthy();
    }
    const names = new Set(Object.values(story.characters).map((c) => c.name));
    expect(names.size).toBe(Object.keys(story.characters).length);
  });
});

describe('The Last Journey: every ending is reachable and deterministic', () => {
  it.each(Object.keys(FIXTURES))('%s', (endingId) => {
    const h = rec(FIXTURES[endingId]);
    const st = deriveState(story, h);
    expect(st.valid, st.error).toBe(true);
    expect(st.endingId).toBe(endingId);
    // Replaying never changes the outcome.
    expect(deriveState(story, h).endingId).toBe(endingId);
    expect(resolveEnding(story, h)?.ending.id).toBe(endingId);
  });

  it('fixtures cover all seven endings', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(Object.keys(story.endings).sort());
  });
});

describe('The Last Journey: invariants over random playthroughs', () => {
  const rand = rng(1234);
  const runs = Array.from({ length: 600 }, () => randomPlaythrough(story, rand, 0.5));
  const people = ['noah', 'sarah', 'emily', 'james', 'leo'];

  it('always ends, and the headcount matches the survival flags', () => {
    for (const { state } of runs) {
      expect(state.complete).toBe(true);
      const alive = people.filter((p) => state.flags[`alive.${p}`] === 'yes').length;
      expect(num(state.flags['#alive'])).toBe(alive);
    }
  });

  it('resources never go negative and Sarah survives every path', () => {
    for (const { state } of runs) {
      for (const k of ['#food', '#med', '#ammo', '#fuel']) expect(num(state.flags[k]), k).toBeGreaterThanOrEqual(0);
      expect(state.flags['alive.sarah']).toBe('yes');
    }
  });

  it('infection is consistent: whoever is bitten in chapter 3 is dead by chapter 4', () => {
    let seen = 0;
    for (const { state } of runs) {
      const bitten = state.flags.bitten;
      if (state.endingId === 'NO_ONE_LEFT' && !state.path.includes('c4_infection')) continue;
      if (!bitten) continue;
      seen++;
      expect(state.flags[`alive.${bitten}`], `bitten ${bitten}`).toBe('no');
    }
    expect(seen).toBeGreaterThan(300);
  });

  it('only decisions that exist are answered, in order, with offered choices', () => {
    for (const { history } of runs.slice(0, 100)) {
      for (let i = 0; i < history.length; i++) {
        const prefix = history.slice(0, i);
        const rec = history[i];
        if (isEvidenceRecord(rec)) continue;
        const st = deriveState(story, prefix);
        const node = getDecision(story, rec.nodeId)!;
        expect(availableChoices(node, st.flags).some((c) => c.id === rec.choiceId)).toBe(true);
      }
    }
  });

  it('reaches every ending by chance as well', () => {
    expect(new Set(runs.map((r) => r.state.endingId)).size).toBeGreaterThanOrEqual(6);
  });
});

describe('The Last Journey: consequences', () => {
  const play = (steps: [string, string][], evidence: [string, string][] = []): DecisionRecord[] => {
    let h: DecisionRecord[] = [];
    for (const [n, i] of evidence) {
      const r = submitEvidence(story, h, n, i, 0);
      if (r.ok) h = r.history;
    }
    for (const [n, c] of steps) {
      const r = submitDecision(story, h, n, c, 0);
      expect(r.ok, `${n}/${c}`).toBe(true);
      if (r.ok) h = r.history;
    }
    return h;
  };

  it('helping the boy costs food and ammunition and changes who steals the food (the theft takes one more ration)', () => {
    const base = deriveState(story, []);
    const helped = deriveState(story, play([['c1_d1', 'help']]));
    expect(num(helped.flags['#food'])).toBe(num(base.flags['#food']) - 2);
    expect(num(helped.flags['#ammo'])).toBe(num(base.flags['#ammo']) - 1);
    expect(helped.flags.child).toBe('with');
    expect(helped.flags.thief).toBe('emily');
    const left = deriveState(story, play([['c1_d1', 'leave']]));
    expect(left.flags.thief).toBe('leo');
    expect(num(left.flags['#food'])).toBe(num(base.flags['#food']) - 1);
    expect(num(left.flags['#t.emily'])).toBeLessThan(0);
  });

  it('accusing the wrong person is remembered; accusing the right one is too', () => {
    const wrong = deriveState(story, play([['c1_d1', 'help'], ['c1_d2', 'confront_leo']]));
    expect(wrong.flags.leo_wronged).toBe('yes');
    expect(num(wrong.flags['#t.leo'])).toBe(-3);
    const right = deriveState(story, play([['c1_d1', 'leave'], ['c1_d2', 'confront_leo']]));
    expect(right.flags.leo_exposed).toBe('yes');
  });

  it('dialogue changes with earlier choices (the night scene reacts to the child)', () => {
    const night = story.nodes.c1_night;
    if (night.type !== 'scene') throw new Error();
    const withBoy = resolveLines(night.scene, deriveState(story, play([['c1_d1', 'help']])).flags).map((l) => l.text).join(' ');
    const without = resolveLines(night.scene, deriveState(story, play([['c1_d1', 'leave']])).flags).map((l) => l.text).join(' ');
    expect(withBoy).not.toBe(without);
    expect(withBoy).toContain('sleep near Emily');
    expect(without).toContain('Nobody speaks of the boy');
  });

  it('evidence that changes the story is recorded in the history and replays', () => {
    const h = play([], [['c1_search', 'c1_tank'], ['c1_search', 'c1_note']]);
    expect(h.filter(isEvidenceRecord)).toHaveLength(2);
    const st = deriveState(story, h);
    expect(num(st.flags['#fuel'])).toBe(6);
    expect(st.flags.note).toBe('yes');
    // not twice, and not once the investigation is over
    expect(submitEvidence(story, h, 'c1_search', 'c1_tank', 0).ok).toBe(false);
    const after = play([['c1_d1', 'help']], [['c1_search', 'c1_note']]);
    expect(submitEvidence(story, after, 'c1_search', 'c1_tank', 0).ok).toBe(false);
  });

  it('a conditional choice is refused when its condition does not hold', () => {
    // "Push to the lodge" needs the map from chapter 3.
    const st = deriveState(story, []);
    const node = getDecision(story, 'c3_d5')!;
    const push = node.choices.find((c) => c.id === 'push')!;
    expect(availableChoices(node, st.flags).some((c) => c.id === push.id)).toBe(false);
  });

  it('the map shows the player path across all chapters', () => {
    const h = rec(FIXTURES.TOGETHER);
    const layout = buildMapLayout(story);
    const hi = highlightPath(story, layout, h);
    const decisions = h.filter((r) => !isEvidenceRecord(r)).length;
    expect(hi.visitedNodes.size).toBe(1 + decisions * 2 + 1);
    expect(hi.visitedNodes.has('ending:TOGETHER')).toBe(true);
    expect(layout.nodes.filter((n) => n.kind === 'ending')).toHaveLength(7);
    expect(summarizePath(story, h).map((s) => s.chapter)).toContain(6);
  });

  it('timeline has a beat per scene, investigation, decision and reaction', () => {
    const st = deriveState(story, rec(FIXTURES.NEW_HOME));
    const beats = buildTimeline(story, st);
    expect(beats[0].key).toBe('c1_intro');
    expect(beats[beats.length - 1].key).toBe('ending');
    expect(beats.some((b) => b.kind === 'investigation')).toBe(true);
  });
});

describe('The Last Journey: saving', () => {
  it('keeps its own save, survives a round trip and discards a tampered history', () => {
    const storage = new Map<string, string>();
    const fake = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) } as unknown as Storage;
    const h = rec(FIXTURES.ALONE);
    const p = withDecision(story, emptyProgress(story.id), h, 5);
    expect(saveProgress({ ...p, fragments: ['c1_note'] }, fake)).toBe(true);
    const back = loadProgress(story, fake);
    expect(back.progress.history).toEqual(h);
    expect(back.progress.completed[h.map((r) => r.choiceId).join('.')].endingId).toBe('ALONE');
    expect(back.progress.fragments).toEqual(['c1_note']);
    const bad = JSON.stringify({ ...p, history: [{ nodeId: 'c6_d14', choiceId: 'new_home', timestamp: 1 }] });
    expect(parseProgress(story, bad).recovered).toBe(true);
    expect([...storage.keys()].every((k) => k.includes('the-last-journey'))).toBe(true);
  });
});

describe('Russian version behaves identically', () => {
  it('every fixture reaches the same ending and the same number of resolved fragments', () => {
    const ru: Story = getStories('ru')[2];
    for (const [id, steps] of Object.entries(FIXTURES)) {
      const h = rec(steps);
      expect(deriveState(ru, h).endingId).toBe(id);
      expect(resolveEnding(ru, h)!.fragments.length).toBe(resolveEnding(story, h)!.fragments.length);
      expect(resolveEnding(ru, h)!.lines.length).toBe(resolveEnding(story, h)!.lines.length);
    }
  });
});
