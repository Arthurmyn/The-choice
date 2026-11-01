import { deriveState, pathKey } from './narrativeEngine';
import type { CompletedRun, Cursor, DecisionRecord, Story, StoryProgress } from './types';

export const SAVE_VERSION = 1;
export const KEY_PREFIX = 'wws:v1';
export const storyKey = (storyId: string): string => `${KEY_PREFIX}:story:${storyId}`;
export const LAST_KEY = `${KEY_PREFIX}:last`;
export const SETTINGS_KEY = `${KEY_PREFIX}:settings`;

export function emptyProgress(storyId: string): StoryProgress {
  return { version: 1, storyId, history: [], cursor: null, completed: {}, fragments: [], updatedAt: 0 };
}

const isObj = (v: object | null | undefined | string | number | boolean): v is Record<string, object> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitizeHistory(story: Story, raw: object | undefined): DecisionRecord[] | null {
  if (!Array.isArray(raw)) return null;
  const history: DecisionRecord[] = [];
  for (const r of raw as object[]) {
    const rec = r as Partial<DecisionRecord>;
    if (typeof rec.nodeId !== 'string' || typeof rec.choiceId !== 'string') return null;
    history.push({
      nodeId: rec.nodeId,
      choiceId: rec.choiceId,
      timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : 0,
    });
  }
  return deriveState(story, history).valid ? history : null;
}

export interface LoadResult {
  progress: StoryProgress;
  /** Set when stored data was unreadable or outdated and had to be discarded. */
  recovered: boolean;
}

/** Parse + validate raw save text. Never throws. */
export function parseProgress(story: Story, raw: string | null): LoadResult {
  if (!raw) return { progress: emptyProgress(story.id), recovered: false };
  try {
    const data = JSON.parse(raw) as object;
    if (!isObj(data) || (data as { version?: number }).version !== SAVE_VERSION) throw new Error('version');
    const d = data as unknown as Partial<StoryProgress>;
    if (d.storyId !== story.id) throw new Error('story mismatch');

    const history = sanitizeHistory(story, d.history) ?? [];
    const completed: Record<string, CompletedRun> = {};
    if (isObj(d.completed as object)) {
      for (const run of Object.values(d.completed as Record<string, Partial<CompletedRun>>)) {
        const h = sanitizeHistory(story, run.history);
        const st = h ? deriveState(story, h) : null;
        if (h && st?.complete && st.endingId) {
          completed[pathKey(h)] = {
            endingId: st.endingId,
            history: h,
            completedAt: typeof run.completedAt === 'number' ? run.completedAt : 0,
          };
        }
      }
    }
    const cursor = d.cursor && typeof d.cursor.key === 'string' && typeof d.cursor.line === 'number' ? d.cursor : null;
    const intact = history.length === (Array.isArray(d.history) ? d.history.length : 0);
    return {
      progress: {
        version: 1,
        storyId: story.id,
        history,
        cursor: intact ? cursor : null,
        completed,
        fragments: Array.isArray(d.fragments) ? (d.fragments as string[]).filter((f) => typeof f === 'string') : [],
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
      },
      recovered: !intact,
    };
  } catch {
    return { progress: emptyProgress(story.id), recovered: true };
  }
}

export function loadProgress(story: Story, storage: Storage | null = safeStorage()): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(storyKey(story.id)) ?? null;
  } catch {
    return { progress: emptyProgress(story.id), recovered: false };
  }
  const result = parseProgress(story, raw);
  if (result.recovered && raw) {
    try {
      storage?.setItem(`${storyKey(story.id)}:corrupt`, raw);
    } catch {
      /* ignore */
    }
  }
  return result;
}

/** Returns false when the data could not be persisted. */
export function saveProgress(progress: StoryProgress, storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storyKey(progress.storyId), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${KEY_PREFIX}:probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/* ---------- Pure progress transitions ---------- */

export function withDecision(story: Story, progress: StoryProgress, history: DecisionRecord[], now: number): StoryProgress {
  const st = deriveState(story, history);
  const completed = { ...progress.completed };
  if (st.complete && st.endingId) {
    completed[pathKey(history)] = { endingId: st.endingId, history, completedAt: now };
  }
  return { ...progress, history, completed, updatedAt: now };
}

export function withCursor(progress: StoryProgress, cursor: Cursor): StoryProgress {
  return { ...progress, cursor };
}

/** Restart one story: clears the active run but keeps completed runs. */
export function restarted(progress: StoryProgress, now: number): StoryProgress {
  return { ...progress, history: [], cursor: null, updatedAt: now };
}

export function hasActiveRun(progress: StoryProgress): boolean {
  return progress.history.length > 0 || progress.cursor !== null;
}

export function latestRun(progress: StoryProgress): CompletedRun | null {
  const runs = Object.values(progress.completed);
  if (!runs.length) return null;
  return runs.reduce((a, b) => (b.completedAt >= a.completedAt ? b : a));
}

export function withFragment(progress: StoryProgress, itemId: string): StoryProgress {
  return progress.fragments.includes(itemId) ? progress : { ...progress, fragments: [...progress.fragments, itemId] };
}
