import type { ReactNode } from 'react';
import type { Story } from '../../engine/types';
import { indicatorValue, levelOf, trendOf } from '../../engine/indicators';
import { useT } from '../../i18n';
import { Icon } from './Icon';

/**
 * Four qualitative indicators as words with a small arrow for the last decision.
 * Never a number and never a total: the bar says how things stand, not how the player is doing.
 */
export function IndicatorBar({ story, flags, before }: { story: Story; flags: Record<string, string>; before: Record<string, string> | null }): ReactNode {
  const t = useT();
  const list = story.indicators ?? [];
  if (!list.length) return null;
  return (
    <ul className="indicators" aria-label={t('How the group stands')} data-testid="indicators">
      {list.map((ind) => {
        const level = levelOf(indicatorValue(flags[ind.key]));
        const trend = before ? trendOf(indicatorValue(before[ind.key]), indicatorValue(flags[ind.key])) : 'same';
        const trendText = trend === 'up' ? t('rising') : trend === 'down' ? t('falling') : t('unchanged');
        return (
          <li key={ind.key} className={`ind ${level.toLowerCase()}`} aria-label={`${ind.label}: ${t(level)}, ${trendText}`} data-testid={`ind-${ind.key.slice(1)}`}>
            <span className="ind-label">{ind.label}</span>
            <b className="ind-level">{t(level)}</b>
            <span className={`ind-trend ${trend}`} aria-hidden="true">
              <Icon name={trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'steady'} size={14} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
