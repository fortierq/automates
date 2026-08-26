'use client';

import type { Edge, Node } from '@xyflow/react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StateData = { label: string; initial?: boolean; final?: boolean };
export type StateNode = Node<StateData, 'state'>;

export const starterNodes: StateNode[] = [
  { id: 'q0', type: 'state', position: { x: 120, y: 190 }, data: { label: 'q0', initial: true } },
  { id: 'q1', type: 'state', position: { x: 410, y: 190 }, data: { label: 'q1', final: true } },
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

export const useGraphStore = create<GraphStore>()(
  persist(
    (set) => ({
      nodes: starterNodes,
      edges: starterEdges,
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      reset: (empty = false) => set({ nodes: empty ? [] : starterNodes, edges: empty ? [] : starterEdges }),
    }),
    { name: 'automates-mpi-graph' },
  ),
);
