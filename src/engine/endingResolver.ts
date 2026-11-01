import { deriveState, filterConditional, joinVariants, resolveLines } from './narrativeEngine';
import type { DecisionRecord, Ending, Line, Story } from './types';

export interface ResolvedEnding {
  ending: Ending;
  lines: Line[];
  fragments: string[];
  consequences: string[];
  flags: Record<string, string>;
}

export function resolveEnding(story: Story, history: readonly DecisionRecord[]): ResolvedEnding | null {
  const state = deriveState(story, history);
  if (!state.valid || !state.endingId) return null;
  const ending = story.endings[state.endingId];
  if (!ending) return null;
  return {
    ending,
    lines: resolveLines(ending.scene, state.flags),
    fragments: filterConditional(ending.fragments, state.flags).map((f) => f.text),
    consequences: ending.consequences
      .filter((c) => filterConditional([c], state.flags).length > 0)
      .map((c) => c.text),
    flags: state.flags,
  };
}

export function resolveChoiceMessage(
  parts: Parameters<typeof joinVariants>[0],
  flags: Record<string, string>,
): string {
  return joinVariants(parts, flags);
}
