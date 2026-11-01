import type { ReactNode } from 'react';
import { summarizePath } from '../../engine/narrativeEngine';
import type { DecisionRecord, Story } from '../../engine/types';

export function StorySummary({ story, history }: { story: Story; history: readonly DecisionRecord[] }): ReactNode {
  const items = summarizePath(story, history);
  return (
    <ol className="summary-list" aria-label="Summary of your decisions">
      {items.map((it) => (
        <li key={it.nodeId}>
          <span className="summary-stage">{it.stage}</span>
          <span className="summary-body">
            <span className="summary-title">{it.title}</span>
            <span className="summary-choice">{it.choice.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
