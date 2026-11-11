import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { getStories, getUpcoming } from '../../data';
import type { UpcomingChapter } from '../../data';
import { useLang } from '../../i18n';
import { useGame } from '../../hooks/useGameState';
import { useStoryProgress } from '../../hooks/useProgress';
import type { Route } from '../../app/routes';
import type { Story } from '../../engine/types';
import { SceneBackground } from '../cinematic/SceneBackground';
import { Icon } from '../ui/Icon';


/** One story as a film chapter: the scene fills the panel, the text sits in the image. */
function Chapter({ story, index, go }: { story: Story; index: number; go: (r: Route) => void }): ReactNode {
  const t = useT();
  const { restartStory } = useGame();
  const { status, endingsFound, progress, state } = useStoryProgress(story);
  const [confirm, setConfirm] = useState(false);
  const total = Object.keys(story.endings).length;
  const active = progress.history.length > 0 || progress.cursor !== null;

  return (
    <article className="chapter" data-testid={`story-${story.id}`} aria-labelledby={`ch-${story.id}`}>
      <SceneBackground id={story.tone} className="cam" />
      <div className="chapter-shade" aria-hidden="true" />
      <span className="chapter-no" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="chapter-body">
        <p className="chapter-status"><span className={`dot ${status}`} aria-hidden="true" />{t(status === 'new' ? 'Not started' : status === 'in-progress' ? 'In progress' : 'Completed')}</p>
        <h2 id={`ch-${story.id}`} className="chapter-title">{story.title}</h2>
        <p className="chapter-category">{story.category}</p>
        <p className="chapter-synopsis">{story.synopsis}</p>
        <ul className="chips" aria-label={t('Themes')}>{story.themes.map((t) => <li key={t}>{t}</li>)}</ul>
        <dl className="chapter-meta">
          <div><Icon name="clock" size={16} /><dt className="sr-only">{t('Playtime')}</dt><dd>{story.minutes}</dd></div>
          <div><Icon name="branch" size={16} /><dt className="sr-only">{t('Endings found')}</dt><dd>{t('{n} of {m} endings', { n: endingsFound.size, m: total })}</dd></div>
        </dl>
        <div className="chapter-actions">
          <button type="button" className="cta" onClick={() => go({ name: 'play', storyId: story.id })} data-testid={`play-${story.id}`}>
            {active ? (state.complete ? t('Review ending') : t('Continue')) : t('Begin')}
          </button>
          {active && !confirm && (
            <button type="button" className="chip-btn" onClick={() => setConfirm(true)} data-testid={`restart-${story.id}`}>
              <Icon name="restart" size={16} /> {t('Restart')}
            </button>
          )}
          {confirm && (
            <span className="inline-confirm" role="group" aria-label={t('Confirm restart')}>
              <span>{t('Restart? Endings and fragments you found are kept.')}</span>
              <button type="button" className="chip-btn" onClick={() => { restartStory(story.id); setConfirm(false); go({ name: 'play', storyId: story.id }); }} data-testid={`restart-yes-${story.id}`}>{t('Yes, restart')}</button>
              <button type="button" className="chip-btn" onClick={() => setConfirm(false)}>{t('Cancel')}</button>
            </span>
          )}
        </div>
        <p className="fineprint">{story.disclaimer}</p>
      </div>
    </article>
  );
}

/** A chapter that is announced and not playable yet. Nothing is shown beyond its name and one line. */
function LockedChapter({ chapter, index }: { chapter: UpcomingChapter; index: number }): ReactNode {
  const t = useT();
  return (
    <article className="chapter locked" data-testid={`locked-${chapter.id}`} aria-labelledby={`ch-${chapter.id}`}>
      <SceneBackground id="city-night" className="cam" />
      <div className="chapter-shade" aria-hidden="true" />
      <span className="chapter-no" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="chapter-body">
        <p className="chapter-status"><Icon name="lock" size={14} />{t('In development')}</p>
        <h2 id={`ch-${chapter.id}`} className="chapter-title">{chapter.title}</h2>
        <p className="chapter-synopsis">{chapter.synopsis}</p>
      </div>
    </article>
  );
}

export function StorySelection({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  const lang = useLang();
  const stories = getStories(lang);
  const upcoming = getUpcoming(lang);
  return (
    <div className="chapters-page">
      <button type="button" className="back-link floating-back" onClick={() => go({ name: 'menu' })}>
        <Icon name="back" size={18} /> {t('Menu')}
      </button>
      <h1 className="sr-only">{t('Stories')}</h1>
      <div className="chapters">
        {stories.map((s, i) => <Chapter key={s.id} story={s} index={i} go={go} />)}
        {upcoming.map((c, i) => <LockedChapter key={c.id} chapter={c} index={stories.length + i} />)}
      </div>
    </div>
  );
}
