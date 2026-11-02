import { deriveState, getDecision } from './narrativeEngine';
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

/**
 * Decision map for any story graph. Scenes and routers are collapsed: an edge goes
 * from a choice to every decision or ending it can lead to next.
 */
export function buildMapLayout(story: Story): MapLayout {
  const nodes = new Map<string, MapNode>();
  const edges: MapEdge[] = [];
  const edgeSet = new Set<string>();
  const addEdge = (from: string, to: string): void => {
    const id = `${from}->${to}`;
    if (!edgeSet.has(id)) {
      edgeSet.add(id);
      edges.push({ id, from, to });
    }
  };
  const mk = (n: Omit<MapNode, 'x' | 'y' | 'row'>): MapNode => {
    const full: MapNode = { ...n, row: 0, x: 0, y: 0 };
    nodes.set(n.id, full);
    return full;
  };

  mk({ id: 'start', kind: 'start', label: 'INTRODUCTION', sublabel: story.title });

  /** Decision / ending ids that can follow `id` once scenes and routers are passed through. */
  const targetsMemo = new Map<string, string[]>();
  const targets = (id: string | undefined, seen = new Set<string>()): string[] => {
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const node: StoryNode | undefined = story.nodes[id];
    if (!node) return [];
    if (node.type === 'decision') return [id];
    if (node.type === 'router') {
      const out: string[] = [];
      for (const r of node.routes) {
        if (r.ending) out.push(`ending:${r.ending}`);
        else out.push(...targets(r.next, seen));
      }
      if (node.defaultEnding) out.push(`ending:${node.defaultEnding}`);
      else out.push(...targets(node.default, seen));
      return [...new Set(out)];
    }
    const cached = targetsMemo.get(id);
    if (cached) return cached;
    const r = targets(node.next, seen);
    targetsMemo.set(id, r);
    return r;
  };

  // Walk the reachable graph of decisions.
  const queue: string[] = [...targets(story.start)];
  for (const t of queue) addEdge('start', t);
  const seenDecisions = new Set<string>();
  while (queue.length) {
    const id = queue.shift() as string;
    if (id.startsWith('ending:')) {
      const e = story.endings[id.slice(7)];
      if (e && !nodes.has(id)) mk({ id, kind: 'ending', label: e.title, sublabel: e.id, endingId: e.id });
      continue;
    }
    if (seenDecisions.has(id)) continue;
    seenDecisions.add(id);
    const d = getDecision(story, id);
    if (!d) continue;
    mk({ id: d.id, kind: 'decision', label: d.stage, sublabel: d.title, nodeId: d.id });
    for (const c of d.choices) {
      const cid = choiceId(d.id, c.id);
      mk({ id: cid, kind: 'choice', label: c.mapLabel, sublabel: d.stage, nodeId: d.id, choiceId: c.id });
      addEdge(d.id, cid);
      const next = c.ending ? [`ending:${c.ending}`] : targets(c.next ?? d.next);
      for (const t of next) {
        addEdge(cid, t);
        queue.push(t);
      }
    }
  }
  for (const e of Object.values(story.endings)) {
    const id = `ending:${e.id}`;
    // keep endings that are only reached through routers
    if (!nodes.has(id) && edges.some((x) => x.to === id)) mk({ id, kind: 'ending', label: e.title, sublabel: e.id, endingId: e.id });
  }

  // Depth = longest path from the start (the graph is acyclic).
  const preds = new Map<string, string[]>();
  for (const e of edges) (preds.get(e.to) ?? preds.set(e.to, []).get(e.to)!).push(e.from);
  const depth = new Map<string, number>();
  const calc = (id: string, stack = new Set<string>()): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (stack.has(id)) return 0;
    stack.add(id);
    const d = id === 'start' ? 0 : 1 + Math.max(0, ...(preds.get(id) ?? []).map((p) => calc(p, stack)));
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  nodes.forEach((n) => (n.row = calc(n.id)));

  // Order each column by the average position of its predecessors.
  const maxRow = Math.max(...[...nodes.values()].map((n) => n.row));
  const cols: MapNode[][] = Array.from({ length: maxRow + 1 }, () => []);
  nodes.forEach((n) => cols[n.row].push(n));
  const pos = new Map<string, number>();
  cols.forEach((col, ci) => {
    if (ci > 0) {
      const bary = (n: MapNode): number => {
        const ps = preds.get(n.id) ?? [];
        return ps.length ? ps.reduce((a, p) => a + (pos.get(p) ?? 0), 0) / ps.length : 0;
      };
      col.sort((a, b) => bary(a) - bary(b));
    }
    col.forEach((n, i) => pos.set(n.id, i - (col.length - 1) / 2));
  });

  const rowH = NODE_SIZE.ending.h + ROW_GAP;
  const tallest = Math.max(...cols.map((c) => c.length));
  const height = MARGIN * 2 + (tallest - 1) * rowH + NODE_SIZE.ending.h + 24;
  let cursor = MARGIN;
  const used = cols.filter((c) => c.length);
  used.forEach((col) => {
    const w = Math.max(...col.map((n) => NODE_SIZE[n.kind].w));
    col.forEach((n, i) => {
      n.x = cursor + w / 2;
      n.y = height / 2 + (i - (col.length - 1) / 2) * rowH;
    });
    cursor += w + COL_GAP;
  });
  return { nodes: [...nodes.values()], edges, width: cursor - COL_GAP + MARGIN, height };
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
    if (!d) continue; // evidence records
    const cId = choiceId(d.id, rec.choiceId);
    active.add(`${prev}->${d.id}`);
    active.add(`${d.id}->${cId}`);
    visited.add(d.id);
    visited.add(cId);
    prev = cId;
  }
  const end = deriveState(story, history);
  if (end.complete && end.endingId) {
    const eId = `ending:${end.endingId}`;
    visited.add(eId);
    active.add(`${prev}->${eId}`);
  }
  return {
    visitedNodes: new Set([...visited].filter((i) => layout.nodes.some((n) => n.id === i))),
    activeEdges: new Set([...active].filter((e) => layout.edges.some((x) => x.id === e))),
  };
}

/** The ending reached through a router (no choice carries it). */
export function endingNodeId(endingId: string): string {
  return `ending:${endingId}`;
}
