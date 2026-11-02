import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { getStories } from '../../data';
import { useLang } from '../../i18n';
import { summarizePath } from '../../engine/narrativeEngine';
import type { EvidenceItem, InvestigationNode, Story } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import type { Route } from '../../app/routes';
import { InteractiveDocument } from '../investigation/InteractiveDocument';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { EndingsProgress } from '../endings/EndingsProgress';
import { Shell } from './Shell';

const itemsOf = (s: Story): EvidenceItem[] =>
  Object.values(s.nodes).filter((n): n is InvestigationNode => n.type === 'investigation').flatMap((n) => n.items);

export function MemoryArchive({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  const stories = getStories(useLang());
  const { progressOf } = useGame();
  const [tab, setTab] = useState<'fragments' | 'paths'>('fragments');
  const [open, setOpen] = useState<EvidenceItem | null>(null);
  const total = stories.reduce((n, s) => n + itemsOf(s).length, 0);
  const found = stories.reduce((n, s) => n + progressOf(s.id).fragments.filter((f) => itemsOf(s).some((i) => i.id === f)).length, 0);
  const anyPath = stories.some((s) => Object.keys(progressOf(s.id).completed).length > 0);

  return (
    <Shell go={go} title={t('Memory Archive')} bg="messaging" tone="memory">
      <div className="tabs" role="tablist" aria-label={t('Archive sections')}>
        <button type="button" role="tab" aria-selected={tab === 'fragments'} className={tab === 'fragments' ? 'on' : ''} onClick={() => setTab('fragments')}>
          {t('Fragments')} <span className="count">{found}/{total}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'paths'} className={tab === 'paths' ? 'on' : ''} onClick={() => setTab('paths')}>
          {t('Decision paths')}
        </button>
      </div>

      {tab === 'fragments' &&
        stories.map((s) => {
          const items = itemsOf(s);
          const mine = new Set(progressOf(s.id).fragments);
          return (
            <section key={s.id} className="archive-story" aria-labelledby={`arch-${s.id}`}>
              <h2 id={`arch-${s.id}`}>{s.title}</h2>
              <ul className="archive-fragments">
                {items.map((it) =>
                  mine.has(it.id) ? (
                    <li key={it.id}>
                      <button type="button" className="fragment found large" data-kind={it.kind} onClick={() => setOpen(it)}>
                        <span className="fragment-icon"><Icon name={it.kind as IconName} size={22} /></span>
                        <span className="fragment-text">
                          <span className="fragment-label">{it.label}</span>
                          <span className="fragment-finding">{it.finding}</span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={it.id} className="fragment locked" aria-label={t('Undiscovered fragment')}>
                      <span className="fragment-icon"><Icon name="lock" size={20} /></span>
                      <span className="fragment-text">
                        <span className="fragment-label">{t('Undiscovered')}</span>
                        <span className="fragment-finding">{t('Found while investigating: {story}', { story: s.title })}</span>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          );
        })}

      {tab === 'paths' && (
        <>
          <div className="endings-grid">
            {stories.map((s) => <EndingsProgress key={s.id} story={s} found={new Set(Object.values(progressOf(s.id).completed).map((r) => r.endingId))} />)}
          </div>
          {!anyPath && (
            <div className="empty">
              <p>{t('No path recorded yet. Finish a story and the choices you made will be kept here, with their decision map.')}</p>
              <button type="button" className="cta" onClick={() => go({ name: 'stories' })}>{t('Choose a story')}</button>
            </div>
          )}
          {stories.map((s) => {
            const runs = Object.values(progressOf(s.id).completed).sort((a, b) => b.completedAt - a.completedAt);
            if (!runs.length) return null;
            return (
              <section key={s.id} className="archive-story" aria-labelledby={`path-${s.id}`}>
                <h2 id={`path-${s.id}`}>{s.title} <small>{t('{n} of {m} endings', { n: new Set(runs.map((r) => r.endingId)).size, m: Object.keys(s.endings).length })}</small></h2>
                <ul className="archive-list">
                  {runs.map((r) => {
                    const key = r.history.map((h) => h.choiceId).join('.');
                    return (
                      <li key={key} className="archive-run">
                        <div>
                          <p className="archive-ending">{s.endings[r.endingId].title} <span className="muted">{r.endingId}</span></p>
                          <p className="archive-path">{summarizePath(s, r.history).map((i) => i.choice.mapLabel).join('  →  ')}</p>
                          <p className="muted small">{r.completedAt ? new Date(r.completedAt).toLocaleString() : ''}</p>
                        </div>
                        <div className="archive-actions">
                          <button type="button" className="chip-btn" onClick={() => go({ name: 'map', storyId: s.id, run: key })}><Icon name="branch" size={16} /> {t('Decision map')}</button>
                          <button type="button" className="chip-btn" onClick={() => go({ name: 'analysis', storyId: s.id, run: key })}><Icon name="mind" size={16} /> {t('Analysis')}</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}
      {open && <InteractiveDocument item={open} onClose={() => setOpen(null)} />}
    </Shell>
  );
}
