import type { ReactNode } from 'react';
import { NODE_SIZE } from '../../engine/flowchart';
import type { MapNode } from '../../engine/flowchart';

export function DecisionEdge({ from, to, active, index }: { from: MapNode; to: MapNode; active: boolean; index: number }): ReactNode {
  const x1 = from.x + NODE_SIZE[from.kind].w / 2;
  const x2 = to.x - NODE_SIZE[to.kind].w / 2;
  const mx = (x1 + x2) / 2;
  return (
    <path
      d={`M${x1} ${from.y} C${mx} ${from.y}, ${mx} ${to.y}, ${x2} ${to.y}`}
      className={`map-edge ${active ? 'active' : ''}`}
      style={{ ['--i' as string]: index }}
      pathLength={1}
      fill="none"
    />
  );
}
