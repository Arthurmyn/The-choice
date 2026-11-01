import { useCallback, useRef } from 'react';

/**
 * Pointer parallax without React state: one global listener eases every
 * registered layer toward the pointer and writes `transform` directly.
 */
interface Layer {
  el: HTMLElement;
  depth: number;
}

const layers = new Set<Layer>();
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };
let raf = 0;
let listening = false;

function enabled(): boolean {
  const c = document.documentElement.classList;
  return !c.contains('reduce-motion') && !c.contains('no-camera');
}

function tick(): void {
  raf = 0;
  const on = enabled();
  current.x += ((on ? target.x : 0) - current.x) * 0.07;
  current.y += ((on ? target.y : 0) - current.y) * 0.07;
  layers.forEach(({ el, depth }) => {
    el.style.transform = `translate3d(${(current.x * depth).toFixed(2)}px, ${(current.y * depth).toFixed(2)}px, 0)`;
  });
  if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) raf = requestAnimationFrame(tick);
}

function onMove(e: PointerEvent): void {
  if (e.pointerType === 'touch') return;
  target.x = (e.clientX / window.innerWidth - 0.5) * 2;
  target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  if (!raf) raf = requestAnimationFrame(tick);
}

/** Returns a ref callback; `depth` is the maximum offset in px at the screen edge. */
export function useParallax(depth: number): (el: HTMLElement | null) => void {
  const layer = useRef<Layer | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      if (layer.current) {
        layers.delete(layer.current);
        layer.current = null;
      }
      if (!el) return;
      layer.current = { el, depth };
      layers.add(layer.current);
      if (!listening && typeof window !== 'undefined') {
        listening = true;
        window.addEventListener('pointermove', onMove, { passive: true });
      }
    },
    [depth],
  );
}
