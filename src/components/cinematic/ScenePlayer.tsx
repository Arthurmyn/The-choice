import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { Character, Line, SceneContent } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import { useAudio } from '../../hooks/useAudio';
import { useParallax } from '../../hooks/useParallax';
import { useLang } from '../../i18n';
import { NARRATOR, voice } from '../../hooks/voice';
import { CharacterPortrait } from './CharacterPortrait';
import { DialoguePanel } from './DialoguePanel';
import { SceneBackground } from './SceneBackground';

const isInteractive = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && !!el.closest('button, a, input, textarea, select, [role="dialog"], [role="tab"]');

export function ScenePlayer({
  scene,
  lines,
  characters,
  index,
  onIndexChange,
  onFinish,
  tail,
  children,
  sceneKey,
}: {
  scene: SceneContent;
  lines: Line[];
  characters: Record<string, Character>;
  index: number;
  onIndexChange: (i: number) => void;
  /** Called when the player moves past the last line and no `tail` is given. */
  onFinish?: () => void;
  /** Rendered in place of the dialogue once all lines are read. */
  tail?: ReactNode;
  children?: ReactNode;
  sceneKey: string;
}): ReactNode {
  const t = useT();
  const { settings } = useGame();
  const { setAmbient, play } = useAudio();
  const portraitPar = useParallax(-22);
  const lang = useLang();
  const [cardOpen, setCardOpen] = useState<boolean>(!!scene.card && index === 0);
  const done = index >= lines.length;
  const current: Line | undefined = lines[Math.min(index, lines.length - 1)];

  useEffect(() => {
    setAmbient(scene.ambient ?? 'none');
  }, [scene.ambient, setAmbient]);

  useEffect(() => {
    play('transition');
  }, [sceneKey, play]);

  useEffect(() => {
    if (!cardOpen) return;
    const t = window.setTimeout(() => setCardOpen(false), 2600);
    return () => window.clearTimeout(t);
  }, [cardOpen]);

  // Voice-over: each line is read by its character; narration by the narrator.
  const speakerChar = current?.speaker ? characters[current.speaker] : undefined;
  const lineText = current?.text;
  const lineSpeaker = current?.speaker ?? 'narrator';
  const lineVoice = speakerChar?.voice ?? NARRATOR;
  useEffect(() => {
    if (cardOpen || done || !lineText) {
      voice.cancel();
      return;
    }
    voice.speak(lineText, lineVoice, lineSpeaker, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineText, lineSpeaker, cardOpen, done, sceneKey, lang]);
  useEffect(() => () => voice.cancel(), []);

  const replay = useCallback(() => {
    if (lineText) voice.speak(lineText, lineVoice, lineSpeaker, lang);
  }, [lineText, lineVoice, lineSpeaker, lang]);

  const advance = useCallback(() => {
    if (index + 1 >= lines.length) {
      if (tail) onIndexChange(lines.length);
      else onFinish?.();
    } else onIndexChange(index + 1);
  }, [index, lines.length, tail, onIndexChange, onFinish]);

  const back = useCallback(() => {
    if (index > 0) onIndexChange(Math.min(index, lines.length) - 1);
  }, [index, lines.length, onIndexChange]);

  useEffect(() => {
    if (lines.length === 0 && !tail) onFinish?.();
  }, [lines.length, tail, onFinish]);

  const advanceRef = useRef(advance);
  const backRef = useRef(back);
  advanceRef.current = advance;
  backRef.current = back;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (cardOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          setCardOpen(false);
        }
        return;
      }
      if (done || isInteractive(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        backRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardOpen, done]);

  // Who is on screen: scene cast plus any speaker in these lines.
  const cast = useMemo(() => {
    const ids = [...(scene.cast ?? [])];
    for (const l of lines) if (l.speaker && !ids.includes(l.speaker)) ids.push(l.speaker);
    return ids.filter((id) => characters[id]).slice(0, 4);
  }, [scene.cast, lines, characters]);

  const speakerId = !done ? current?.speaker : undefined;
  const speakerExpr = current?.expression ?? 'neutral';
  // Remember each character's latest expression up to the current line.
  const expressions = useMemo(() => {
    const m: Record<string, Line['expression']> = {};
    for (let i = 0; i <= Math.min(index, lines.length - 1); i++) {
      const l = lines[i];
      if (l.speaker) m[l.speaker] = l.expression ?? 'neutral';
    }
    return m;
  }, [lines, index]);

  return (
    <div className="scene" data-scene={sceneKey}>
      <SceneBackground id={scene.background} className="cam" />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="letterbox top" aria-hidden="true" />
      <div className="letterbox bottom" aria-hidden="true" />
      <div className="key-light" aria-hidden="true" />

      <div className={`portraits count-${cast.length} ${done ? 'away' : ''}`} ref={portraitPar}>
        {cast.map((id) => {
          const c = characters[id];
          const active = id === speakerId;
          return (
            <div key={id} className={`portrait ${active ? 'active' : ''} ${speakerId && !active ? 'dim' : ''} ${!speakerId ? 'idle' : ''}`}>
              <CharacterPortrait character={c} expression={active ? speakerExpr : (expressions[id] ?? 'neutral')} />
            </div>
          );
        })}
      </div>

      {settings.subtitles && scene.caption && (
        <div className="caption" role="status" aria-live="polite">
          {scene.caption}
        </div>
      )}

      {children}

      {!done && current && !cardOpen && (
        <DialoguePanel
          lineKey={`${sceneKey}:${index}`}
          line={current}
          character={current.speaker ? characters[current.speaker] : undefined}
          isLast={index + 1 >= lines.length}
          onAdvance={advance}
          onBack={back}
          onReplay={replay}
          canBack={index > 0}
        />
      )}

      {done && tail}

      {!done && !cardOpen && (
        <div className="scene-progress" aria-label={t('Line {n} of {m}', { n: index + 1, m: lines.length })}>
          {lines.map((_, i) => (
            <span key={i} className={i < index ? 'seen' : i === index ? 'now' : ''} />
          ))}
        </div>
      )}

      {cardOpen && scene.card && (
        <button type="button" className="title-card" onClick={() => setCardOpen(false)} aria-label={t('{title}. Press to begin.', { title: scene.card.title })}>
          <span className="card-title">{scene.card.title}</span>
          <span className="card-text">{scene.card.text}</span>
          <span className="card-meta">{scene.card.kicker}</span>
          <span className="card-hint">{t('Click or press Enter to begin')}</span>
        </button>
      )}
    </div>
  );
}
