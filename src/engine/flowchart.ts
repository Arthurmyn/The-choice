import { getDecision } from './narrativeEngine';
import type { DecisionRecord, Story, StoryNode } from './types';

export type MapNodeKind = 'start' | 'decision' | 'choice' | 'ending';

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  label: string;
  sublabel: string;
  row: number;
  x: number;
  y: number;
  nodeId?: string;
  choiceId?: string;
  endingId?: string;
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
}

export interface MapLayout {
  nodes: MapNode[];
  edges: MapEdge[];
  width: number;
  height: number;
}

export const NODE_SIZE: Record<MapNodeKind, { w: number; h: number }> = {
  start: { w: 150, h: 46 },
  decision: { w: 34, h: 34 },
  choice: { w: 196, h: 58 },
  ending: { w: 208, h: 64 },
};
const COL_GAP = 52;
const ROW_GAP = 30;
const MARGIN = 48;

const choiceId = (n: string, c: string): string => `choice:${n}:${c}`;

/** Build a top-down decision map from the story graph. */
export function buildMapLayout(story: Story): MapLayout {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const rows: MapNode[][] = [];
  const push = (n: Omit<MapNode, 'x' | 'y'>): MapNode => {
    const full = { ...n, x: 0, y: 0 };
    nodes.push(full);
    (rows[n.row] ??= []).push(full);
    return full;
  };

  push({ id: 'start', kind: 'start', label: 'INTRODUCTION', sublabel: story.title, row: 0 });
  let row = 1;
  let prevIds = ['start'];

  // Follow the decision spine; story graphs here are layered (all choices rejoin).
  let nodeId: string | undefined = story.start;
  const seen = new Set<string>();
  while (nodeId && !seen.has(nodeId)) {
    seen.add(nodeId);
    const node: StoryNode | undefined = story.nodes[nodeId];
    if (!node) break;
    if (node.type !== 'decision') {
      nodeId = node.next;
      continue;
    }
    const dn = push({ id: node.id, kind: 'decision', label: node.stage, sublabel: node.title, row, nodeId: node.id });
    prevIds.forEach((p) => edges.push({ id: `${p}->${dn.id}`, from: p, to: dn.id }));
    row += 1;
    const choiceIds: string[] = [];
    let nextNodes = new Set<string | undefined>();
    for (const c of node.choices) {
      const cn = push({
        id: choiceId(node.id, c.id),
        kind: 'choice',
        label: c.mapLabel,
        sublabel: node.stage,
        row,
        nodeId: node.id,
        choiceId: c.id,
      });
      edges.push({ id: `${dn.id}->${cn.id}`, from: dn.id, to: cn.id });
      choiceIds.push(cn.id);
      nextNodes.add(c.ending ? `E:${c.ending}` : (c.next ?? node.next));
    }
    row += 1;
    const endingTargets = [...nextNodes].filter((n): n is string => !!n && n.startsWith('E:'));
    if (endingTargets.length) {
      for (const c of node.choices) {
        if (!c.ending) continue;
        const id = `ending:${c.ending}`;
        if (!nodes.find((n) => n.id === id)) {
          const e = story.endings[c.ending];
          push({ id, kind: 'ending', label: e.title, sublabel: e.id, row, endingId: e.id });
        }
        edges.push({ id: `${choiceId(node.id, c.id)}->${id}`, from: choiceId(node.id, c.id), to: id });
      }
      break;
    }
    prevIds = choiceIds;
    const targets = [...nextNodes].filter((n): n is string => !!n);
    nodeId = targets[0];
    nextNodes = new Set();
  }

  // Left-to-right: each depth is a column, siblings stack vertically.
  // Column widths follow their widest node, so narrow junctions stay narrow.
  const rowH = NODE_SIZE.ending.h + ROW_GAP;
  const tallest = Math.max(...rows.map((r) => r?.length ?? 0));
  const height = MARGIN * 2 + (tallest - 1) * rowH + NODE_SIZE.ending.h + 24;
  let cursor = MARGIN;
  rows.forEach((r) => {
    const w = Math.max(...r.map((n) => NODE_SIZE[n.kind].w));
    r.forEach((n, i) => {
      n.x = cursor + w / 2;
      n.y = height / 2 + (i - (r.length - 1) / 2) * rowH;
    });
    cursor += w + COL_GAP;
  });
  return { nodes, edges, width: cursor - COL_GAP + MARGIN, height };
}

export interface MapHighlight {
  visitedNodes: Set<string>;
  activeEdges: Set<string>;
}

/** Which map nodes/edges lie on the played path. */
export function highlightPath(story: Story, layout: MapLayout, history: readonly DecisionRecord[]): MapHighlight {
  const visited = new Set<string>(['start']);
  const active = new Set<string>();
  let prev = 'start';
  for (const rec of history) {
    const d = getDecision(story, rec.nodeId);
    if (!d) continue;
    const decisionId = d.id;
    const cId = choiceId(d.id, rec.choiceId);
    active.add(`${prev}->${decisionId}`);
    active.add(`${decisionId}->${cId}`);
    visited.add(decisionId);
    visited.add(cId);
    prev = cId;
    const ch = d.choices.find((c) => c.id === rec.choiceId);
    if (ch?.ending) {
      const eId = `ending:${ch.ending}`;
      active.add(`${cId}->${eId}`);
      visited.add(eId);
    }
  }
  // Keep only edges/nodes that exist in the layout.
  const ids = new Set(layout.nodes.map((n) => n.id));
  const edgeIds = new Set(layout.edges.map((e) => e.id));
  return {
    visitedNodes: new Set([...visited].filter((i) => ids.has(i))),
    activeEdges: new Set([...active].filter((e) => edgeIds.has(e))),
  };
}
