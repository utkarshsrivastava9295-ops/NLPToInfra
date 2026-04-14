import type { Edge, Node } from "@xyflow/react";
import type { InfraEdge, InfraResource } from "./types";

const COL_W = 220;
const ROW_H = 110;

function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (t === "actor") return "#99f6e4";
  if (t.includes("cdn")) return "#a5b4fc";
  if (t.includes("load") || t.includes("balancer")) return "#fbbf24";
  if (t.includes("compute") || t.includes("container")) return "#5eead4";
  if (t.includes("database") || t === "db") return "#fb7185";
  if (t.includes("cache")) return "#f472b6";
  if (t.includes("security") || t.includes("secret")) return "#94a3b8";
  return "#cbd5e1";
}

/** BFS depth from roots (users, or all nodes with no incoming edges). */
function computeDepths(
  ids: Set<string>,
  edges: InfraEdge[],
): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    incoming.get(e.to)!.push(e.from);
  }

  const roots = [...ids].filter((id) => incoming.get(id)!.length === 0);
  const start = roots.length ? roots : [...ids];

  const depth = new Map<string, number>();
  const q: string[] = [];
  for (const r of start) {
    depth.set(r, 0);
    q.push(r);
  }
  if (!q.length) {
    for (const id of ids) {
      depth.set(id, 0);
      q.push(id);
    }
  }

  while (q.length) {
    const n = q.shift()!;
    const d = depth.get(n)!;
    for (const e of edges) {
      if (e.from !== n || !ids.has(e.to)) continue;
      const next = e.to;
      const nd = d + 1;
      if (!depth.has(next) || depth.get(next)! > nd) {
        depth.set(next, nd);
        q.push(next);
      }
    }
  }
  for (const id of ids) if (!depth.has(id)) depth.set(id, 0);
  return depth;
}

export function buildFlowElements(
  resources: InfraResource[],
  edges: InfraEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(resources.map((r) => r.id));
  const depths = computeDepths(ids, edges);
  const byDepth = new Map<number, string[]>();
  let maxD = 0;
  for (const r of resources) {
    const d = depths.get(r.id) ?? 0;
    maxD = Math.max(maxD, d);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(r.id);
  }
  for (const [, row] of byDepth) row.sort();

  const pos = new Map<string, { x: number; y: number }>();
  for (let d = 0; d <= maxD; d++) {
    const row = byDepth.get(d) ?? [];
    const width = Math.max(1, row.length) * COL_W;
    row.forEach((id, i) => {
      const x = i * COL_W - width / 2 + COL_W / 2;
      const y = d * ROW_H;
      pos.set(id, { x, y });
    });
  }

  const nodes: Node[] = resources.map((r) => {
    const p = pos.get(r.id) ?? { x: 0, y: 0 };
    const accent = typeColor(r.type);
    return {
      id: r.id,
      type: "infra",
      position: p,
      data: {
        label: r.name,
        sub: r.provider_service,
        type: r.type,
        accent,
      },
    };
  });

  const flowEdges: Edge[] = edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: true,
      style: { stroke: "rgba(148,163,184,0.55)", strokeWidth: 2 },
      labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
      labelBgStyle: { fill: "rgba(12,16,32,0.85)" },
    }));

  return { nodes, edges: flowEdges };
}
