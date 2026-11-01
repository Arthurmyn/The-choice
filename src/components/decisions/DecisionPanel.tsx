import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Character, DecisionNode } from '../../engine/types';
import { MessageInterface } from '../investigation/MessageInterface';
import { SceneBackground } from '../cinematic/SceneBackground';
import { useAudio } from '../../hooks/useAudio';
import { useGame } from '../../hooks/useGameState';
import { Icon } from '../ui/Icon';
import { DecisionCard } from './DecisionCard';

export function DecisionPanel({
  node,
  flags,
  characters,
  onConfirm,
  onOpenEvidence,
  hasEvidence,
}: {
  node: DecisionNode;
  flags: Record<string, string>;
  characters: Record<string, Character>;
  onConfirm: (choiceId: string) => void;
  onOpenEvidence?: () => void;
  hasEvidence: boolean;
}): ReactNode {
  const t = useT();
  const { play, setAmbient } = useAudio();
  const { settings } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submitRef = useRef<() => void>(() => undefined);
  const still = settings.reducedMotion;

  useEffect(() => setAmbient('digital'), [setAmbient]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, summary, details')) return;
      if (e.key === 'Enter' && selected && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        submitRef.current();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= node.choices.length) {
        setSelected(node.choices[n - 1].id);
        play('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node.choices, play, selected]);

  const submit = (): void => {
    if (!selected || lock.current) return; // prevents duplicate submissions
    lock.current = true;
    setBusy(true);
    play('confirm');
    onConfirm(selected);
  };

  submitRef.current = submit;

  return (
    <div className="decision-screen calm" data-testid="decision-screen">
      <SceneBackground id={node.background} className="blur" />
      <div className="scene-vignette strong" aria-hidden="true" />
      <div className="decision-scroll">
        <div className="decision-stack">
          <motion.header
            className="decision-head"
            initial={still ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="sr-only">{t('Decision {n} of 3', { n: node.stage.replace('D', '') })}</p>
            <h2 className="decision-title">{node.title}</h2>
            <p className="decision-situation">{node.situation}</p>
          </motion.header>

          <section className="decision-options" aria-label={t('Your options')}>
            <div className={`cards count-${node.choices.length}`}>
              {node.choices.map((c, i) => (
                <motion.div
                  key={c.id}
                  className="card-slot"
                  initial={still ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: still ? 0 : 0.35 + i * 0.09 }}
                >
                  <DecisionCard
                    choice={c}
                    index={i}
                    selected={selected === c.id}
                    dimmed={!!selected && selected !== c.id}
                    onSelect={() => { setSelected(c.id); play('select'); }}
                    disabled={busy}
                  />
                </motion.div>
              ))}
            </div>
          </section>

          <div className="decision-confirm">
            <button type="button" className="cta" disabled={!selected || busy} onClick={submit} data-testid="confirm-button">
              {selected ? t('Confirm this decision') : t('Pick one of the options')}
            </button>
            <p className="muted small">{selected ? t('It is saved at once and cannot be changed in this playthrough.') : t('Click an option, or press 1–{n}.', { n: node.choices.length })}</p>
          </div>

          <details className="decision-more">
            <summary>{node.context ? t('Context, messages and evidence') : t('Context and evidence')}</summary>
            <div className="decision-more-body">
              <div className="decision-context">
                <h3 className="meta-label">{t('Available information')}</h3>
                <ul>{node.info.map((i) => <li key={i}>{i}</li>)}</ul>
                {hasEvidence && (
                  <button type="button" className="chip-btn memory" onClick={onOpenEvidence}>
                    <Icon name="fragment" size={16} /> {t('Memory fragments')}
                  </button>
                )}
              </div>
              {node.context && <MessageInterface chat={node.context} flags={flags} characters={characters} compact />}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
