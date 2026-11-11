import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import type { KeyboardEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { getStories, storyById } from '../../data';
import { useLang } from '../../i18n';
import { hasActiveRun } from '../../engine/progressManager';
import { useGame } from '../../hooks/useGameState';
import { audio, useAudio } from '../../hooks/useAudio';
import type { Route } from '../../app/routes';
import { SceneBackground } from '../cinematic/SceneBackground';

/** Concentric rings radiating from a point of light: the game's signature. */
function EchoRings(): ReactNode {
  return (
    <div className="echo" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className="echo-ring" style={{ ['--d' as string]: `${i * 1.7}s` }} />
      ))}
      <i className="echo-core" />
    </div>
  );
}

export function MainMenu({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  const lang = useLang();
  const { lastStoryId, progressOf, storageWarning, recoveredStories, settings, updateSettings } = useGame();
  const { setAmbient } = useAudio();
  const list = useRef<HTMLUListElement>(null);
  const still = settings.reducedMotion;
  const last = lastStoryId ? storyById(lastStoryId, lang) : undefined;
  const all = getStories(lang);
  const total = all.reduce((n, s) => n + Object.keys(s.endings).length, 0);
  const foundCount = all.reduce((n, s) => n + new Set(Object.values(progressOf(s.id).completed).map((r) => r.endingId)).size, 0);
  const canContinue = !!last && hasActiveRun(progressOf(last.id));

  useEffect(() => {
    setAmbient('city');
  }, [setAmbient]);

  const items: { label: string; hint: string; onClick: () => void; disabled?: boolean; id: string }[] = [
    { id: 'continue', label: t('Continue'), hint: canContinue && last ? last.title : t('No saved session'), onClick: () => last && go({ name: 'play', storyId: last.id }), disabled: !canContinue },
    { id: 'new', label: t('New Experience'), hint: t('Begin a story'), onClick: () => go({ name: 'stories' }) },
    { id: 'stories', label: t('Stories'), hint: t('{n} of {m} endings', { n: foundCount, m: total }), onClick: () => go({ name: 'stories' }) },
    { id: 'archive', label: t('Memory Archive'), hint: t('Fragments and paths'), onClick: () => go({ name: 'archive' }) },
    { id: 'settings', label: t('Settings'), hint: t('Sound, text, motion'), onClick: () => go({ name: 'settings' }) },
    { id: 'about', label: t('About'), hint: t('The idea and sources'), onClick: () => go({ name: 'about' }) },
  ];

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const btns = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="menu" onPointerDown={() => audio.unlock()}>
      <SceneBackground id="city-night" className="cam" />
      <EchoRings />
      <div className="scene-vignette strong" aria-hidden="true" />
      {(storageWarning || recoveredStories.length > 0) && (
        <div className="banner warn" role="alert">
          {storageWarning ?? t('A saved game was unreadable and has been reset. A backup copy was kept in your browser storage.')}
        </div>
      )}
      <main className="menu-inner">
        <motion.header
          initial={still ? false : { opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.4, ease: [0.23, 1, 0.32, 1] }}
          className="menu-title"
        >
          <h1 aria-label="ECHO">ECHO</h1>
          <p className="menu-sub">{t('The Ethics of Survival')}</p>
          <p className="tagline">{t('Your choices leave a trace.')}</p>
        </motion.header>
        <nav aria-label={t('Main menu')}>
          <ul className="menu-list" ref={list} onKeyDown={onKey}>
            {items.map((it, i) => (
              <motion.li
                key={it.id}
                initial={still ? false : { opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: still ? 0 : 0.7 + i * 0.07, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              >
                <button type="button" className="menu-item" onClick={() => { audio.unlock(); it.onClick(); }} disabled={it.disabled} data-testid={`menu-${it.id}`}>
                  <i className="corner tl" aria-hidden="true" />
                  <i className="corner br" aria-hidden="true" />
                  <span className="menu-item-label">{it.label}</span>
                  <span className="menu-item-hint">{it.hint}</span>
                </button>
              </motion.li>
            ))}
          </ul>
        </nav>
      </main>
      <footer className="menu-foot">
        <p>{t('Fictional scenarios. Consequences are simulated for philosophical discussion.')}</p>
        <div className="lang-switch" role="group" aria-label={t('Language')}>
          {(['en', 'ru'] as const).map((l) => (
            <button key={l} type="button" className={settings.lang === l ? 'on' : ''} aria-pressed={settings.lang === l} onClick={() => updateSettings({ lang: l })}>{l.toUpperCase()}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}
