import { useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { EvidenceItem } from '../../engine/types';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { InteractiveDocument } from './InteractiveDocument';

const KIND_LABEL: Record<EvidenceItem['kind'], string> = {
  document: 'Report',
  log: 'Record',
  message: 'Message',
  card: 'Statement',
  config: 'System detail',
};

/** The memory fragments of a scene: objects to pick up and inspect, not a menu of cards. */
export function EvidencePanel({
  items,
  opened,
  onOpen,
  title,
  footer,
}: {
  items: EvidenceItem[];
  opened: Set<string>;
  onOpen: (id: string) => void;
  title?: string;
  footer?: ReactNode;
}): ReactNode {
  const t = useT();
  const [active, setActive] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const activeItem = items.find((i) => i.id === active);
  const open = (id: string): void => {
    setFresh(!opened.has(id));
    onOpen(id);
    setActive(id);
  };

  return (
    <section className="fragments" aria-labelledby="fragments-title">
      <h2 id="fragments-title" className="fragments-title">{title ?? t('Memory fragments')}</h2>
      <p className="fragments-hint">{t('Open the items marked Required, then continue. The rest is optional and is saved to your Memory Archive.')}</p>
      <ul className="fragment-list">
        {items.map((it) => {
          const done = opened.has(it.id);
          return (
            <li key={it.id}>
              <button
                type="button"
                className={`fragment ${done ? 'found' : ''}`}
                data-kind={it.kind}
                onClick={() => open(it.id)}
                aria-label={`${it.label}${it.required ? ', ' + t('required') : ''}${done ? ', ' + t('inspected') : ''}`}
              >
                <span className="fragment-icon"><Icon name={it.kind as IconName} size={22} /></span>
                <span className="fragment-text">
                  <span className="fragment-label">{it.label}</span>
                  <span className="fragment-kind">{t(KIND_LABEL[it.kind])}</span>
                </span>
                <span className={`fragment-state ${!done && it.required ? 'req' : ''}`}>
                  {done ? <><Icon name="check" size={16} /> {t('Inspected')}</> : it.required ? t('Required') : t('Optional')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {opened.size > 0 && (
        <div className="notes">
          <h3 className="meta-label">{t('Your notes')}</h3>
          <ul>
            {items.filter((i) => opened.has(i.id)).map((i) => (
              <li key={i.id}><strong>{i.label}.</strong> {i.finding}</li>
            ))}
          </ul>
        </div>
      )}
      {footer}
      {activeItem && <InteractiveDocument item={activeItem} isNew={fresh} onClose={() => setActive(null)} />}
    </section>
  );
}
