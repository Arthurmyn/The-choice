import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { Route } from '../../app/routes';
import { resolveEnding } from '../../engine/endingResolver';
import { pathKey } from '../../engine/narrativeEngine';
import type { DecisionRecord, SceneContent, Story } from '../../engine/types';
import { ScenePlayer } from '../cinematic/ScenePlayer';
import { StorySummary } from './StorySummary';
import { Icon } from '../ui/Icon';

export function EndingScreen({
  story,
  history,
  line,
  onLine,
  go,
  onRestart,
}: {
  story: Story;
  history: readonly DecisionRecord[];
  line: number;
  onLine: (i: number) => void;
  go: (r: Route) => void;
  onRestart: () => void;
}): ReactNode {
  const t = useT();
  const resolved = useMemo(() => resolveEnding(story, history), [story, history]);
  if (!resolved) return null;
  const { ending, lines, fragments, consequences } = resolved;
  const run = pathKey(history);
  const scene: SceneContent = { ...ending.scene, card: { kicker: `${t('Ending')} ${ending.id}`, title: ending.title, text: ending.subtitle } };

  const summary = (
    <div className="overlay-center top-aligned">
      <article className="ending-summary" data-testid="ending-summary" aria-labelledby="ending-title">
        <h2 id="ending-title" className="ending-title">{ending.title}</h2>
        <p className="muted ending-sub">{ending.subtitle}</p>
        <p className="ending-result">{ending.result}</p>

        <div className="ending-cols">
          <section>
            <h3 className="meta-label">{t('How your decisions shaped this')}</h3>
            <ul className="plain">{fragments.map((f) => <li key={f}>{f}</li>)}</ul>
            <h3 className="meta-label">{t('Consequences')}</h3>
            <ul className="plain">{consequences.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
          <section>
            <h3 className="meta-label">{t('Your decisions')}</h3>
            <StorySummary story={story} history={history} />
          </section>
        </div>

        <p className="unresolved"><strong>{t('Unresolved')}:</strong> {ending.unresolved}</p>
        <p className="disclaimer">{story.disclaimer}</p>

        <div className="ending-actions">
          <button type="button" className="cta" onClick={() => go({ name: 'analysis', storyId: story.id, run })} data-testid="open-analysis"><Icon name="mind" size={18} /> {t('Philosophical analysis')}</button>
          <button type="button" className="chip-btn" onClick={() => go({ name: 'map', storyId: story.id, run })} data-testid="open-map"><Icon name="branch" size={16} /> {t('Decision map')}</button>
          <button type="button" className="chip-btn" onClick={onRestart} data-testid="play-another-ending"><Icon name="restart" size={16} /> {t('Play another path')}</button>
          <button type="button" className="chip-btn" onClick={() => go({ name: 'menu' })}>{t('Menu')}</button>
        </div>
      </article>
    </div>
  );

  return (
    <ScenePlayer
      sceneKey={`${story.id}:ending`}
      scene={scene}
      lines={lines}
      characters={story.characters}
      index={line}
      onIndexChange={onLine}
      tail={summary}
    />
  );
}
