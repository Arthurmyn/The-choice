import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { EvidenceItem } from '../../engine/types';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

/** Viewer for one fragment. Each kind of evidence gets its own surface. */
export function InteractiveDocument({ item, onClose, isNew = false }: { item: EvidenceItem; onClose: () => void; isNew?: boolean }): ReactNode {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      restore.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="viewer" data-kind={item.kind} role="dialog" aria-modal="true" aria-labelledby="doc-title" onClick={(e) => e.stopPropagation()}>
        <header className="viewer-head">
          <span className="viewer-icon"><Icon name={item.kind as IconName} size={24} /></span>
          <h3 id="doc-title">{item.title}</h3>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label={t('Close {name}', { name: item.label })}>
            <Icon name="close" />
          </button>
        </header>
        <div className={`viewer-body ${item.mono ? 'mono' : ''}`}>
          {item.rows && (
            <table className="doc-table">
              <tbody>
                {item.rows.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {item.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className={`finding ${isNew ? 'reveal' : ''}`}>
          <span className="meta-label memory">{t('Key finding')}</span>
          <p>{item.finding}</p>
        </div>
        {isNew && <p className="archived"><Icon name="archive" size={16} /> {t('Added to the Memory Archive')}</p>}
      </div>
    </div>
  );
}
