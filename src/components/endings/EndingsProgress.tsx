import type { ReactNode } from 'react';
import type { Story } from '../../engine/types';
import { useT } from '../../i18n';
import { Icon } from '../ui/Icon';

/**
 * Which endings of a story have been found. Undiscovered endings stay unnamed,
 * so the list shows how much is left without spoiling it.
 */
export function EndingsProgress({ story, found, current }: { story: Story; found: ReadonlySet<string>; current?: string }): ReactNode {
  const t = useT();
  const all = Object.values(story.endings);
  return (
    <section className="endings-progress" aria-label={t('Endings found')}>
      <h3 className="meta-label">
        {t('Endings found')} <span className="count">{found.size}/{all.length}</span>
      </h3>
      <ul>
        {all.map((e, i) => {
          const has = found.has(e.id);
          return (
            <li key={e.id} className={`${has ? 'found' : 'locked'} ${current === e.id ? 'now' : ''}`}>
              <Icon name={has ? 'check' : 'lock'} size={14} />
              <span>{has ? e.title : `${t('Ending')} ${i + 1}`}</span>
              {current === e.id && <em>{t('this run')}</em>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
