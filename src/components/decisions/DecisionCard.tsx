import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { Choice } from '../../engine/types';

/** A large choice panel. Selection is shown with corner brackets, never with good/bad colour. */
export function DecisionCard({
  choice,
  index,
  selected,
  dimmed,
  onSelect,
  disabled,
}: {
  choice: Choice;
  index: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  disabled?: boolean;
}): ReactNode {
  const t = useT();
  return (
    <button
      type="button"
      className={`decision-card ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
      data-testid={`choice-${choice.id}`}
    >
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
      <span className="decision-card-key" aria-hidden="true">{index + 1}</span>
      <span className="decision-card-label">{choice.label}</span>
      <span className="decision-card-desc">{choice.description}</span>
      {choice.preview && (
        <span className="decision-card-preview">
          <span className="meta-label">{t('Action')}</span>
          {choice.preview}
        </span>
      )}
    </button>
  );
}
