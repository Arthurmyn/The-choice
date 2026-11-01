import { useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { CalendarInteraction } from '../../engine/types';

export function CalendarInterface({ config, onDone }: { config: CalendarInteraction; onDone: () => void }): ReactNode {
  const t = useT();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const complete = config.findings.every((f) => open.has(f.entryId));

  const select = (id: string): void => {
    const next = new Set(open).add(id);
    setOpen(next);
    setActive(id);
    if (config.findings.every((f) => next.has(f.entryId))) window.setTimeout(onDone, 300);
  };

  const activeEntry = config.entries.find((e) => e.id === active);
  return (
    <div className="calendar">
      <header className="chat-head">
        <span className="chat-app">{t('Open Table · Calendar')}</span>
        <span className="chat-channel">{config.title}</span>
      </header>
      <div className="calendar-body">
        <ol className="history" aria-label={t('Edit history')}>
          {config.entries.map((e) => (
            <li key={e.id}>
              <button type="button" className={`history-entry ${open.has(e.id) ? 'seen' : ''} ${active === e.id ? 'active' : ''}`} onClick={() => select(e.id)} aria-pressed={active === e.id}>
                <span className="history-time">{e.day}</span>
                <span className="history-title">{e.title}</span>
                <span className="history-who">{e.assignee}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="history-detail" aria-live="polite">
          {activeEntry ? (
            <>
              <h4>{activeEntry.title}</h4>
              <p className="muted">{activeEntry.time} · {activeEntry.assignee}</p>
              <p>{activeEntry.note}</p>
              <p className="finding-inline">{config.findings.find((f) => f.entryId === activeEntry.id)?.text}</p>
            </>
          ) : (
            <p className="muted">{t('Open each entry in the history to see what actually happened.')}</p>
          )}
        </div>
      </div>
      <footer className="calendar-foot">
        <span>{t('Findings')} {config.findings.filter((f) => open.has(f.entryId)).length}/{config.findings.length}</span>
        {complete && <strong>{config.doneText}</strong>}
      </footer>
    </div>
  );
}
