import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { storyById } from '../data';
import { useLang, useT } from '../i18n';
import { GameProvider, useGame } from '../hooks/useGameState';
import { audio } from '../hooks/useAudio';
import { voice } from '../hooks/voice';
import { useEffect } from 'react';
import { GameScreen } from './GameScreen';
import { useRoute } from './routes';
import type { Route } from './routes';
import { MainMenu } from '../components/navigation/MainMenu';
import { StorySelection } from '../components/navigation/StorySelection';
import { Settings } from '../components/navigation/Settings';
import { About } from '../components/navigation/About';
import { MemoryArchive } from '../components/navigation/MemoryArchive';
import { Shell } from '../components/navigation/Shell';

const MapScreen = lazy(() => import('../components/flowchart/MapScreen').then((m) => ({ default: m.MapScreen })));
const PhilosophicalAnalysis = lazy(() => import('../components/philosophy/PhilosophicalAnalysis').then((m) => ({ default: m.PhilosophicalAnalysis })));

function Screens({ route, go }: { route: Route; go: (r: Route) => void }): ReactNode {
  const lang = useLang();
  const t = useT();
  switch (route.name) {
    case 'stories':
      return <StorySelection go={go} />;
    case 'archive':
      return <MemoryArchive go={go} />;
    case 'settings':
      return <Settings go={go} />;
    case 'about':
      return <About go={go} />;
    case 'play': {
      const story = storyById(route.storyId, lang);
      return story ? <GameScreen key={story.id} story={story} go={go} /> : <Shell go={go} title={t('Not found')}><p>{t('That story does not exist.')}</p></Shell>;
    }
    case 'map':
      return <MapScreen storyId={route.storyId} run={route.run} go={go} />;
    case 'analysis':
      return <PhilosophicalAnalysis storyId={route.storyId} run={route.run} go={go} />;
    default:
      return <MainMenu go={go} />;
  }
}

function Loading(): ReactNode {
  const t = useT();
  return (
    <div className="loading" role="status" aria-label={t('Loading')}>
      <i className="echo-ring" />
      <i className="echo-core" />
    </div>
  );
}

function Root(): ReactNode {
  const { route, go } = useRoute();
  const { settings } = useGame();

  useEffect(() => {
    audio.setVolumes(settings.muted ? 0 : settings.musicVolume, settings.muted ? 0 : settings.sfxVolume);
  }, [settings.musicVolume, settings.sfxVolume, settings.muted]);

  useEffect(() => {
    voice.configure(settings.voiceOn && !settings.muted, settings.voiceVolume, settings.lang);
  }, [settings.voiceOn, settings.voiceVolume, settings.muted, settings.lang]);

  // Unlock Web Audio on the first gesture and give every button a soft click.
  useEffect(() => {
    const unlock = (): void => audio.unlock();
    const click = (e: MouseEvent): void => {
      if (e.target instanceof HTMLElement && e.target.closest('button:not(:disabled)')) audio.play('click');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      <div className="app">
        <Suspense fallback={<Loading />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route.name === 'play' ? `play:${route.storyId}` : route.name}
              className="screen"
              initial={{ opacity: settings.reducedMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: settings.reducedMotion ? 1 : 0 }}
              transition={{ duration: settings.reducedMotion ? 0 : 0.32, ease: [0.23, 1, 0.32, 1] }}
            >
              <Screens route={route} go={go} />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </div>
    </MotionConfig>
  );
}

export function App(): ReactNode {
  return (
    <GameProvider>
      <Root />
    </GameProvider>
  );
}
