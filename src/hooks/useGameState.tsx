import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { stories } from '../data';
import { submitDecision } from '../engine/narrativeEngine';
import type { SubmitResult } from '../engine/narrativeEngine';
import {
  LAST_KEY,
  SETTINGS_KEY,
  loadProgress,
  restarted,
  safeStorage,
  saveProgress,
  withCursor,
  withDecision,
  withFragment,
} from '../engine/progressManager';
import type { Cursor, Story, StoryProgress } from '../engine/types';
import type { Lang } from '../data';
import { detectLang, translate } from '../i18n';

export type TextSize = 'small' | 'medium' | 'large';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  textSize: TextSize;
  subtitles: boolean;
  reducedMotion: boolean;
  typewriter: boolean;
  cameraMotion: boolean;
  muted: boolean;
  voiceOn: boolean;
  voiceVolume: number;
  lang: Lang;
}

const prefersReduced = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const defaultSettings = (): Settings => ({
  musicVolume: 0.5,
  sfxVolume: 0.7,
  textSize: 'medium',
  subtitles: true,
  reducedMotion: prefersReduced(),
  typewriter: true,
  cameraMotion: true,
  muted: false,
  voiceOn: true,
  voiceVolume: 0.9,
  lang: detectLang(),
});

function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = safeStorage()?.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<Settings>;
    const num = (v: number | undefined, fb: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fb);
    const bool = (v: boolean | undefined, fb: boolean): boolean => (typeof v === 'boolean' ? v : fb);
    return {
      musicVolume: num(d.musicVolume, base.musicVolume),
      sfxVolume: num(d.sfxVolume, base.sfxVolume),
      textSize: d.textSize === 'small' || d.textSize === 'large' ? d.textSize : 'medium',
      subtitles: bool(d.subtitles, base.subtitles),
      reducedMotion: bool(d.reducedMotion, base.reducedMotion),
      typewriter: bool(d.typewriter, base.typewriter),
      cameraMotion: bool(d.cameraMotion, base.cameraMotion),
      muted: bool(d.muted, base.muted),
      voiceOn: bool(d.voiceOn, base.voiceOn),
      voiceVolume: num(d.voiceVolume, base.voiceVolume),
      lang: d.lang === 'ru' || d.lang === 'en' ? d.lang : base.lang,
    };
  } catch {
    return base;
  }
}

interface GameContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  progressOf: (storyId: string) => StoryProgress;
  confirmDecision: (story: Story, nodeId: string, choiceId: string) => SubmitResult;
  setCursor: (storyId: string, cursor: Cursor) => void;
  restartStory: (storyId: string) => void;
  collectFragment: (storyId: string, itemId: string) => void;
  lastStoryId: string | null;
  storageWarning: string | null;
  recoveredStories: string[];
}

const GameContext = createContext<GameContextValue | null>(null);

type ProgressMap = Record<string, StoryProgress>;

export function GameProvider({ children }: { children: ReactNode }): ReactNode {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [recovered] = useState<string[]>([]);
  const initial = useMemo(() => {
    const map: ProgressMap = {};
    const rec: string[] = [];
    for (const s of stories) {
      const r = loadProgress(s);
      map[s.id] = r.progress;
      if (r.recovered) rec.push(s.id);
    }
    return { map, rec };
  }, []);
  const [progress, setProgress] = useState<ProgressMap>(initial.map);
  const ref = useRef<ProgressMap>(initial.map);
  const [warning, setWarning] = useState<string | null>(safeStorage() ? null : translate(loadSettings().lang, 'Progress cannot be saved in this browser. You can still play, but closing the page will lose it.'));
  const [lastStoryId, setLast] = useState<string | null>(() => {
    try {
      return safeStorage()?.getItem(LAST_KEY) ?? null;
    } catch {
      return null;
    }
  });

  const persist = useCallback((next: StoryProgress) => {
    ref.current = { ...ref.current, [next.storyId]: next };
    setProgress(ref.current);
    const ok = saveProgress(next);
    if (ok) {
      try {
        safeStorage()?.setItem(LAST_KEY, next.storyId);
      } catch {
        /* ignore */
      }
      setLast(next.storyId);
      setWarning(null);
    } else {
      setWarning(translate(loadSettings().lang, 'Progress could not be saved. Storage may be full or disabled. You can keep playing, but progress will be lost on reload.'));
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        safeStorage()?.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const confirmDecision = useCallback(
    (story: Story, nodeId: string, choiceId: string): SubmitResult => {
      const current = ref.current[story.id];
      const res = submitDecision(story, current.history, nodeId, choiceId, Date.now());
      if (res.ok) persist(withDecision(story, current, res.history, Date.now()));
      return res;
    },
    [persist],
  );

  const setCursor = useCallback(
    (storyId: string, cursor: Cursor) => {
      const current = ref.current[storyId];
      if (current.cursor?.key === cursor.key && current.cursor.line === cursor.line) return;
      persist(withCursor(current, cursor));
    },
    [persist],
  );

  const restartStory = useCallback(
    (storyId: string) => persist(restarted(ref.current[storyId], Date.now())),
    [persist],
  );

  const collectFragment = useCallback(
    (storyId: string, itemId: string) => {
      const current = ref.current[storyId];
      if (!current.fragments.includes(itemId)) persist(withFragment(current, itemId));
    },
    [persist],
  );

  // Apply display settings to the document.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = settings.textSize;
    root.lang = settings.lang;
    root.classList.toggle('reduce-motion', settings.reducedMotion);
    root.classList.toggle('no-camera', !settings.cameraMotion);
  }, [settings.textSize, settings.reducedMotion, settings.cameraMotion, settings.lang]);

  const value = useMemo<GameContextValue>(
    () => ({
      settings,
      updateSettings,
      progressOf: (id) => progress[id],
      confirmDecision,
      setCursor,
      restartStory,
      collectFragment,
      lastStoryId,
      storageWarning: warning,
      recoveredStories: [...recovered, ...initial.rec],
    }),
    [settings, updateSettings, progress, confirmDecision, setCursor, restartStory, collectFragment, lastStoryId, warning, recovered, initial.rec],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
