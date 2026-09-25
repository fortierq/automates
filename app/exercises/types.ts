import type { Edge } from '@xyflow/react';
import type { StateNode } from '../automataStore';

export type LanguageExerciseDefinition = {
  id: number;
  title: string;
  prompt: string;
  alphabet: string[];
  accepted: string[];
  rejected: string[];
  initial: string;
  isFinal: (state: string) => boolean;
  transition: (state: string, symbol: string) => string;
};

export type ExerciseDefinition = Pick<LanguageExerciseDefinition, 'id' | 'title' | 'prompt' | 'alphabet' | 'accepted' | 'rejected'>;

export type RegexExerciseDefinition = ExerciseDefinition & {
  nodes: StateNode[];
  edges: Edge[];
  answer: string;
};
