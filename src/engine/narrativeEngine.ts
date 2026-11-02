import type {
  Apply,
  Beat,
  Choice,
  Condition,
  Conditional,
  DecisionNode,
  DecisionRecord,
  EngineState,
  EvidenceItem,
  InvestigationNode,
  Line,
  SceneContent,
  Story,
  StoryNode,
  TextVariant,
} from './types';

/* ---------- Conditions ---------- */

const num = (v: string | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function evaluate(cond: Condition | undefined, flags: Record<string, string>): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluate(c, flags));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, flags));
  if ('gte' in cond) return num(flags[cond.flag]) >= cond.gte;
  if ('lte' in cond) return num(flags[cond.flag]) <= cond.lte;
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

/** Run state changes in order against `flags` (mutates). */
export function applyAll(entries: readonly Apply[] | undefined, flags: Record<string, string>): void {
  for (const a of entries ?? []) {
    if (!evaluate(a.when, flags)) continue;
    if (a.sets) Object.assign(flags, a.sets);
    if (a.effects) for (const [k, d] of Object.entries(a.effects)) flags[k] = String(num(flags[k]) + d);
  }
}

/** Stats never go below zero (a resource cannot be negative). Trust may. */
const clamp = (flags: Record<string, string>): void => {
  for (const k of Object.keys(flags)) {
    if (/^#(food|med|ammo|fuel)$/.test(k) && num(flags[k]) < 0) flags[k] = '0';
  }
};

/* ---------- State derivation ---------- */

export function getDecision(story: Story, nodeId: string): DecisionNode | undefined {
  const node = story.nodes[nodeId];
  return node && node.type === 'decision' ? node : undefined;
}

export function getChoice(story: Story, nodeId: string, choiceId: string): Choice | undefined {
  return getDecision(story, nodeId)?.choices.find((c) => c.id === choiceId);
}

export const isEvidenceRecord = (r: DecisionRecord): boolean => r.choiceId.startsWith('item:');

/** Items of an investigation that are present in the current state. */
export function visibleItems(node: InvestigationNode, flags: Record<string, string>): EvidenceItem[] {
  return node.items.filter((i) => evaluate(i.when, flags));
}

/** Evidence only enters the history when inspecting it changes the story. */
export const changesStory = (item: EvidenceItem): boolean => !!item.apply?.length;

/**
 * Single source of truth: everything (flags, stats, ending, path, pending decision)
 * is derived by replaying the ordered history over the story graph.
 */
export function deriveState(story: Story, history: readonly DecisionRecord[]): EngineState {
  const flags: Record<string, string> = { ...(story.initial ?? {}) };
  const selected: Record<string, string> = {};
  const inspected: Record<string, string[]> = {};
  const snapshots: Record<string, Record<string, string>> = {};
  const path: string[] = [];
  let nodeId: string | undefined = story.start;
  let cursor = 0;
  let guard = 0;

  const fail = (error: string): EngineState => ({
    valid: false,
    error,
    path,
    inspected,
    snapshots,
    pendingDecisionId: null,
    flags,
    selected,
    endingId: null,
    complete: false,
  });
  const finish = (endingId: string): EngineState => {
    if (!story.endings[endingId]) return fail(`Unknown ending "${endingId}".`);
    if (cursor !== history.length) return fail('History continues past the ending.');
    return { valid: true, path, inspected, snapshots, pendingDecisionId: null, flags, selected, endingId, complete: true };
  };

  while (nodeId) {
    if (guard++ > 600) return fail('Story graph contains a cycle.');
    const node: StoryNode | undefined = story.nodes[nodeId];
    if (!node) return fail(`Unknown node "${nodeId}".`);
    path.push(nodeId);

    if (node.type === 'router') {
      applyAll(node.apply, flags);
      const hit: { when: Condition; next?: string; ending?: string } | undefined = node.routes.find((r) => evaluate(r.when, flags));
      if (hit?.ending) {
        clamp(flags);
        return finish(hit.ending);
      }
      if (!hit && node.defaultEnding) {
        clamp(flags);
        return finish(node.defaultEnding);
      }
      nodeId = hit?.next ?? node.default;
      if (!nodeId) return fail(`Router "${node.id}" has no route.`);
      continue;
    }

    if (node.type !== 'decision') {
      applyAll(node.apply, flags);
      clamp(flags);
      if (node.type === 'investigation') {
        while (history[cursor] && history[cursor].nodeId === node.id && isEvidenceRecord(history[cursor])) {
          const itemId = history[cursor].choiceId.slice(5);
          const item = node.items.find((i) => i.id === itemId);
          if (!item || !evaluate(item.when, flags)) return fail(`Invalid evidence "${itemId}" at "${node.id}".`);
          if ((inspected[node.id] ??= []).includes(itemId)) return fail(`Evidence "${itemId}" recorded twice.`);
          inspected[node.id].push(itemId);
          applyAll(item.apply, flags);
          clamp(flags);
          cursor += 1;
        }
      }
      snapshots[node.id] = { ...flags };
      nodeId = node.next;
      continue;
    }

    snapshots[`${nodeId}:before`] = { ...flags };
    const record = history[cursor];
    if (!record) {
      return {
        valid: cursor === history.length,
        path,
        inspected,
        snapshots,
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
    if (!evaluate(choice.when, flags)) return fail(`Choice "${choice.id}" is not available at "${nodeId}".`);

    Object.assign(flags, choice.sets);
    applyAll(choice.apply, flags);
    clamp(flags);
    selected[nodeId] = choice.id;
    snapshots[nodeId] = { ...flags };
    cursor += 1;

    if (choice.ending) return finish(choice.ending);
    nodeId = choice.next ?? node.next;
  }
  return fail('Story ended without reaching an ending.');
}

/** Choices that are offered right now (a choice may be conditional). */
export function availableChoices(node: DecisionNode, flags: Record<string, string>): Choice[] {
  return node.choices.filter((c) => evaluate(c.when, flags));
}

/* ---------- Submissions ---------- */

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
  const node = getDecision(story, nodeId);
  const choice = node && getChoice(story, nodeId, choiceId);
  if (!node || !choice) return { ok: false, error: 'Invalid choice.' };
  if (!evaluate(choice.when, state.flags)) return { ok: false, error: 'This choice is not available.' };
  return { ok: true, history: [...history, { nodeId, choiceId, timestamp: now }] };
}

/** Record that an item was inspected, but only while its investigation is the current one. */
export function submitEvidence(
  story: Story,
  history: readonly DecisionRecord[],
  nodeId: string,
  itemId: string,
  now: number = Date.now(),
): SubmitResult {
  const state = deriveState(story, history);
  if (!state.valid) return { ok: false, error: state.error ?? 'Invalid story state.' };
  if (state.complete) return { ok: false, error: 'This story is already finished.' };
  const node = story.nodes[nodeId];
  if (!node || node.type !== 'investigation') return { ok: false, error: 'Not an investigation.' };
  const item = node.items.find((i) => i.id === itemId);
  if (!item || !evaluate(item.when, state.flags)) return { ok: false, error: 'Unknown item.' };
  if (!changesStory(item)) return { ok: false, error: 'This item does not need recording.' };
  if (state.inspected[nodeId]?.includes(itemId)) return { ok: false, error: 'Already inspected.' };
  const at = state.path.lastIndexOf(nodeId);
  const lastAnswered = Math.max(-1, ...Object.keys(state.selected).map((d) => state.path.lastIndexOf(d)));
  if (at < 0 || at < lastAnswered) return { ok: false, error: 'This investigation is over.' };
  return { ok: true, history: [...history, { nodeId, choiceId: `item:${itemId}`, timestamp: now }] };
}

/* ---------- Timeline (what the player sees, in order) ---------- */

export function buildTimeline(story: Story, state: EngineState): Beat[] {
  const beats: Beat[] = [];
  for (const nodeId of state.path) {
    const node = story.nodes[nodeId];
    if (!node || node.type === 'router') continue;
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
  chapter?: number;
  choice: Choice;
}

export function summarizePath(story: Story, history: readonly DecisionRecord[]): PathSummaryItem[] {
  const items: PathSummaryItem[] = [];
  for (const rec of history) {
    const node = getDecision(story, rec.nodeId);
    const choice = node?.choices.find((c) => c.id === rec.choiceId);
    if (node && choice) items.push({ stage: node.stage, title: node.title, nodeId: node.id, chapter: node.chapter, choice });
  }
  return items;
}

/** Every full path through the story (for small, exhaustively testable stories). */
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
    for (const c of availableChoices(node, state.flags)) {
      walk([...history, { nodeId: node.id, choiceId: c.id, timestamp: 0 }]);
    }
  };
  walk([]);
  return out;
}

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One random but valid playthrough. Optionally inspects evidence that changes the story.
 * Returns the history and the final state, or throws if the story gets stuck.
 */
export function randomPlaythrough(story: Story, rand: () => number, inspectChance = 0.5): { history: DecisionRecord[]; state: EngineState } {
  let history: DecisionRecord[] = [];
  for (let step = 0; step < 400; step++) {
    let state = deriveState(story, history);
    if (!state.valid) throw new Error(state.error);
    if (state.complete) return { history, state };
    // Inspect evidence in the current investigation(s) before deciding.
    for (const nodeId of state.path) {
      const node = story.nodes[nodeId];
      if (node?.type !== 'investigation') continue;
      for (const item of visibleItems(node, state.flags)) {
        if (!changesStory(item) || rand() > inspectChance) continue;
        const r = submitEvidence(story, history, nodeId, item.id, 0);
        if (r.ok) history = r.history;
      }
    }
    state = deriveState(story, history);
    const node = state.pendingDecisionId ? getDecision(story, state.pendingDecisionId) : undefined;
    if (!node) throw new Error('No pending decision and no ending.');
    const options = availableChoices(node, state.flags);
    if (!options.length) throw new Error(`No available choice at "${node.id}".`);
    const pick = options[Math.floor(rand() * options.length)];
    history = [...history, { nodeId: node.id, choiceId: pick.id, timestamp: 0 }];
  }
  throw new Error('Playthrough did not finish.');
}

/** Every spoken/narrated line of a story, including endings (all variants). */
export function allLines(story: Story): Line[] {
  const nodes = Object.values(story.nodes).flatMap((n) => (n.type === 'decision' ? n.choices.flatMap((c) => c.reaction.lines) : n.type === 'router' ? [] : n.scene.lines));
  return [...nodes, ...Object.values(story.endings).flatMap((e) => e.scene.lines)];
}
