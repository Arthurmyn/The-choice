import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { PointerEvent as RPointerEvent, ReactNode } from 'react';
import { buildMapLayout, highlightPath } from '../../engine/flowchart';
import type { DecisionRecord, Story } from '../../engine/types';
import { Icon } from '../ui/Icon';
import { DecisionEdge } from './DecisionEdge';
import { DecisionNode } from './DecisionNode';

interface View {
  k: number;
  x: number;
  y: number;
}
const MIN_K = 0.25;
const MAX_K = 2.4;

/** Pan/zoom viewport: wheel, drag, pinch, buttons and keyboard. */
export function DecisionMap({
  story,
  history,
  selectedId,
  onSelect,
  onHover,
}: {
  story: Story;
  history: readonly DecisionRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}): ReactNode {
  const t = useT();
  const layout = useMemo(() => buildMapLayout(story), [story]);
  const hi = useMemo(() => highlightPath(story, layout, history), [story, layout, history]);
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [easing, setEasing] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; k: number } | null>(null);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    // Never fit below a readable size: on narrow screens the map starts at its left edge and is panned.
    const k = Math.max(Math.min(width / layout.width, height / layout.height, 1.15), 0.5);
    setEasing(true);
    setView({
      k,
      x: layout.width * k > width ? 12 : (width - layout.width * k) / 2,
      y: (height - layout.height * k) / 2,
    });
  }, [layout]);

  useEffect(() => {
    fit();
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number, animate = false) => {
    setEasing(animate);
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);

  const center = (): { x: number; y: number } => {
    const r = box.current?.getBoundingClientRect();
    return { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 };
  };

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const down = (e: RPointerEvent): void => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  };
  const move = (e: RPointerEvent): void => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.current?.getBoundingClientRect();
    if (pinch.current && pointers.current.size === 2 && r) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.k * (d / pinch.current.d);
      zoomAt(target / view.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return; // let taps through to nodes
    if (!d.moved) {
      d.moved = true;
      box.current?.setPointerCapture(e.pointerId);
    }
    setEasing(false);
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const up = (e: RPointerEvent): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.target !== e.currentTarget) return;
    const c = center();
    const step = 48;
    const keys: Record<string, () => void> = {
      '+': () => zoomAt(1.25, c.x, c.y, true),
      '=': () => zoomAt(1.25, c.x, c.y, true),
      '-': () => zoomAt(0.8, c.x, c.y, true),
      '0': fit,
      ArrowLeft: () => { setEasing(true); setView((v) => ({ ...v, x: v.x + step })); },
      ArrowRight: () => { setEasing(true); setView((v) => ({ ...v, x: v.x - step })); },
      ArrowUp: () => { setEasing(true); setView((v) => ({ ...v, y: v.y + step })); },
      ArrowDown: () => { setEasing(true); setView((v) => ({ ...v, y: v.y - step })); },
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const edges = [...layout.edges].sort((a, b) => Number(hi.activeEdges.has(a.id)) - Number(hi.activeEdges.has(b.id)));
  return (
    <div className="map-viewport" data-testid="map-viewport">
      <div
        ref={box}
        className="map-surface"
        tabIndex={0}
        role="application"
        aria-label={t('Decision map. Drag or use arrow keys to pan, plus and minus to zoom, 0 to fit.')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={onKey}
      >
        <svg className="map-svg" role="group" aria-label={t('Decision map for {story}. {n} nodes on your path.', { story: story.title, n: hi.visitedNodes.size })} data-testid="decision-map" width="100%" height="100%">
          <g className={`map-world ${easing ? 'easing' : ''}`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            {edges.map((e, i) => {
              const from = byId.get(e.from);
              const to = byId.get(e.to);
              return from && to ? <DecisionEdge key={e.id} from={from} to={to} active={hi.activeEdges.has(e.id)} index={i} /> : null;
            })}
            {layout.nodes.map((n, i) => (
              <DecisionNode key={n.id} node={n} visited={hi.visitedNodes.has(n.id)} selected={selectedId === n.id} index={i} onSelect={onSelect} onHover={onHover} />
            ))}
          </g>
        </svg>
      </div>
      <div className="map-tools" role="toolbar" aria-label={t('Map view')}>
        <button type="button" className="icon-btn" aria-label={t('Zoom in')} onClick={() => { const c = center(); zoomAt(1.25, c.x, c.y, true); }}><Icon name="zoom-in" /></button>
        <button type="button" className="icon-btn" aria-label={t('Zoom out')} onClick={() => { const c = center(); zoomAt(0.8, c.x, c.y, true); }}><Icon name="zoom-out" /></button>
        <button type="button" className="icon-btn" aria-label={t('Fit map to view')} onClick={fit}><Icon name="fit" /></button>
        <span className="map-zoom" aria-live="off">{Math.round(view.k * 100)}%</span>
      </div>
    </div>
  );
}
