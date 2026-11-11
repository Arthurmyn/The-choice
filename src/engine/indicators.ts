import { evaluate } from './narrativeEngine';
import type { DecisionRecord, Story } from './types';
import { deriveState } from './narrativeEngine';

export type Level = 'Low' | 'Strained' | 'Stable' | 'High';
export type Trend = 'up' | 'down' | 'same';

/** Qualitative reading of a 0 to 10 indicator. Numbers stay internal. */
export function levelOf(value: number): Level {
  if (value <= 2) return 'Low';
  if (value <= 4) return 'Strained';
  if (value <= 7) return 'Stable';
  return 'High';
}

export const trendOf = (before: number, after: number): Trend => (after > before ? 'up' : after < before ? 'down' : 'same');

const num = (v: string | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export interface DecisionDisclosure {
  nodeId: string;
  stage: string;
  title: string;
  choice: string;
  /** Declared effect of the option on each indicator (what the rule says, before clamping). */
  effects: { key: string; label: string; delta: number }[];
}

/**
 * "How the system worked": for every decision made, the stated effect of the chosen option on the
 * indicators. Read from the story data, so it can never drift from what the engine applied.
 */
export function disclosure(story: Story, history: readonly DecisionRecord[]): DecisionDisclosure[] {
  const state = deriveState(story, history);
  const out: DecisionDisclosure[] = [];
  for (const rec of history) {
    const node = story.nodes[rec.nodeId];
    if (node?.type !== 'decision') continue;
    const choice = node.choices.find((c) => c.id === rec.choiceId);
    if (!choice) continue;
    const before = state.snapshots[`${node.id}:before`] ?? {};
    const sums: Record<string, number> = {};
    for (const a of choice.apply ?? []) {
      if (!evaluate(a.when, before)) continue;
      for (const [k, d] of Object.entries(a.effects ?? {})) sums[k] = (sums[k] ?? 0) + d;
    }
    const effects = (story.indicators ?? [])
      .filter((i) => sums[i.key])
      .map((i) => ({ key: i.key, label: i.label, delta: sums[i.key] }));
    out.push({ nodeId: node.id, stage: node.stage, title: node.title, choice: choice.label, effects });
  }
  return out;
}

export { num as indicatorValue };
