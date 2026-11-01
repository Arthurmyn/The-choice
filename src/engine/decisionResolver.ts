import { deriveState, getDecision } from './narrativeEngine';
import type { Choice, DecisionNode, DecisionRecord, Story } from './types';

/** What the player is currently being asked, if anything. */
export function activeDecision(story: Story, history: readonly DecisionRecord[]): DecisionNode | null {
  const state = deriveState(story, history);
  if (!state.valid || !state.pendingDecisionId) return null;
  return getDecision(story, state.pendingDecisionId) ?? null;
}

export function isChoiceAvailable(
  story: Story,
  history: readonly DecisionRecord[],
  nodeId: string,
  choiceId: string,
): boolean {
  const node = activeDecision(story, history);
  return !!node && node.id === nodeId && node.choices.some((c: Choice) => c.id === choiceId);
}

/** Readable label for each flag that was set by the history. */
export function describeFlags(story: Story, flags: Record<string, string>): { flag: string; label: string }[] {
  const out: { flag: string; label: string }[] = [];
  for (const fl of story.flagLabels) {
    const v = flags[fl.flag];
    if (v && fl.values[v]) out.push({ flag: fl.flag, label: fl.values[v] });
  }
  return out;
}
