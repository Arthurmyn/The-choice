import { useMemo } from 'react';
import { deriveState, buildTimeline } from '../engine/narrativeEngine';
import { hasActiveRun, latestRun } from '../engine/progressManager';
import type { Story } from '../engine/types';
import { useGame } from './useGameState';

export type StoryStatus = 'new' | 'in-progress' | 'completed';

/** Derived view of one story's progress. Never stores anything itself. */
export function useStoryProgress(story: Story) {
  const { progressOf } = useGame();
  const progress = progressOf(story.id);
  return useMemo(() => {
    const state = deriveState(story, progress.history);
    const timeline = buildTimeline(story, state);
    const endingsFound = new Set(Object.values(progress.completed).map((r) => r.endingId));
    const status: StoryStatus = state.complete ? 'completed' : hasActiveRun(progress) ? 'in-progress' : endingsFound.size ? 'completed' : 'new';
    return { progress, state, timeline, endingsFound, status, latest: latestRun(progress) };
  }, [story, progress]);
}
