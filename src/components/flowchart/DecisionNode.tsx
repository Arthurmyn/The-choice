import type { KeyboardEvent, ReactNode } from 'react';
import { useT } from '../../i18n';
import { NODE_SIZE } from '../../engine/flowchart';
import type { MapNode } from '../../engine/flowchart';

/** Short lines for the junction title, which sits under the junction. */
function wrap(text: string, max = 13): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

export function DecisionNode({
  node,
  visited,
  selected,
  index,
  onSelect,
  onHover,
}: {
  node: MapNode;
  visited: boolean;
  selected: boolean;
  index: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}): ReactNode {
  const t = useT();
  const { w, h } = NODE_SIZE[node.kind];
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(node.id);
    }
  };
  const cls = `map-node ${node.kind} ${visited ? 'visited' : 'unvisited'} ${selected ? 'selected' : ''}`;
  const name = node.kind === 'decision' ? `${node.label}: ${node.sublabel}` : node.kind === 'choice' ? `${node.label} (${node.sublabel})` : node.label;
  return (
    <g
      className={cls}
      transform={`translate(${node.x - w / 2} ${node.y - h / 2})`}
      role="button"
      tabIndex={0}
      aria-label={`${name}${visited ? ', ' + t('on your path') : ', ' + t('not taken')}`}
      aria-pressed={selected}
      onClick={() => onSelect(node.id)}
      onKeyDown={onKey}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
    >
      <g className="map-node-in" style={{ ['--i' as string]: index }}>
        {node.kind === 'decision' ? (
          <circle className="map-node-box" cx={w / 2} cy={h / 2} r={w / 2} />
        ) : (
          <rect className="map-node-box" width={w} height={h} rx={node.kind === 'start' ? h / 2 : 8} />
        )}
        {node.kind === 'ending' && <rect className="map-node-ring" x={-6} y={-6} width={w + 12} height={h + 12} rx={12} fill="none" />}
        {visited && node.kind !== 'start' && node.kind !== 'decision' && (
          <path className="map-check" d={`M${w - 30} ${h / 2} l5 5 l10 -11`} fill="none" />
        )}
        {node.kind === 'decision' ? (
          <>
            <text className="map-tag" x={w / 2} y={h / 2 + 4} textAnchor="middle">{node.label}</text>
            {wrap(node.sublabel).map((line, i) => (
              <text key={line} className="map-hub" x={w / 2} y={h + 14 + i * 12} textAnchor="middle">{line}</text>
            ))}
          </>
        ) : node.kind === 'choice' ? (
          <>
            <text className="map-sub" x={18} y={22}>{node.sublabel}</text>
            <text className="map-label" x={18} y={h - 16}>{node.label}</text>
          </>
        ) : node.kind === 'ending' ? (
          <>
            <text className="map-sub" x={18} y={23}>{t('Ending')}</text>
            <text className="map-label" x={18} y={h - 17}>{node.label}</text>
          </>
        ) : (
          <text className="map-label" x={w / 2} y={h / 2 + 5} textAnchor="middle">{t(node.label)}</text>
        )}
      </g>
    </g>
  );
}
