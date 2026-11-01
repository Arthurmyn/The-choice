import type {
  Beat,
  Choice,
  Condition,
  Conditional,
  DecisionNode,
  DecisionRecord,
  EngineState,
  Line,
  SceneContent,
  Story,
  StoryNode,
  TextVariant,
} from './types';

/* ---------- Conditions ---------- */

export function evaluate(cond: Condition | undefined, flags: Record<string, string>): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluate(c, flags));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, flags));
  if ('is' in cond) return flags[cond.flag] === cond.is;
  return flags[cond.flag] !== cond.isNot;
}

export function filterConditional<T extends Conditional>(
  items: readonly T[],
  flags: Record<string, string>,
): T[] {
  return items.filter((i) => evaluate(i.when, flags));
}

export function joinVariants(parts: readonly TextVariant[], flags: Record<string, string>): string {
  return filterConditional(parts, flags)
    .map((p) => p.text)
    .join(' ');
}

export function resolveLines(scene: SceneContent, flags: Record<string, string>): Line[] {
  return filterConditional(scene.lines, flags);
}

/* ---------- State derivation ---------- */

export function getDecision(story: Story, nodeId: string): DecisionNode | undefined {
  const node = story.nodes[nodeId];
  return node && node.type === 'decision' ? node : undefined;
}

export function getChoice(story: Story, nodeId: string, choiceId: string): Choice | undefined {
  return getDecision(story, nodeId)?.choices.find((c) => c.id === choiceId);
}

/**
 * Single source of truth: everything (flags, ending, path, pending decision)
 * is derived by replaying the ordered decision history over the story graph.
 */
export function deriveState(story: Story, history: readonly DecisionRecord[]): EngineState {
  const flags: Record<string, string> = {};
  const selected: Record<string, string> = {};
  const path: string[] = [];
  let nodeId: string | undefined = story.start;
  let cursor = 0;
  let guard = 0;

  const fail = (error: string): EngineState => ({
    valid: false,
    error,
    path,
    pendingDecisionId: null,
    flags,
    selected,
    endingId: null,
    complete: false,
  });

  while (nodeId) {
    if (guard++ > 200) return fail('Story graph contains a cycle.');
    const node: StoryNode | undefined = story.nodes[nodeId];
    if (!node) return fail(`Unknown node "${nodeId}".`);
    path.push(nodeId);

    if (node.type !== 'decision') {
      nodeId = node.next;
      continue;
    }

    const record = history[cursor];
    if (!record) {
      return {
        valid: cursor === history.length,
        path,
        pendingDecisionId: nodeId,
        flags,
        selected,
        endingId: null,
        complete: false,
      };
    }
    if (record.nodeId !== nodeId) {
      return fail(`Expected a decision at "${nodeId}" but history has "${record.nodeId}".`);
    }
    const choice: Choice | undefined = node.choices.find((c) => c.id === record.choiceId);
    if (!choice) return fail(`Invalid choice "${record.choiceId}" for "${nodeId}".`);

    Object.assign(flags, choice.sets);
    selected[nodeId] = choice.id;
    cursor += 1;

    if (choice.ending) {
      if (!story.endings[choice.ending]) return fail(`Unknown ending "${choice.ending}".`);
      if (cursor !== history.length) return fail('History continues past the ending.');
      return {
        valid: true,
        path,
        pendingDecisionId: null,
        flags,
        selected,
        endingId: choice.ending,
        complete: true,
      };
    }
    nodeId = choice.next ?? node.next;
  }
  return fail('Story ended without reaching an ending.');
}

/* ---------- Decision submission ---------- */

export type SubmitResult =
  | { ok: true; history: DecisionRecord[] }
  | { ok: false; error: string };

export function submitDecision(
  story: Story,
  history: readonly DecisionRecord[],
  nodeId: string,
  choiceId: string,
  now: number = Date.now(),
): SubmitResult {
  const state = deriveState(story, history);
  if (!state.valid) return { ok: false, error: state.error ?? 'Invalid story state.' };
  if (state.complete) return { ok: false, error: 'This story is already finished.' };
  if (state.selected[nodeId]) return { ok: false, error: 'Decision already submitted.' };
  if (state.pendingDecisionId !== nodeId) return { ok: false, error: 'This is not the active decision.' };
  if (!getChoice(story, nodeId, choiceId)) return { ok: false, error: 'Invalid choice.' };
  return { ok: true, history: [...history, { nodeId, choiceId, timestamp: now }] };
}

/* ---------- Timeline (what the player sees, in order) ---------- */

export function buildTimeline(story: Story, state: EngineState): Beat[] {
  const beats: Beat[] = [];
  for (const nodeId of state.path) {
    const node = story.nodes[nodeId];
    if (!node) continue;
    beats.push({ key: nodeId, kind: node.type, nodeId });
    if (node.type === 'decision' && state.selected[nodeId]) {
      beats.push({ key: `${nodeId}:reaction`, kind: 'reaction', nodeId });
    }
  }
  if (state.complete) beats.push({ key: 'ending', kind: 'ending', nodeId: state.endingId ?? '' });
  return beats;
}

/* ---------- Path helpers ---------- */

export function pathKey(history: readonly DecisionRecord[]): string {
  return history.map((h) => h.choiceId).join('.');
}

export interface PathSummaryItem {
  stage: string;
  title: string;
  nodeId: string;
  choice: Choice;
}

export function summarizePath(story: Story, history: readonly DecisionRecord[]): PathSummaryItem[] {
  const items: PathSummaryItem[] = [];
  for (const rec of history) {
    const node = getDecision(story, rec.nodeId);
    const choice = node?.choices.find((c) => c.id === rec.choiceId);
    if (node && choice) items.push({ stage: node.stage, title: node.title, nodeId: node.id, choice });
  }
  return items;
}

/** Every possible full path through the story (used by validation and tests). */
export function enumeratePaths(story: Story): DecisionRecord[][] {
  const out: DecisionRecord[][] = [];
  const walk = (history: DecisionRecord[]): void => {
    const state = deriveState(story, history);
    if (!state.valid) throw new Error(state.error);
    if (state.complete || !state.pendingDecisionId) {
      out.push(history);
      return;
    }
    const node = getDecision(story, state.pendingDecisionId);
    if (!node) return;
    for (const c of node.choices) {
      walk([...history, { nodeId: node.id, choiceId: c.id, timestamp: 0 }]);
    }
  };
  walk([]);
  return out;
}
