import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Story } from '../../engine/types';
import { useT } from '../../i18n';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** Shared supplies, shown as plain counts. Trust and suspicion are never shown. */
export function ResourceBar({ story, flags }: { story: Story; flags: Record<string, string> }): ReactNode {
  const t = useT();
  const list = story.resources ?? [];
  const prev = useRef<Record<string, number>>({});
  const [delta, setDelta] = useState<Record<string, number>>({});

  useEffect(() => {
    const d: Record<string, number> = {};
    for (const r of list) {
      const v = Number(flags[r.key] ?? 0);
      if (prev.current[r.key] !== undefined && prev.current[r.key] !== v) d[r.key] = v - prev.current[r.key];
      prev.current[r.key] = v;
    }
    if (Object.keys(d).length) {
      setDelta(d);
      const id = window.setTimeout(() => setDelta({}), 2200);
      return () => window.clearTimeout(id);
    }
  }, [flags, list]);

  if (!list.length) return null;
  return (
    <ul className="resources" aria-label={t('Supplies')}>
      {list.map((r) => {
        const v = Number(flags[r.key] ?? 0);
        const d = delta[r.key];
        return (
          <li key={r.key} className={`res ${v <= 1 ? 'low' : ''}`} aria-label={`${r.label}: ${v}`} title={r.label}>
            <Icon name={r.icon as IconName} size={16} />
            <b>{v}</b>
            {d ? <i className={`res-delta ${d < 0 ? 'down' : 'up'}`} aria-hidden="true">{d > 0 ? `+${d}` : d}</i> : null}
          </li>
        );
      })}
    </ul>
  );
}
