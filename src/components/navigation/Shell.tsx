import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { motion } from 'framer-motion';
import type { Route } from '../../app/routes';
import type { BackgroundId } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import { SceneBackground } from '../cinematic/SceneBackground';
import { Icon } from '../ui/Icon';

/** Common frame for non-gameplay screens: a dimmed scene, a quiet way back, one large title. */
export function Shell({
  go,
  title,
  children,
  bg = 'messaging',
  back,
  tone = 'blue',
}: {
  go: (r: Route) => void;
  title: string;
  children: ReactNode;
  bg?: BackgroundId;
  back?: { label: string; route: Route };
  tone?: 'blue' | 'memory';
}): ReactNode {
  const t = useT();
  const { settings } = useGame();
  return (
    <div className={`page tone-${tone}`}>
      <SceneBackground id={bg} className="cam blur" />
      <div className="scene-vignette strong" aria-hidden="true" />
      <div className="page-scroll">
        <header className="page-head">
          <button type="button" className="back-link" onClick={() => go(back?.route ?? { name: 'menu' })}>
            <Icon name="back" size={18} /> {back?.label ?? t('Menu')}
          </button>
          <motion.h1
            className="page-title"
            initial={settings.reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {title}
          </motion.h1>
        </header>
        <main className="page-main">{children}</main>
      </div>
    </div>
  );
}
