'use client';

import type { Edge, Node } from '@xyflow/react';
import { create } from 'zustand';

export type StateData = { label: string; initial?: boolean; final?: boolean };
export type StateNode = Node<StateData, 'state'>;

export const starterNodes: StateNode[] = [
  { id: 'q0', type: 'state', position: { x: 120, y: 190 }, data: { label: '0', initial: true } },
  { id: 'q1', type: 'state', position: { x: 410, y: 190 }, data: { label: '1', final: true } },
];

export const starterEdges: Edge[] = [
  { id: 'q0-q1-a', source: 'q0', target: 'q1', label: 'a', type: 'automaton' },
  { id: 'q1-q1-b', source: 'q1', target: 'q1', label: 'b', type: 'automaton' },
];

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
