import type { ReactNode } from 'react';
import { deriveState } from '../../engine/narrativeEngine';
import { disclosure, indicatorValue, levelOf } from '../../engine/indicators';
import type { DecisionRecord, Story } from '../../engine/types';
import { useT } from '../../i18n';

/**
 * "How the system worked": every decision you made and what it did to the four indicators.
 * Shown so the model is open to inspection. It adds nothing up and ranks nothing.
 */
export function SystemPanel({ story, history }: { story: Story; history: readonly DecisionRecord[] }): ReactNode {
  const t = useT();
  const inds = story.indicators ?? [];
  if (!inds.length) return null;
  const rows = disclosure(story, history);
  const final = deriveState(story, history).flags;
  return (
    <section className="system-panel" aria-labelledby="system-title" data-testid="system-panel">
      <h3 id="system-title" className="meta-label">{t('How the system worked')}</h3>
      <p className="muted small">{t('Each option moves the indicators by a fixed amount, listed here. No option improves all four, and nothing is added up.')}</p>
      <ol className="system-list">
        {rows.map((r) => (
          <li key={r.nodeId} data-testid={`system-${r.nodeId}`}>
            <span className="summary-stage">{r.stage}</span>
            <span className="system-body">
              <span className="system-choice">{r.choice}</span>
              <span className="system-effects">
                {r.effects.map((e) => (
                  <span key={e.key} className={`eff ${e.delta > 0 ? 'up' : 'down'}`}>{e.label} {e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="system-final">
        <span className="meta-label">{t('Where the group ended')}</span>
        {inds.map((i) => <span key={i.key} className="eff">{i.label}: {t(levelOf(indicatorValue(final[i.key])))}</span>)}
      </p>
    </section>
  );
}
