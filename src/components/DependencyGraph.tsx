'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GraphProps {
  items: any[];
  dependencies: any[];
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  done: { bg: '#065f46', border: '#10b981', text: '#a7f3d0' },
  'in-progress': { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  blocked: { bg: '#7f1d1d', border: '#ef4444', text: '#fca5a5' },
};

export default function DependencyGraph({ items, dependencies }: GraphProps) {
  const initialNodes = useMemo(() => {
    // Dagre-like layout: compute layers via longest-path from roots
    const successorMap: Record<string, string[]> = {};
    const predecessorMap: Record<string, string[]> = {};
    items.forEach(i => { successorMap[i.id] = []; predecessorMap[i.id] = []; });
    dependencies.forEach(d => {
      if (successorMap[d.predecessor_id]) successorMap[d.predecessor_id].push(d.successor_id);
      if (predecessorMap[d.successor_id]) predecessorMap[d.successor_id].push(d.predecessor_id);
    });

    // Find roots (no predecessors)
    const roots = items.filter(i => predecessorMap[i.id]?.length === 0);
    const layers: Record<string, number> = {};

    // BFS to assign layers
    const queue = roots.map(r => r.id);
    roots.forEach(r => { layers[r.id] = 0; });
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const succ of (successorMap[current] || [])) {
        const newLayer = (layers[current] || 0) + 1;
        if (layers[succ] === undefined || layers[succ] < newLayer) {
          layers[succ] = newLayer;
        }
        queue.push(succ);
      }
    }

    // Group items by layer
    const layerGroups: Record<number, any[]> = {};
    items.forEach(item => {
      const layer = layers[item.id] ?? 0;
      if (!layerGroups[layer]) layerGroups[layer] = [];
      layerGroups[layer].push(item);
    });

    return items.map((item) => {
      const layer = layers[item.id] ?? 0;
      const group = layerGroups[layer] || [];
      const indexInLayer = group.indexOf(item);
      const colors = statusColors[item.status] || statusColors.blocked;

      return {
        id: item.id,
        position: { x: layer * 280, y: indexInLayer * 120 },
        data: {
          label: (
            <div style={{
              padding: '10px 14px',
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              borderRadius: '10px',
              minWidth: '160px',
              color: colors.text,
            }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {item.status.toUpperCase()} · {item.progress}%
              </div>
              <div style={{
                marginTop: '6px',
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.15)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${item.progress}%`,
                  background: colors.border,
                  borderRadius: '2px',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          ),
        },
      };
    });
  }, [items, dependencies]);

  const initialEdges = useMemo(() => {
    return dependencies.map((dep) => ({
      id: `${dep.predecessor_id}-${dep.successor_id}`,
      source: dep.predecessor_id,
      target: dep.successor_id,
      label: dep.type === 'full' ? 'full' : `≥${dep.threshold}%`,
      labelStyle: { fill: '#94a3b8', fontSize: 11 },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
      style: { stroke: '#475569', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
      animated: true,
    }));
  }, [dependencies]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-blue-300/60 text-sm rounded-lg border border-white/10 bg-white/5">
        No tasks yet. Create work items to see the dependency graph.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '450px' }} className="rounded-lg overflow-hidden border border-white/10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        style={{ background: '#0f172a' }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const item = items.find((i: any) => i.id === node.id);
            return item?.status === 'done' ? '#10b981' : item?.status === 'in-progress' ? '#3b82f6' : '#ef4444';
          }}
          style={{ background: '#1e293b', borderRadius: '8px' }}
        />
        <Background gap={20} size={1} color="#1e293b" />
      </ReactFlow>
    </div>
  );
}
