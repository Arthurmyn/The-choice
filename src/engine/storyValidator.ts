import { enumeratePaths, deriveState } from './narrativeEngine';
import type { Condition, Story } from './types';

function conditionFlags(c: Condition | undefined, out: Set<string>): void {
  if (!c) return;
  if ('all' in c) c.all.forEach((x) => conditionFlags(x, out));
  else if ('any' in c) c.any.forEach((x) => conditionFlags(x, out));
  else out.add(c.flag);
}

/** Structural validation of a story file. Returns a list of problems (empty = valid). */
export function validateStory(story: Story): string[] {
  const errors: string[] = [];
  if (!story.nodes[story.start]) errors.push(`Start node "${story.start}" does not exist.`);

  const settable = new Set<string>();
  const usedEndings = new Set<string>();

  for (const node of Object.values(story.nodes)) {
    if (node.type === 'decision') {
      if (node.choices.length < 2) errors.push(`${node.id}: needs at least two choices.`);
      const ids = new Set<string>();
      for (const c of node.choices) {
        if (ids.has(c.id)) errors.push(`${node.id}: duplicate choice id "${c.id}".`);
        ids.add(c.id);
        Object.keys(c.sets).forEach((k) => settable.add(k));
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
    } else if (!story.nodes[node.next]) {
      errors.push(`${node.id}: next node "${node.next}" does not exist.`);
    }
  }

  for (const id of Object.keys(story.endings)) {
    if (!usedEndings.has(id)) errors.push(`Ending "${id}" is unreachable.`);
  }

  // Every flag used in a condition must be settable.
  const used = new Set<string>();
  for (const node of Object.values(story.nodes)) {
    if (node.type === 'decision') node.choices.forEach((c) => c.reaction.lines.forEach((l) => conditionFlags(l.when, used)));
    else node.scene.lines.forEach((l) => conditionFlags(l.when, used));
  }
  for (const e of Object.values(story.endings)) {
    e.scene.lines.forEach((l) => conditionFlags(l.when, used));
    e.fragments.forEach((l) => conditionFlags(l.when, used));
    e.consequences.forEach((l) => conditionFlags(l.when, used));
  }
  used.forEach((f) => {
    if (!settable.has(f)) errors.push(`Condition uses flag "${f}" which no choice sets.`);
  });

  // Every path must be valid and finish in a defined ending with analysis.
  try {
    for (const p of enumeratePaths(story)) {
      const st = deriveState(story, p);
      if (!st.complete || !st.endingId) errors.push('A path does not reach an ending.');
      else {
        for (const ph of ['kant', 'mill', 'aristotle'] as const) {
          const a = story.analysis[ph];
          if (!a.application.byEnding[st.endingId]) errors.push(`${ph}: missing application for ${st.endingId}.`);
          if (!a.limitation[st.endingId]) errors.push(`${ph}: missing limitation for ${st.endingId}.`);
          for (const [flag, value] of Object.entries(st.flags)) {
            if (!a.application.byFlag[`${flag}=${value}`]) errors.push(`${ph}: missing fragment ${flag}=${value}.`);
          }
        }
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Path enumeration failed.');
  }
  return errors;
}
