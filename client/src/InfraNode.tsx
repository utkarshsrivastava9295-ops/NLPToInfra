import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type InfraNodeData = {
  label: string;
  sub: string;
  type: string;
  accent: string;
};

function InfraNodeInner({ data }: NodeProps) {
  const d = data as InfraNodeData;
  return (
    <div
      className="min-w-[180px] max-w-[220px] rounded-2xl border border-white/10 bg-ink-900/90 px-3 py-2.5 shadow-lg backdrop-blur-md"
      style={{ boxShadow: `0 0 0 1px ${d.accent}22, 0 12px 40px -12px ${d.accent}44` }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-slate-500"
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {d.type}
      </p>
      <p className="font-display text-sm font-semibold leading-snug text-white">
        {d.label}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
        {d.sub}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-slate-500"
      />
    </div>
  );
}

export const InfraNode = memo(InfraNodeInner);
