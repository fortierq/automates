'use client';

import type { Edge, Node } from '@xyflow/react';
import { create } from 'zustand';

export type StateData = { label: string; initial?: boolean; final?: boolean; connectionRole?: 'source' | 'target' };
export type StateNode = Node<StateData, 'state'>;

export const starterNodes: StateNode[] = [
  { id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: '0', initial: true } },
];

export const starterEdges: Edge[] = [];

type GraphStore = {
  nodes: StateNode[];
  edges: Edge[];
  setNodes: (nodes: StateNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  reset: (empty?: boolean) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: starterNodes,
  edges: starterEdges,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  reset: (empty = false) => set({ nodes: empty ? [] : starterNodes, edges: empty ? [] : starterEdges }),
}));
