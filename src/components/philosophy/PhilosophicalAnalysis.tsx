import { useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import { getPhilosophy, getStories } from '../../data';
import { useLang } from '../../i18n';
import type { PhilosopherId } from '../../data';
import { resolveEnding } from '../../engine/endingResolver';
import { pathKey } from '../../engine/narrativeEngine';
import { useGame } from '../../hooks/useGameState';
import type { Route } from '../../app/routes';
import { Shell } from '../navigation/Shell';
import { resolveRun } from '../flowchart/MapScreen';
import { StorySummary } from '../endings/StorySummary';
import { Icon } from '../ui/Icon';
import { AnalysisSection } from './AnalysisSection';
import { PhilosopherPortrait } from './PhilosopherPortrait';

export function PhilosophicalAnalysis({ storyId, run, go }: { storyId: string; run: string; go: (r: Route) => void }): ReactNode {
  const t = useT();
  const lang = useLang();
  const philosophyMeta = getPhilosophy(lang);
  const story = getStories(lang).find((s) => s.id === storyId);
  const { progressOf, restartStory } = useGame();
  const [active, setActive] = useState<PhilosopherId | null>(null);
  if (!story) return <Shell go={go} title={t('Not found')}><p>{t('That story does not exist.')}</p></Shell>;
  const played = resolveRun(story, run, progressOf(story.id).completed);
  if (!played) {
    return (
      <Shell go={go} title={t('Philosophical analysis')} bg={story.tone}>
        <p>{t('Finish {story} to receive an analysis connected to your decisions.', { story: story.title })}</p>
        <button type="button" className="cta" onClick={() => go({ name: 'play', storyId: story.id })}>{t('Play story')}</button>
      </Shell>
    );
  }
  const resolved = resolveEnding(story, played.history)!;
  const ending = resolved.ending;
  const runKey = pathKey(played.history);
  // Only the decisions on the path that was played, so a branch not taken adds nothing here.
  const playedIds = new Set(played.history.map((h) => h.nodeId));
  const pressures = Object.values(story.nodes).flatMap((n) => (n.type === 'decision' && playedIds.has(n.id) ? [{ stage: n.stage, list: n.pressures }] : []));
  // Tabs follow the story's own analysis, in the order of the philosophy file.
  const order = story ? philosophyMeta.order.filter((id) => id in story.analysis) : [];
  const current = active && order.includes(active) ? active : order[0];
  const onTabKey = (e: React.KeyboardEvent): void => {
    const i = order.indexOf(current);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setActive(order[(i + 1) % order.length]);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setActive(order[(i + order.length - 1) % order.length]);
    else return;
    e.preventDefault();
  };

  return (
    <Shell go={go} title={t('Philosophical analysis')} bg={story.tone} back={{ label: t('Decision map'), route: { name: 'map', storyId: story.id, run: runKey } }}>
      <div className="analysis">
        <section className="trace" aria-labelledby="trace-title">
          <h2 id="trace-title" className="trace-title">{story.title}<span className="trace-ending">{ending.title}</span></h2>
          <div className="trace-grid">
            <div>
              <h3 className="meta-label">{t('Your decisions')}</h3>
              <StorySummary story={story} history={played.history} />
            </div>
            <div>
              <h3 className="meta-label">{t('What followed')}</h3>
              <ul className="plain">{resolved.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
          <p className="fineprint">{philosophyMeta.note}</p>
        </section>

        <section className="phil" aria-label={t('Philosophical perspectives')}>
          <div className="phil-rail" role="tablist" aria-label={t('Philosophers')} aria-orientation="vertical" onKeyDown={onTabKey}>
            {order.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={current === id}
                aria-controls={`analysis-${id}`}
                tabIndex={current === id ? 0 : -1}
                className={`phil-tab ${current === id ? 'on' : ''}`}
                onClick={() => setActive(id)}
              >
                <span className="phil-thumb"><PhilosopherPortrait id={id} /></span>
                <span className="phil-tab-text">
                  <span className="phil-tab-name">{philosophyMeta.philosophers[id].name.split(' ').slice(-1)[0]}</span>
                  <span className="phil-tab-role">{philosophyMeta.philosophers[id].section.charAt(0) + philosophyMeta.philosophers[id].section.slice(1).toLowerCase()}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="phil-stage">
            {order.map((id) => (
              <AnalysisSection key={id} id={id} story={story} endingId={played.endingId} flags={resolved.flags} active={current === id} />
            ))}
          </div>
        </section>

        {story.lenses && (
          <section className="lenses" aria-labelledby="lenses-title" data-testid="lenses">
            <h2 id="lenses-title" className="meta-label">{story.lenses.title}</h2>
            <p>{story.lenses.text}</p>
          </section>
        )}

        <section className="reflect" aria-labelledby="reflect-title">
          <div>
            <h2 id="reflect-title" className="reflect-title">{t('Where the principles collide')}</h2>
            <p className="reflect-text">{story.reflection.conflicts[played.endingId]}</p>
            <p className="reflect-text muted">{t('No theory here is offered as the correct answer. Each one names something a decision can fail to honour.')}</p>
          </div>
          <div>
            <h3 className="meta-label">{t('Questions for you')}</h3>
            <ol className="questions">{story.reflection.questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </div>
        </section>

        {story.context && (
          <aside className="context-card" aria-labelledby="context-title" data-testid="context-card">
            <h2 id="context-title" className="meta-label">{story.context.title}</h2>
            <p>{story.context.text}</p>
            <p className="source"><span className="meta-label">{t('Source')}</span> {story.context.source}.</p>
          </aside>
        )}

        <section className="central" aria-label={t('The central question')}>
          <p className="central-q">{philosophyMeta.centralQuestion}</p>
          <ul className="pressure-list">
            {pressures.map((p) => (
              <li key={p.stage}><span className="frag-label">{p.stage}</span><span>{p.list.join(' · ')}</span></li>
            ))}
          </ul>
        </section>

        <div className="action-row">
          <button type="button" className="cta" onClick={() => go({ name: 'map', storyId: story.id, run: runKey })}><Icon name="branch" size={18} /> {t('Decision map')}</button>
          <button type="button" className="chip-btn" onClick={() => { restartStory(story.id); go({ name: 'play', storyId: story.id }); }}><Icon name="restart" size={16} /> {t('Play another path')}</button>
          <button type="button" className="chip-btn" onClick={() => go({ name: 'archive' })}><Icon name="archive" size={16} /> {t('Memory Archive')}</button>
        </div>
      </div>
    </Shell>
  );
}
