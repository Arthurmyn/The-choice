import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useGame } from '../../hooks/useGameState';

export function SceneTransition({ id, children }: { id: string; children: ReactNode }): ReactNode {
  const { settings } = useGame();
  const d = settings.reducedMotion ? 0 : 0.45;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className="transition-wrap"
        initial={{ opacity: d ? 0 : 1, filter: d ? 'blur(8px)' : 'blur(0px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(6px)' }}
        transition={{ duration: d, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
