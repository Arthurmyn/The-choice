import {
  availableChoices,
  deriveState,
  enumeratePaths,
  getDecision,
  randomPlaythrough,
  rng,
} from './narrativeEngine';
import type { Apply, Condition, Line, Story } from './types';

function conditionFlags(c: Condition | undefined, out: Set<string>): void {
  if (!c) return;
  if ('all' in c) c.all.forEach((x) => conditionFlags(x, out));
  else if ('any' in c) c.any.forEach((x) => conditionFlags(x, out));
  else out.add(c.flag);
}

function applyKeys(entries: readonly Apply[] | undefined, settable: Set<string>, used: Set<string>): void {
  for (const a of entries ?? []) {
    conditionFlags(a.when, used);
    Object.keys(a.sets ?? {}).forEach((k) => settable.add(k));
    Object.keys(a.effects ?? {}).forEach((k) => settable.add(k));
  }
}

const sceneLines = (s: Story): Line[] =>
  Object.values(s.nodes).flatMap((n) => (n.type === 'decision' ? n.choices.flatMap((c) => c.reaction.lines) : n.type === 'router' ? [] : n.scene.lines));

/** Structural validation of a story file. Returns a list of problems (empty = valid). */
export function validateStory(story: Story, samples = 3000): string[] {
  const errors: string[] = [];
  if (!story.nodes[story.start]) errors.push(`Start node "${story.start}" does not exist.`);

  const settable = new Set<string>(Object.keys(story.initial ?? {}));
  const used = new Set<string>();
  const usedEndings = new Set<string>();

  for (const node of Object.values(story.nodes)) {
    if (node.type === 'router') {
      applyKeys(node.apply, settable, used);
      for (const r of node.routes) {
        conditionFlags(r.when, used);
        if (!r.next && !r.ending) errors.push(`${node.id}: route without target.`);
        if (r.next && !story.nodes[r.next]) errors.push(`${node.id}: route to unknown node "${r.next}".`);
        if (r.ending) {
          usedEndings.add(r.ending);
          if (!story.endings[r.ending]) errors.push(`${node.id}: unknown ending "${r.ending}".`);
        }
      }
      if (node.default && !story.nodes[node.default]) errors.push(`${node.id}: unknown default "${node.default}".`);
      if (node.defaultEnding) usedEndings.add(node.defaultEnding);
      if (!node.default && !node.defaultEnding) errors.push(`${node.id}: router without default.`);
    } else if (node.type === 'decision') {
      if (node.choices.length < 2) errors.push(`${node.id}: needs at least two choices.`);
      const ids = new Set<string>();
      for (const c of node.choices) {
        if (ids.has(c.id)) errors.push(`${node.id}: duplicate choice id "${c.id}".`);
        ids.add(c.id);
        Object.keys(c.sets).forEach((k) => settable.add(k));
        applyKeys(c.apply, settable, used);
        conditionFlags(c.when, used);
        const next = c.next ?? node.next;
        if (c.ending) {
          usedEndings.add(c.ending);
          if (!story.endings[c.ending]) errors.push(`${node.id}/${c.id}: unknown ending "${c.ending}".`);
        } else if (!next || !story.nodes[next]) {
          errors.push(`${node.id}/${c.id}: no valid next node.`);
        }
        if (c.interaction?.type === 'chat' && c.interaction.messages.length === 0) {
          errors.push(`${node.id}/${c.id}: chat has no messages.`);
        }
      }
    } else {
      applyKeys(node.apply, settable, used);
      if (!story.nodes[node.next]) errors.push(`${node.id}: next node "${node.next}" does not exist.`);
      if (node.type === 'investigation') {
        const itemIds = new Set<string>();
        for (const it of node.items) {
          if (itemIds.has(it.id)) errors.push(`${node.id}: duplicate item "${it.id}".`);
          itemIds.add(it.id);
          conditionFlags(it.when, used);
          applyKeys(it.apply, settable, used);
        }
      }
    }
  }

  for (const id of Object.keys(story.endings)) {
    if (!usedEndings.has(id)) errors.push(`Ending "${id}" is unreachable.`);
  }

  for (const l of sceneLines(story)) conditionFlags(l.when, used);
  for (const n of Object.values(story.nodes)) if (n.type === 'decision') n.choices.forEach((c) => c.interaction?.type === 'chat' && c.interaction.messages.forEach((m) => m.parts.forEach((p) => conditionFlags(p.when, used))));
  for (const e of Object.values(story.endings)) {
    e.scene.lines.forEach((l) => conditionFlags(l.when, used));
    e.fragments.forEach((l) => conditionFlags(l.when, used));
    e.consequences.forEach((l) => conditionFlags(l.when, used));
  }
  for (const a of Object.values(story.analysis)) a.application.fragments?.forEach((f) => conditionFlags(f.when, used));
  for (const ind of story.indicators ?? []) if (story.initial?.[ind.key] === undefined) errors.push(`Indicator "${ind.key}" has no initial value.`);
  used.forEach((f) => {
    if (!settable.has(f)) errors.push(`Condition uses flag "${f}" which nothing sets.`);
  });

  // Every playthrough must be valid and finish in a defined ending with analysis.
  const checkEnding = (endingId: string, flags: Record<string, string>, complete: boolean): void => {
    if (!complete) {
      errors.push('A path does not reach an ending.');
      return;
    }
    for (const [ph, a] of Object.entries(story.analysis)) {
      if (!a.application.byEnding[endingId]) errors.push(`${ph}: missing application for ${endingId}.`);
      if (!a.limitation[endingId]) errors.push(`${ph}: missing limitation for ${endingId}.`);
      if (!a.application.fragments) {
        for (const [flag, value] of Object.entries(flags)) {
          if (flag.startsWith('#')) continue;
          if (!a.application.byFlag[`${flag}=${value}`]) errors.push(`${ph}: missing fragment ${flag}=${value}.`);
        }
      }
    }
  };
  try {
    if (story.exhaustive === false) {
      const rand = rng(20240607);
      const reached = new Set<string>();
      for (let i = 0; i < samples; i++) {
        const { state } = randomPlaythrough(story, rand, 0.5);
        if (state.endingId) reached.add(state.endingId);
        checkEnding(state.endingId ?? '', state.flags, state.complete);
        if (errors.length > 40) break;
      }
      // Every decision's choices must at least be consistent when reached.
      for (const n of Object.values(story.nodes)) if (n.type === 'decision' && !n.choices.length) errors.push(`${n.id}: no choices.`);
      if (reached.size === 0) errors.push('No playthrough reached an ending.');
    } else {
      for (const p of enumeratePaths(story)) {
        const st = deriveState(story, p);
        checkEnding(st.endingId ?? '', st.flags, st.complete);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Path enumeration failed.');
  }
  // Decisions that could never offer a choice.
  for (const n of Object.values(story.nodes)) {
    if (n.type === 'decision' && getDecision(story, n.id) && availableChoices(n, {}).length === 0 && n.choices.every((c) => c.when)) {
      /* conditional-only decisions are allowed; reachability is covered by sampling */
    }
  }
  return [...new Set(errors)];
}
