import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { StepsInteraction } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import { useAudio } from '../../hooks/useAudio';
import { Icon } from '../ui/Icon';

export function ConsoleSteps({ config, onDone }: { config: StepsInteraction; onDone: () => void }): ReactNode {
  const t = useT();
  const { settings } = useGame();
  const { play } = useAudio();
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const next = config.steps.find((s) => !done.includes(s.id));
  const run = (id: string): void => {
    const step = config.steps.find((s) => s.id === id);
    if (!step || busy) return;
    setBusy(true);
    const gap = settings.reducedMotion ? 40 : 380;
    step.output.forEach((l, i) => {
      timers.current.push(window.setTimeout(() => { setOut((p) => [...p, l]); play('click'); }, gap * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setOut((p) => [...p, '']);
        setDone((p) => [...p, id]);
        setBusy(false);
        play('success');
        if (config.steps.every((s) => s.id === id || done.includes(s.id))) timers.current.push(window.setTimeout(onDone, 400));
      }, gap * (step.output.length + 1)),
    );
  };

  return (
    <div className="lab">
      <header className="chat-head"><span className="chat-app">{config.title}</span><span className="chat-channel">{done.length}/{config.steps.length} complete</span></header>
      <ol className="steps">
        {config.steps.map((s, i) => {
          const isDone = done.includes(s.id);
          const isNext = next?.id === s.id;
          return (
            <li key={s.id} className={`step ${isDone ? 'done' : ''} ${isNext ? 'next' : ''}`}>
              <span className="step-label">{isDone && <Icon name="check" size={16} />}{s.label}</span>
              <button type="button" className="cta small" disabled={!isNext || busy} onClick={() => run(s.id)} data-testid={`step-${i}`}>
                {s.button}
              </button>
            </li>
          );
        })}
      </ol>
      <pre className="terminal" aria-live="polite" aria-label={t('Console output')}>
        {out.length === 0 ? <span className="muted">{t('Run the steps in order.')}</span> : out.map((l, i) => <span key={i} className="term-line">{l ? `${l}\n` : '\n'}</span>)}
        {done.length === config.steps.length && <span className="term-result">{config.doneText}</span>}
      </pre>
    </div>
  );
}
