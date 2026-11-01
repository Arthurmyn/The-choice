import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { Character, Line } from '../../engine/types';
import { useState } from 'react';
import { useGame } from '../../hooks/useGameState';
import { Icon } from '../ui/Icon';
import { useTypewriter } from './useTypewriter';

export function DialoguePanel({
  line,
  character,
  isLast,
  onAdvance,
  onBack,
  onReplay,
  canBack,
  lineKey,
}: {
  line: Line;
  character?: Character;
  isLast: boolean;
  onAdvance: () => void;
  onBack: () => void;
  onReplay: () => void;
  canBack: boolean;
  lineKey: string;
}): ReactNode {
  const t = useT();
  const { settings } = useGame();
  const animate = settings.typewriter && !settings.reducedMotion;
  const { shown, done, finish } = useTypewriter(line.text, animate, 110);
  const [hint] = useState(() => {
    try {
      return Number(localStorage.getItem('echo:advances') ?? 0) < 5;
    } catch {
      return false;
    }
  });

  const click = (): void => {
    if (!done) finish();
    else {
      try {
        localStorage.setItem('echo:advances', String(Number(localStorage.getItem('echo:advances') ?? 0) + 1));
      } catch {
        /* ignore */
      }
      onAdvance();
    }
  };

  return (
    <div className="dialogue" data-testid="dialogue" onClick={click} key={lineKey}>
      <div className="dialogue-plate">
        {character ? (
          <>
            <span className="dialogue-name">{character.name}</span>
            <span className="dialogue-role">{character.role}</span>
            {line.expression && line.expression !== 'neutral' && <span className="dialogue-expr">{line.expression}</span>}
          </>
        ) : (
          <span className="dialogue-name narrator">{t('Narration')}</span>
        )}
      </div>
      <p className={`dialogue-text ${character ? '' : 'narration'}`}>
        <span className="sr-only">{line.text}</span>
        <span aria-hidden="true">{shown}</span>
        <span aria-hidden="true" className="dialogue-ghost">{line.text.slice(shown.length)}</span>
      </p>
      <div className="dialogue-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" onClick={onBack} disabled={!canBack} aria-label={t('Previous line')}>
          <Icon name="back" />
        </button>
        {settings.voiceOn && !settings.muted && (
          <button type="button" className="icon-btn" onClick={onReplay} aria-label={t('Replay voice')}>
            <Icon name="volume" />
          </button>
        )}
        <button type="button" className="next-btn" onClick={click} data-testid="next-line" aria-label={isLast ? t('Continue') : t('Next line')}>
          {hint && <span className="key-hint">{t('Space or click')}</span>}
          <span>{isLast ? t('Continue') : t('Next')}</span>
          <Icon name="next" size={18} />
        </button>
      </div>
    </div>
  );
}
