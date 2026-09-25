import type { Edge } from '@xyflow/react';
import type { StateNode } from '../automataStore';
import type { RegexExerciseDefinition } from './types';

const alphabetAB = ['a', 'b'];

const exerciseNode = (id: string, x: number, y: number, initial = false, final = false): StateNode => ({
  id,
  type: 'state',
  position: { x, y },
  data: { label: id.slice(1), initial, final },
});

const exerciseEdge = (id: string, source: string, target: string, label: string): Edge => ({ id, source, target, label, type: 'automaton' });

export const regexExercises: RegexExerciseDefinition[] = [
  {
    id: 1, title: 'Automate 1', prompt: '', alphabet: alphabetAB,
    accepted: ['b', 'ab', 'baa'], rejected: ['', 'a', 'bb', 'bab'], answer: 'a*ba*',
    nodes: [exerciseNode('q0', 190, 220, true), exerciseNode('q1', 500, 220, false, true)],
    edges: [exerciseEdge('e0', 'q0', 'q0', 'a'), exerciseEdge('e1', 'q0', 'q1', 'b'), exerciseEdge('e2', 'q1', 'q1', 'a')],
  },
  {
    id: 2, title: 'Automate 2', prompt: '', alphabet: alphabetAB,
    accepted: ['', 'b', 'ab', 'babb'], rejected: ['a', 'aa', 'ba'], answer: '(b|ab)*',
    nodes: [exerciseNode('q0', 190, 220, true, true), exerciseNode('q1', 500, 220)],
    edges: [exerciseEdge('e0', 'q0', 'q0', 'b'), exerciseEdge('e1', 'q0', 'q1', 'a'), exerciseEdge('e2', 'q1', 'q0', 'b')],
  },
  {
    id: 3, title: 'Automate 3', prompt: '', alphabet: alphabetAB,
    accepted: ['', 'a', 'b', 'aa', 'ba', 'aaba'], rejected: ['ab', 'bb', 'babb'], answer: '((a|b)a)*(ε|a|b)',
    nodes: [exerciseNode('q0', 190, 220, true, true), exerciseNode('q1', 500, 220, false, true)],
    edges: [exerciseEdge('e0', 'q0', 'q1', 'a, b'), exerciseEdge('e1', 'q1', 'q0', 'a')],
  },
  {
    id: 4, title: 'Automate 4', prompt: '', alphabet: alphabetAB,
    accepted: ['a', 'b', 'aa', 'aba', 'baab'], rejected: ['', 'ab', 'ba', 'abb'], answer: 'a((a|b)*a|ε)|b((a|b)*b|ε)',
    nodes: [exerciseNode('q0', 60, 230, true), exerciseNode('q1', 300, 90, false, true), exerciseNode('q2', 570, 90), exerciseNode('q3', 300, 350, false, true), exerciseNode('q4', 570, 350)],
    edges: [exerciseEdge('e0', 'q0', 'q1', 'a'), exerciseEdge('e1', 'q0', 'q3', 'b'), exerciseEdge('e2', 'q1', 'q1', 'a'), exerciseEdge('e3', 'q1', 'q2', 'b'), exerciseEdge('e4', 'q2', 'q1', 'a'), exerciseEdge('e5', 'q2', 'q2', 'b'), exerciseEdge('e6', 'q3', 'q3', 'b'), exerciseEdge('e7', 'q3', 'q4', 'a'), exerciseEdge('e8', 'q4', 'q3', 'b'), exerciseEdge('e9', 'q4', 'q4', 'a')],
  },
  {
    id: 5, title: 'Automate 5', prompt: '', alphabet: ['0', '1'],
    accepted: ['', '0', '11', '01100', '11011'], rejected: ['1', '10', '111', '101'], answer: '(0|11)*',
    nodes: [exerciseNode('q0', 190, 220, true, true), exerciseNode('q1', 500, 220)],
    edges: [exerciseEdge('e0', 'q0', 'q0', '0'), exerciseEdge('e1', 'q0', 'q1', '1'), exerciseEdge('e2', 'q1', 'q0', '1')],
  },
  {
    id: 6, title: 'Automate 6', prompt: '', alphabet: alphabetAB,
    accepted: ['', 'a', 'b', 'ab', 'baba'], rejected: ['aa', 'bb', 'abb'], answer: '(ab)*(ε|a)|(ba)*(ε|b)',
    nodes: [exerciseNode('q0', 120, 220, true, true), exerciseNode('q1', 470, 100, false, true), exerciseNode('q2', 470, 340, false, true)],
    edges: [exerciseEdge('e0', 'q0', 'q1', 'a'), exerciseEdge('e1', 'q0', 'q2', 'b'), exerciseEdge('e2', 'q1', 'q2', 'b'), exerciseEdge('e3', 'q2', 'q1', 'a')],
  },
  {
    id: 7, title: 'Automate 7', prompt: '', alphabet: ['0', '1'],
    accepted: ['100', '101', '1110'], rejected: ['', '10', '010', '1000'], answer: '(0|1)*1(0|1)(0|1)',
    nodes: [exerciseNode('q0', 60, 220, true), exerciseNode('q1', 280, 220), exerciseNode('q2', 500, 220), exerciseNode('q3', 720, 220, false, true)],
    edges: [exerciseEdge('e0', 'q0', 'q0', '0, 1'), exerciseEdge('e1', 'q0', 'q1', '1'), exerciseEdge('e2', 'q1', 'q2', '0, 1'), exerciseEdge('e3', 'q2', 'q3', '0, 1')],
  },
  {
    id: 8, title: 'Automate 8', prompt: '', alphabet: alphabetAB,
    accepted: ['', 'aa', 'bb', 'abba', 'abab'], rejected: ['a', 'b', 'ab', 'aab'], answer: '(aa|bb|(ab|ba)(aa|bb)*(ab|ba))*',
    nodes: [exerciseNode('q0', 180, 100, true, true), exerciseNode('q1', 500, 100), exerciseNode('q2', 180, 350), exerciseNode('q3', 500, 350)],
    edges: [exerciseEdge('e0', 'q0', 'q1', 'a'), exerciseEdge('e1', 'q1', 'q0', 'a'), exerciseEdge('e2', 'q0', 'q2', 'b'), exerciseEdge('e3', 'q2', 'q0', 'b'), exerciseEdge('e4', 'q1', 'q3', 'b'), exerciseEdge('e5', 'q3', 'q1', 'b'), exerciseEdge('e6', 'q2', 'q3', 'a'), exerciseEdge('e7', 'q3', 'q2', 'a')],
  },
  {
    id: 9, title: 'Automate 9', prompt: '', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'bbb', 'aaa', 'abacac'], rejected: ['a', 'aa', 'abca'], answer: '(b|c)*(a(b|c)*a(b|c)*a(b|c)*)*',
    nodes: [exerciseNode('q0', 110, 220, true, true), exerciseNode('q1', 360, 100), exerciseNode('q2', 610, 220)],
    edges: [exerciseEdge('e0', 'q0', 'q0', 'b, c'), exerciseEdge('e1', 'q1', 'q1', 'b, c'), exerciseEdge('e2', 'q2', 'q2', 'b, c'), exerciseEdge('e3', 'q0', 'q1', 'a'), exerciseEdge('e4', 'q1', 'q2', 'a'), exerciseEdge('e5', 'q2', 'q0', 'a')],
  },
  {
    id: 10, title: 'Automate 10', prompt: '', alphabet: ['0', '1'],
    accepted: ['', '0', '11', '110', '1001'], rejected: ['1', '10', '101', '111'], answer: '(0|1(01*0)*1)*',
    nodes: [exerciseNode('q0', 120, 220, true, true), exerciseNode('q1', 440, 90), exerciseNode('q2', 440, 350)],
    edges: [exerciseEdge('e0', 'q0', 'q0', '0'), exerciseEdge('e1', 'q0', 'q1', '1'), exerciseEdge('e2', 'q1', 'q2', '0'), exerciseEdge('e3', 'q1', 'q0', '1'), exerciseEdge('e4', 'q2', 'q1', '0'), exerciseEdge('e5', 'q2', 'q2', '1')],
  },
];
