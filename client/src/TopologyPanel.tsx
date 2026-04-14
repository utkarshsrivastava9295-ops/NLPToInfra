import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { InfraEdge, InfraResource } from "./types";
import { buildFlowElements } from "./layoutGraph";
import { InfraNode } from "./InfraNode";

const nodeTypes = { infra: InfraNode };

type Props = {
  resources: InfraResource[];
  edges: InfraEdge[];
};

function TopologyInner({ resources, edges }: Props) {
  const { nodes, edges: fe } = useMemo(
    () => buildFlowElements(resources, edges),
    [resources, edges],
  );

  return (
    <div className="h-[420px] w-full rounded-2xl border border-white/10 bg-ink-950/50 md:h-[480px]">
      <ReactFlow
        nodes={nodes}
        edges={fe}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(148,163,184,0.15)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={() => "rgba(94,234,212,0.35)"}
          maskColor="rgba(7,10,18,0.75)"
        />
      </ReactFlow>
    </div>
  );
}

export function TopologyPanel(props: Props) {
  return (
    <ReactFlowProvider>
      <TopologyInner {...props} />
    </ReactFlowProvider>
  );
}
