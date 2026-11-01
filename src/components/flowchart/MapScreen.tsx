import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import { getStories } from '../../data';
import { useLang } from '../../i18n';
import { buildMapLayout } from '../../engine/flowchart';
import { deriveState, resolveLines } from '../../engine/narrativeEngine';
import { latestRun } from '../../engine/progressManager';
import type { CompletedRun, Story } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import type { Route } from '../../app/routes';
import { Shell } from '../navigation/Shell';
import { DecisionMap } from './DecisionMap';

export function resolveRun(story: Story, runParam: string, completed: Record<string, CompletedRun>): CompletedRun | null {
  const runs = Object.values(completed);
  const found = runs.find((r) => r.history.map((h) => h.choiceId).join('.') === runParam);
  if (found) return found;
  return latestRun({ version: 1, storyId: story.id, history: [], cursor: null, completed, fragments: [], updatedAt: 0 });
}

export function MapScreen({ storyId, run, go }: { storyId: string; run: string; go: (r: Route) => void }): ReactNode {
  const t = useT();
  const story = getStories(useLang()).find((s) => s.id === storyId);
  const { progressOf, restartStory } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => (story ? buildMapLayout(story) : null), [story]);

  if (!story || !layout) return <NotFound go={go} />;
  const completed = progressOf(story.id).completed;
  const played = resolveRun(story, run, completed);
  if (!played) {
    return (
      <Shell go={go} title={t('Decision map')}>
        <p>{t('Finish {story} once to unlock its decision map.', { story: story.title })}</p>
        <button type="button" className="cta" onClick={() => go({ name: 'play', storyId: story.id })}>{t('Play story')}</button>
      </Shell>
    );
  }
  const state = deriveState(story, played.history);
  const info = layout.nodes.find((n) => n.id === (selected ?? hover));
  const runKey = played.history.map((h) => h.choiceId).join('.');

  const another = (): void => {
    restartStory(story.id);
    go({ name: 'play', storyId: story.id });
  };

  return (
    <Shell go={go} title={`${t('Decision map')} · ${story.title}`} bg={story.tone}>
      <div className="map-layout">
        <ul className="legend" aria-label={t('Legend')}>
          <li><i className="lg path" /> {t('Your path')}</li>
          <li><i className="lg alt" /> {t('Alternative branch')}</li>
          <li><i className="lg end" /> {t('Ending')}</li>
        </ul>
        <DecisionMap story={story} history={played.history} selectedId={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} onHover={setHover} />
        <div className="map-below">
          <aside aria-live="polite">
            <NodeReview story={story} nodeId={info?.id ?? null} flags={state.flags} history={played.history.map((h) => h.choiceId)} endingId={played.endingId} />
          </aside>
          <div className="map-actions">
            <button type="button" className="cta" onClick={another} data-testid="play-another">{t('PLAY ANOTHER PATH')}</button>
            <button type="button" className="chip-btn" onClick={() => go({ name: 'analysis', storyId: story.id, run: runKey })}>{t('Philosophical analysis')}</button>
            <button type="button" className="chip-btn" onClick={() => go({ name: 'archive' })}>{t('Memory Archive')}</button>
            <p className="muted small-note">{t('Reviewing a node does not change your saved playthrough.')}</p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function NodeReview({ story, nodeId, flags, history, endingId }: { story: Story; nodeId: string | null; flags: Record<string, string>; history: string[]; endingId: string }): ReactNode {
  const t = useT();
  if (!nodeId) {
    return (
      <div className="review">
        <p className="meta-label">{t('Node review')}</p>
        <p className="muted">{t('Select any node to read what it contained. Faded nodes are branches you did not take.')}</p>
      </div>
    );
  }
  if (nodeId === 'start') {
    return (
      <div className="review">
        <p className="meta-label">{t('Introduction')}</p>
        <h3>{story.title}</h3>
        <p>{story.synopsis}</p>
      </div>
    );
  }
  if (nodeId.startsWith('ending:')) {
    const e = story.endings[nodeId.slice(7)];
    const reached = e.id === endingId;
    return (
      <div className="review">
        <p className="meta-label">{t('Ending')} · {reached ? t('Reached') : t('Not reached on this run')}</p>
        <h3>{e.title}</h3>
        <p className="muted">{e.subtitle}</p>
        <p>{e.result}</p>
        <p className="unresolved"><strong>{t('Unresolved')}:</strong> {e.unresolved}</p>
      </div>
    );
  }
  if (nodeId.startsWith('choice:')) {
    const [, dId, cId] = nodeId.split(':');
    const d = story.nodes[dId];
    if (d?.type !== 'decision') return null;
    const c = d.choices.find((x) => x.id === cId);
    if (!c) return null;
    const chosen = history.includes(cId) && d.choices.some((x) => x.id === cId);
    const lines = resolveLines(c.reaction, { ...flags, ...c.sets });
    return (
      <div className="review">
        <p className="meta-label">{d.stage} · {chosen ? t('You chose this') : t('Alternative branch · not taken')}</p>
        <h3>{c.label}</h3>
        <p>{c.description}</p>
        {c.preview && <p className="quote">{c.preview}</p>}
        <p className="result"><strong>{t('Result')}:</strong> {c.result}</p>
        <details>
          <summary>{t('Scene transcript')}</summary>
          <ul className="transcript">
            {lines.map((l, i) => (
              <li key={i}><strong>{l.speaker ? story.characters[l.speaker]?.name : t('Narration')}:</strong> {l.text}</li>
            ))}
          </ul>
        </details>
      </div>
    );
  }
  const d = story.nodes[nodeId];
  if (d?.type !== 'decision') return null;
  const taken = d.choices.find((c) => history.includes(c.id));
  return (
    <div className="review">
      <p className="meta-label">{d.stage} · DECISION</p>
      <h3>{d.title}</h3>
      <p>{d.situation}</p>
      <ul>{d.info.map((i) => <li key={i}>{i}</li>)}</ul>
      {taken && <p className="result"><strong>{t('You chose')}:</strong> {taken.label}</p>}
    </div>
  );
}

function NotFound({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  return (
    <Shell go={go} title={t('Not found')}>
      <p>{t('That story does not exist.')}</p>
    </Shell>
  );
}
