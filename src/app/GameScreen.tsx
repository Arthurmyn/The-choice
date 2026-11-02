import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import type { ReactNode } from 'react';
import { changesStory, getChoice, resolveLines, visibleItems } from '../engine/narrativeEngine';
import type { Beat, EvidenceItem, InvestigationNode, Story } from '../engine/types';
import { useGame } from '../hooks/useGameState';
import { useStoryProgress } from '../hooks/useProgress';
import { audio } from '../hooks/useAudio';
import { voice } from '../hooks/voice';
import type { Route } from './routes';
import { ScenePlayer } from '../components/cinematic/ScenePlayer';
import { SceneTransition } from '../components/cinematic/SceneTransition';
import { SceneBackground } from '../components/cinematic/SceneBackground';
import { DecisionPanel } from '../components/decisions/DecisionPanel';
import { EvidencePanel } from '../components/investigation/EvidencePanel';
import { InteractionHost } from '../components/investigation/InteractionHost';
import { EndingScreen } from '../components/endings/EndingScreen';
import { Icon } from '../components/ui/Icon';
import { SoundControl } from '../components/ui/SoundControl';
import { ResourceBar } from '../components/ui/ResourceBar';

export function GameScreen({ story, go }: { story: Story; go: (r: Route) => void }): ReactNode {
  const t = useT();
  const { setCursor, confirmDecision, restartStory, storageWarning, collectFragment, inspectEvidence } = useGame();
  const { progress, state, timeline } = useStoryProgress(story);
  useEffect(() => {
    voice.setCast(Object.values(story.characters));
  }, [story]);

  /** Inspected in this run: story-changing items come from the history, the rest from the archive. */
  const inspectedIn = useCallback(
    (node: InvestigationNode): Set<string> => {
      const taken = new Set(state.inspected[node.id] ?? []);
      return new Set(node.items.filter((i) => (changesStory(i) ? taken.has(i.id) : progress.fragments.includes(i.id))).map((i) => i.id));
    },
    [state.inspected, progress.fragments],
  );
  /** Evidence the player has access to so far, across every investigation on the path. */
  const { drawerItems, drawerOpened } = useMemo(() => {
    const items: EvidenceItem[] = [];
    const open = new Set<string>();
    for (const id of state.path) {
      const n = story.nodes[id];
      if (n?.type !== 'investigation') continue;
      const seen = inspectedIn(n);
      for (const it of visibleItems(n, state.snapshots[n.id] ?? state.flags)) {
        if (changesStory(it) && !seen.has(it.id)) continue;
        items.push(it);
        if (seen.has(it.id)) open.add(it.id);
      }
    }
    return { drawerItems: items, drawerOpened: open };
  }, [state.path, state.snapshots, state.flags, story, inspectedIn]);
  const openFragment = useCallback(
    (nodeId: string | null, item: EvidenceItem) => {
      if (nodeId && changesStory(item)) inspectEvidence(story, nodeId, item.id);
      else if (!changesStory(item)) collectFragment(story.id, item.id);
    },
    [collectFragment, inspectEvidence, story],
  );
  const [showEvidence, setShowEvidence] = useState(false);
  const [interactionDone, setInteractionDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve where the player is. Answered decisions never show their panel again.
  const { beat, line } = useMemo(() => {
    let idx = progress.cursor ? timeline.findIndex((b) => b.key === progress.cursor?.key) : 0;
    if (idx < 0) idx = Math.max(0, timeline.length - 1);
    let ln = progress.cursor && timeline[idx]?.key === progress.cursor.key ? progress.cursor.line : 0;
    while (timeline[idx]?.kind === 'decision' && state.selected[timeline[idx].nodeId] && idx + 1 < timeline.length) {
      idx += 1;
      ln = 0;
    }
    return { beat: timeline[idx] as Beat | undefined, line: ln };
  }, [progress.cursor, timeline, state.selected]);

  const goTo = useCallback(
    (key: string, ln = 0) => setCursor(story.id, { key, line: ln }),
    [setCursor, story.id],
  );

  const nextBeat = useCallback(() => {
    if (!beat) return;
    const i = timeline.findIndex((b) => b.key === beat.key);
    const n = timeline[i + 1];
    if (n) goTo(n.key, 0);
  }, [beat, timeline, goTo]);

  useEffect(() => {
    if (state.valid && !progress.cursor && beat) goTo(beat.key, 0);
  }, [state.valid, progress.cursor, beat, goTo]);

  if (!state.valid || !beat) {
    return (
      <div className="page"><div className="page-scroll"><main className="page-main">
        <p>{t('This saved game could not be read.')}</p>
        <button type="button" className="cta" onClick={() => restartStory(story.id)}>{t('Start over')}</button>
      </main></div></div>
    );
  }

  const node = story.nodes[beat.nodeId];
  /** What the world looks like at this beat, not at the next decision. */
  const flags = beat.kind === 'ending' ? state.flags : beat.kind === 'decision' ? (state.snapshots[`${beat.nodeId}:before`] ?? state.flags) : (state.snapshots[beat.nodeId] ?? state.flags);
  const stageIndex = timeline.filter((b) => b.kind === 'decision').findIndex((b) => b.key === beat.nodeId || (beat.kind === 'reaction' && b.nodeId === beat.nodeId));
  // Stories told in chapters show the chapter instead of three decision ticks.
  const chapterNo = story.chapters
    ? Math.max(1, ...state.path.map((id) => { const n = story.nodes[id]; return n && n.type !== 'router' ? (n.chapter ?? 0) : 0; }))
    : 0;
  const chapter = story.chapters?.[chapterNo - 1];

  const hud = (
    <div className="hud">
      <button type="button" className="back-link" onClick={() => go({ name: 'menu' })} aria-label={t('Back to main menu (progress is saved)')}><Icon name="back" size={18} /> {t('Menu')}</button>
      <div className="hud-title">
        <span className="hud-story">{chapter ? `${story.title} · ${t('Chapter {n}', { n: chapterNo })} · ${chapter.day}` : story.title}</span>
        {chapter ? (
          <span className="hud-stages" aria-label={chapter.title}>
            {story.chapters?.map((c, i) => (
              <i key={c.title} className={i + 1 < chapterNo ? 'done' : i + 1 === chapterNo ? 'now' : ''} title={c.title} />
            ))}
          </span>
        ) : (
          <span className="hud-stages" aria-label={t('Decision progress')}>
            {[0, 1, 2].map((i) => (
              <i key={i} className={state.selected[`d${i + 1}`] ? 'done' : stageIndex === i && beat.kind === 'decision' ? 'now' : ''} />
            ))}
          </span>
        )}
      </div>
      <div className="hud-tools">
        <ResourceBar story={story} flags={flags} />
        <SoundControl />
        <button type="button" className="icon-btn" onClick={() => go({ name: 'settings' })} aria-label={t('Open settings')}><Icon name="settings" /></button>
      </div>
    </div>
  );

  let body: ReactNode = null;

  if (beat.kind === 'scene' && node?.type === 'scene') {
    const lines = resolveLines(node.scene, flags);
    body = (
      <ScenePlayer
        sceneKey={beat.key}
        scene={node.scene}
        lines={lines}
        characters={story.characters}
        index={line}
        onIndexChange={(i) => goTo(beat.key, i)}
        onFinish={nextBeat}
      />
    );
  } else if (beat.kind === 'investigation' && node?.type === 'investigation') {
    const lines = resolveLines(node.scene, flags);
    const shown = visibleItems(node, flags);
    const opened = inspectedIn(node);
    const missing = shown.filter((i) => i.required && !opened.has(i.id));
    body = (
      <ScenePlayer
        sceneKey={beat.key}
        scene={node.scene}
        lines={lines}
        characters={story.characters}
        index={line}
        onIndexChange={(i) => goTo(beat.key, i)}
        tail={
          <div className="overlay-center">
            <EvidencePanel
              items={shown}
              opened={opened}
              onOpen={(id) => { const it = shown.find((i) => i.id === id); if (it) openFragment(node.id, it); }}
              footer={
                <div className="evidence-foot">
                  <span className="muted">{missing.length ? t('{n} required left', { n: missing.length }) : t('You have what you need.')}</span>
                  <button type="button" className="cta" disabled={missing.length > 0} onClick={nextBeat} data-testid="evidence-continue">{t('Continue')} <Icon name="next" size={18} /></button>
                </div>
              }
            />
          </div>
        }
      />
    );
  } else if (beat.kind === 'decision' && node?.type === 'decision') {
    body = (
      <>
        <DecisionPanel
          key={node.id}
          node={node}
          flags={flags}
          characters={story.characters}
          hasEvidence={drawerItems.length > 0}
          onOpenEvidence={() => setShowEvidence(true)}
          onConfirm={(choiceId) => {
            const res = confirmDecision(story, node.id, choiceId);
            if (res.ok) {
              setError(null);
              goTo(`${node.id}:reaction`, 0);
            } else setError(res.error);
          }}
        />
        {showEvidence && (
          <div className="modal-backdrop" onClick={() => setShowEvidence(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <EvidencePanel items={drawerItems} opened={drawerOpened} onOpen={(id) => { const it = drawerItems.find((i) => i.id === id); if (it) openFragment(null, it); }} footer={<button type="button" className="chip-btn" onClick={() => setShowEvidence(false)}>{t('Close')}</button>} />
            </div>
          </div>
        )}
      </>
    );
  } else if (beat.kind === 'reaction' && node?.type === 'decision') {
    const choice = getChoice(story, node.id, state.selected[node.id]);
    if (choice) {
      const showInteraction = !!choice.interaction && line === 0 && interactionDone !== beat.key;
      const lines = resolveLines(choice.reaction, flags);
      const isLastBeat = timeline[timeline.length - 1].key === 'ending' && timeline[timeline.length - 2]?.key === beat.key;
      body = showInteraction && choice.interaction ? (
        <div className="scene">
          <SceneBackground id={choice.reaction.background} className="cam blur" />
          <div className="scene-vignette strong" aria-hidden="true" />
          <InteractionHost interaction={choice.interaction} flags={flags} characters={story.characters} onComplete={() => setInteractionDone(beat.key)} />
        </div>
      ) : (
        <ScenePlayer
          sceneKey={beat.key}
          scene={choice.reaction}
          lines={lines}
          characters={story.characters}
          index={line}
          onIndexChange={(i) => goTo(beat.key, i)}
          tail={
            <div className="overlay-center">
              <div className="result-card" data-testid="result-card">
                <p className="meta-label blue">{t('Result')}</p>
                <p className="result-text">{choice.result}</p>
                <button type="button" className="cta" onClick={nextBeat} data-testid="result-continue">{isLastBeat ? t('See the ending') : t('Continue')} <Icon name="next" size={18} /></button>
              </div>
            </div>
          }
        />
      );
    }
  } else if (beat.kind === 'ending') {
    body = (
      <EndingScreen
        story={story}
        history={progress.history}
        line={line}
        onLine={(i) => goTo('ending', i)}
        go={go}
        onRestart={() => { restartStory(story.id); setInteractionDone(null); audio.unlock(); }}
      />
    );
  }

  return (
    <div className="stage" onPointerDown={() => audio.unlock()}>
      <SceneTransition id={beat.kind === 'reaction' && interactionDone !== beat.key && getChoice(story, beat.nodeId, state.selected[beat.nodeId])?.interaction && line === 0 ? `${beat.key}:i` : beat.key}>{body}</SceneTransition>
      {hud}
      {(storageWarning || error) && <div className="banner warn floating" role="alert">{error ?? storageWarning}</div>}
    </div>
  );
}
