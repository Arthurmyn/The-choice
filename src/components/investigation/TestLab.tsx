import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { TestLabInteraction } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import { useAudio } from '../../hooks/useAudio';

export function TestLab({ config, onDone }: { config: TestLabInteraction; onDone: () => void }): ReactNode {
  const t = useT();
  const { settings } = useGame();
  const { play } = useAudio();
  const [requester, setRequester] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<'confirmed' | 'same-org' | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const acc = (id: string | null) => config.accounts.find((a) => a.id === id);
  const label = (id: string | null): string => {
    const a = acc(id);
    return a ? `${a.org} / ${a.label}` : '';
  };

  const run = (): void => {
    const a = acc(requester);
    const b = acc(owner);
    if (!a || !b || running) return;
    setRunning(true);
    setOutcome(null);
    setLines([]);
    const sameOrg = a.org === b.org;
    const script = sameOrg
      ? [t('session opened as {a}', { a: label(requester) }), t('GET /docs/view/4821 → 200 OK (own organization)'), t('target {b} belongs to the same organization', { b: label(owner) }), t('Access is expected here. This does not test isolation between organizations.')]
      : config.log.map((l) => l.replace('{a}', label(requester)).replace('{b}', label(owner)));
    const step = settings.reducedMotion ? 60 : 480;
    script.forEach((l, i) => {
      timers.current.push(window.setTimeout(() => { setLines((prev) => [...prev, l]); play('click'); }, step * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setRunning(false);
        if (sameOrg) {
          setOutcome('same-org');
          play('error');
        } else {
          setOutcome('confirmed');
          play('success');
          timers.current.push(window.setTimeout(onDone, 500));
        }
      }, step * (script.length + 1)),
    );
  };

  const radio = (name: string, value: string | null, set: (v: string) => void): ReactNode => (
    <fieldset className="lab-field" disabled={running}>
      <legend>{name}</legend>
      <div className="lab-options" role="radiogroup" aria-label={name}>
        {config.accounts.map((a) => (
          <label key={a.id} className={`lab-option ${value === a.id ? 'on' : ''}`}>
            <input type="radio" name={name} checked={value === a.id} onChange={() => set(a.id)} />
            <span className="lab-org">{a.org}</span>
            <span className="lab-user">{a.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const resultText = config.resultText.replace('{a}', label(requester)).replace('{b}', label(owner));
  return (
    <div className="lab">
      <header className="chat-head"><span className="chat-app">{config.title}</span><span className="chat-channel">{t('Synthetic data only')}</span></header>
      <div className="lab-grid">
        {radio(t('Sign in as'), requester, setRequester)}
        {radio(t('Request a document owned by'), owner, setOwner)}
      </div>
      <div className="lab-run">
        <button type="button" className="cta" disabled={!requester || !owner || running || outcome === 'confirmed'} onClick={run} data-testid="run-test">
          {running ? t('Running…') : t('Run test')}
        </button>
        <div className="progress-bar" aria-hidden="true"><span style={{ width: running ? '100%' : outcome ? '100%' : '0%' }} className={running ? 'running' : ''} /></div>
      </div>
      <pre className="terminal" aria-live="polite" aria-label={t('Test output')}>
        {lines.length === 0 ? <span className="muted">{t('Choose two accounts from different organizations, then run the test.')}</span> : lines.map((l, i) => <span key={i} className="term-line">{`> ${l}\n`}</span>)}
        {outcome === 'confirmed' && <span className="term-result">{resultText}</span>}
      </pre>
    </div>
  );
}
