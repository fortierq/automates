'use client';

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  type Connection,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Github,
  Menu,
  MousePointer2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StateNode, useGraphStore } from './automataStore';

type Section = 'language' | 'language-regex' | 'regex';
type EdgeRouteData = {
  routeOffset?: number;
};
type LanguageExerciseDefinition = {
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
type ExerciseDefinition = Pick<LanguageExerciseDefinition, 'id' | 'title' | 'prompt' | 'alphabet' | 'accepted' | 'rejected'>;
type RegexExerciseDefinition = ExerciseDefinition & {
  nodes: StateNode[];
  edges: Edge[];
  answer: string;
};

function MathText({ children }: { children: string }) {
  return <span className="math" dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { throwOnError: false }) }} />;
}

function AutomatonLogo() {
  return <svg className="brand-logo" viewBox="0 0 32 32" role="img" aria-label="Logo Automates">
    <rect width="32" height="32" rx="7" fill="#246b49" />
    <path d="M3 16h9m-3-3 3 3-3 3" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="20" cy="16" r="8" fill="none" stroke="#fff" strokeWidth="1.7" />
  </svg>;
}

function InlineMathText({ children }: { children: string }) {
  return <>{children.split(/(\$[^$]+\$)/g).map((part, index) => part.startsWith('$') && part.endsWith('$')
    ? <MathText key={index}>{part.slice(1, -1)}</MathText>
    : part)}</>;
}

function State({ data, selected, isConnectable }: NodeProps<StateNode>) {
  return (
    <div className={`flow-state ${data.final ? 'is-final' : ''} ${selected ? 'is-selected' : ''}`}>
      {data.initial && <span className="initial-marker">→</span>}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  );
}

function AutomatonEdge(props: EdgeProps<Edge>) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, markerEnd, label, selected } = props;
  const sourceNode = useInternalNode<StateNode>(source);
  const targetNode = useInternalNode<StateNode>(target);
  const data = (props.data ?? {}) as EdgeRouteData;
  const loop = source === target;
  const offset = data.routeOffset ?? 0;
  let path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2 - 18;
  if (loop) {
    path = `M ${sourceX} ${sourceY} C ${sourceX + 62 + offset / 2} ${sourceY - 92 - offset}, ${targetX - 62 - offset / 2} ${targetY - 92 - offset}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = Math.min(sourceY, targetY) - 67 - offset;
  } else if (sourceNode && targetNode) {
    const sourceWidth = sourceNode.measured.width ?? 72;
    const sourceHeight = sourceNode.measured.height ?? 72;
    const targetWidth = targetNode.measured.width ?? 72;
    const targetHeight = targetNode.measured.height ?? 72;
    const sourceCenter = {
      x: sourceNode.internals.positionAbsolute.x + sourceWidth / 2,
      y: sourceNode.internals.positionAbsolute.y + sourceHeight / 2,
    };
    const targetCenter = {
      x: targetNode.internals.positionAbsolute.x + targetWidth / 2,
      y: targetNode.internals.positionAbsolute.y + targetHeight / 2,
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    const control = {
      x: (sourceCenter.x + targetCenter.x) / 2 + normal.x * offset,
      y: (sourceCenter.y + targetCenter.y) / 2 + normal.y * offset,
    };
    const boundaryPoint = (center: { x: number; y: number }, toward: { x: number; y: number }, radius: number, gap = 0) => {
      const pointDx = toward.x - center.x;
      const pointDy = toward.y - center.y;
      const pointLength = Math.hypot(pointDx, pointDy) || 1;
      return { x: center.x + pointDx / pointLength * (radius + gap), y: center.y + pointDy / pointLength * (radius + gap) };
    };
    const sourcePoint = boundaryPoint(sourceCenter, offset === 0 ? targetCenter : control, Math.min(sourceWidth, sourceHeight) / 2);
    const targetPoint = boundaryPoint(targetCenter, offset === 0 ? sourceCenter : control, Math.min(targetWidth, targetHeight) / 2, 3);
    if (offset === 0) {
      path = `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
      labelX = (sourcePoint.x + targetPoint.x) / 2;
      labelY = (sourcePoint.y + targetPoint.y) / 2 - 18;
    } else {
      path = `M ${sourcePoint.x} ${sourcePoint.y} Q ${control.x} ${control.y}, ${targetPoint.x} ${targetPoint.y}`;
      labelX = (sourcePoint.x + 2 * control.x + targetPoint.x) / 4 + normal.x * 14;
      labelY = (sourcePoint.y + 2 * control.y + targetPoint.y) / 4 + normal.y * 14;
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{ stroke: selected ? '#246b49' : '#33423a', strokeWidth: selected ? 2.4 : 1.7 }}
      />
      <EdgeLabelRenderer>
        <span
          className={`edge-label ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          {String(label ?? '')}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { state: State };
const edgeTypes = { automaton: AutomatonEdge };
const alphabetAB = ['a', 'b'];

const languageExercises: LanguageExerciseDefinition[] = [
  {
    id: 1, title: 'Termine par a', prompt: 'Ensemble des mots tels que le dernier symbole est un $a$.', alphabet: alphabetAB,
    accepted: ['a', 'ba', 'abba'], rejected: ['', 'b', 'aab'], initial: 'no',
    isFinal: (state) => state === 'a', transition: (_, symbol) => symbol === 'a' ? 'a' : 'no',
  },
  {
    id: 2, title: 'Contient le facteur ab', prompt: 'Ensemble des mots tels que le facteur $ab$ apparaît.', alphabet: alphabetAB,
    accepted: ['ab', 'aab', 'baba'], rejected: ['', 'a', 'bbaa'], initial: '0',
    isFinal: (state) => state === '2', transition: (state, symbol) => state === '2' ? '2' : state === '1' && symbol === 'b' ? '2' : symbol === 'a' ? '1' : '0',
  },
  {
    id: 3, title: 'Exactement deux a', prompt: 'Ensemble des mots tels que la lettre $a$ apparaît exactement deux fois.', alphabet: alphabetAB,
    accepted: ['aa', 'aba', 'bbaab'], rejected: ['', 'a', 'aaa'], initial: '0',
    isFinal: (state) => state === '2', transition: (state, symbol) => symbol === 'b' ? state : String(Math.min(3, Number(state) + 1)),
  },
  {
    id: 4, title: 'Jamais trois bits identiques', prompt: 'Ensemble des mots tels que ni $000$ ni $111$ n’apparaît comme facteur.', alphabet: ['0', '1'],
    accepted: ['', '0011', '01010', '1100'], rejected: ['000', '111', '10001'], initial: 'start',
    isFinal: (state) => state !== 'dead', transition: (state, symbol) => { if (state === 'dead' || state === symbol.repeat(2)) return 'dead'; return state.endsWith(symbol) ? symbol.repeat(2) : symbol; },
  },
  {
    id: 5, title: 'Troisième bit depuis la fin', prompt: 'Ensemble des mots tels que le troisième bit en partant de la fin est $1$.', alphabet: ['0', '1'],
    accepted: ['100', '101', '1110', '01101'], rejected: ['', '10', '010', '1000'], initial: '',
    isFinal: (state) => state.length >= 3 && state.at(-3) === '1', transition: (state, symbol) => (state + symbol).slice(-3),
  },
  {
    id: 6, title: 'Un seul des deux facteurs', prompt: 'Ensemble des mots tels qu’exactement l’un des facteurs $aba$ et $bab$ apparaît.', alphabet: alphabetAB,
    accepted: ['aba', 'bab', 'aabaa', 'bbabb'], rejected: ['', 'abba', 'abab', 'baba'], initial: '0|',
    isFinal: (state) => state.startsWith('1|') || state.startsWith('2|'), transition: (state, symbol) => { const [rawMask, suffix] = state.split('|'); const word = suffix + symbol; const mask = Number(rawMask) | (word.endsWith('aba') ? 1 : 0) | (word.endsWith('bab') ? 2 : 0); return `${mask}|${word.slice(-2)}`; },
  },
  {
    id: 7, title: 'Lettres c assorties', prompt: 'Ensemble des mots tels que chaque $c$ est immédiatement précédé et suivi de la même lettre : $aca$ ou $bcb$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'ab', 'aca', 'bcb', 'abcbaca'], rejected: ['c', 'ac', 'acb', 'cca'], initial: 'none',
    isFinal: (state) => state === 'none' || state.startsWith('last-'), transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'need-a' || state === 'need-b') return symbol === state.at(-1) ? `last-${symbol}` : 'dead'; if (symbol === 'c') return state === 'last-a' ? 'need-a' : state === 'last-b' ? 'need-b' : 'dead'; return `last-${symbol}`; },
  },
  {
    id: 8, title: 'Parités opposées autour de #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois et que les nombres de $1$ avant et après $\\#$ ont des parités différentes.', alphabet: ['0', '1', '#'],
    accepted: ['#1', '1#', '10#11', '11#1'], rejected: ['', '#', '1#1', '#11', '1#0#'], initial: 'pre:0',
    isFinal: (state) => { const parts = state.split(':'); return parts[0] === 'post' && parts[1] !== parts[2]; }, transition: (state, symbol) => { if (state === 'dead') return 'dead'; const parts = state.split(':'); if (parts[0] === 'pre') { if (symbol === '#') return `post:${parts[1]}:0`; return `pre:${symbol === '1' ? 1 - Number(parts[1]) : parts[1]}`; } if (symbol === '#') return 'dead'; return `post:${parts[1]}:${symbol === '1' ? 1 - Number(parts[2]) : parts[2]}`; },
  },
  {
    id: 9, title: 'Première lettre inédite après #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois, est suivi d’au moins un bit, et que le premier bit après $\\#$ n’apparaît pas avant lui.', alphabet: ['0', '1', '#'],
    accepted: ['#0', '#101', '0#1', '000#1'], rejected: ['#', '0#0', '01#0', '0#1#'], initial: 'pre:0',
    isFinal: (state) => state === 'ok', transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'ok') return symbol === '#' ? 'dead' : 'ok'; const [side, rawMask] = state.split(':'); const mask = Number(rawMask); if (side === 'pre') { if (symbol === '#') return `need:${mask}`; return `pre:${mask | (symbol === '0' ? 1 : 2)}`; } if (symbol === '#') return 'dead'; const bit = symbol === '0' ? 1 : 2; return mask & bit ? 'dead' : 'ok'; },
  },
  {
    id: 10, title: 'Multiples de trois en binaire', prompt: 'Ensemble des mots non vides tels que leur valeur binaire est divisible par $3$ ; les zéros initiaux sont autorisés.', alphabet: ['0', '1'],
    accepted: ['0', '11', '110', '1001'], rejected: ['', '1', '10', '101'], initial: 'start',
    isFinal: (state) => state === 'r0', transition: (state, symbol) => { const remainder = state === 'start' ? 0 : Number(state[1]); return `r${(remainder * 2 + Number(symbol)) % 3}`; },
  },
  {
    id: 11, title: 'Trois parités synchronisées', prompt: 'Ensemble des mots tels que les nombres de $a$, de $b$ et de $c$ ont tous la même parité.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'abc', 'aabbcc', 'abccba'], rejected: ['a', 'ab', 'abbc'], initial: '000',
    isFinal: (state) => state === '000' || state === '111', transition: (state, symbol) => { const index = ['a', 'b', 'c'].indexOf(symbol); return state.split('').map((bit, position) => position === index ? String(1 - Number(bit)) : bit).join(''); },
  },
  {
    id: 12, title: 'Double modulo cinq', prompt: 'Ensemble des mots tels que le nombre de $a$ est congru au double du nombre de $b$ modulo $5$ ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'c', 'aab', 'bbbbb', 'aaaaaccc'], rejected: ['a', 'b', 'ab', 'aabb'], initial: '0',
    isFinal: (state) => state === '0', transition: (state, symbol) => String((Number(state) + (symbol === 'a' ? 1 : symbol === 'b' ? 3 : 0)) % 5),
  },
];

const languageRegexExercises: LanguageExerciseDefinition[] = [
  {
    id: 1, title: 'Une seule occurrence de ab', prompt: 'Ensemble des mots tels que le facteur $ab$ apparaît exactement une fois.', alphabet: alphabetAB,
    accepted: ['ab', 'aab', 'abba', 'baba'], rejected: ['', 'a', 'bb', 'abab'], initial: '0:0',
    isFinal: (state) => state.startsWith('1:'),
    transition: (state, symbol) => { const [count, lastA] = state.split(':').map(Number); return `${Math.min(2, count + (lastA && symbol === 'b' ? 1 : 0))}:${symbol === 'a' ? 1 : 0}`; },
  },
  {
    id: 2, title: 'Un c toutes les trois lettres', prompt: 'Ensemble des mots tels que chaque lettre dont la position est un multiple de $3$ est un $c$ ; les positions commencent à $1$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'a', 'cc', 'aac', 'abcaac'], rejected: ['aaa', 'abb', 'abcaba'], initial: '0',
    isFinal: (state) => state !== 'dead',
    transition: (state, symbol) => state === 'dead' || (state === '2' && symbol !== 'c') ? 'dead' : String((Number(state) + 1) % 3),
  },
  {
    id: 3, title: 'Termine par 0 sans 111', prompt: 'Ensemble des mots tels que le dernier symbole est $0$ et que le facteur $111$ n’apparaît pas.', alphabet: ['0', '1'],
    accepted: ['0', '10', '110', '1010'], rejected: ['', '1', '1110', '1101'], initial: 'start',
    isFinal: (state) => state === 'zero',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (symbol === '0') return 'zero'; if (state === 'one2') return 'dead'; return state === 'one1' ? 'one2' : 'one1'; },
  },
  {
    id: 4, title: 'Lettres à compléter', prompt: 'Ensemble des mots tels que chaque $b$ est immédiatement suivi d’un $a$, et chaque $c$ immédiatement suivi de $ba$.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'a', 'ba', 'cba', 'bacba'], rejected: ['b', 'cb', 'caa', 'bb'], initial: 'ready',
    isFinal: (state) => state === 'ready',
    transition: (state, symbol) => { if (state === 'ready') return symbol === 'a' ? 'ready' : symbol === 'b' ? 'need-a' : 'need-b'; if (state === 'need-b') return symbol === 'b' ? 'need-a' : 'dead'; if (state === 'need-a') return symbol === 'a' ? 'ready' : 'dead'; return 'dead'; },
  },
  {
    id: 5, title: 'Deux séparateurs espacés', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement deux fois, avec au moins un bit entre les deux occurrences.', alphabet: ['0', '1', '#'],
    accepted: ['#0#', '1#1#0', '#01#11'], rejected: ['', '##', '#0', '#0#1#'], initial: 'before',
    isFinal: (state) => state === 'after',
    transition: (state, symbol) => { if (state === 'before') return symbol === '#' ? 'gap-empty' : 'before'; if (state === 'gap-empty') return symbol === '#' ? 'dead' : 'gap'; if (state === 'gap') return symbol === '#' ? 'after' : 'gap'; if (state === 'after') return symbol === '#' ? 'dead' : 'after'; return 'dead'; },
  },
  {
    id: 6, title: 'Écart impair entre les b', prompt: 'Ensemble des mots tels qu’entre deux $b$ consécutifs, le nombre de $a$ est toujours impair.', alphabet: alphabetAB,
    accepted: ['', 'b', 'aba', 'bab', 'baaab'], rejected: ['bb', 'baab', 'bababb'], initial: 'none',
    isFinal: (state) => state !== 'dead',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'none') return symbol === 'b' ? 'even' : 'none'; if (symbol === 'a') return state === 'even' ? 'odd' : 'even'; return state === 'odd' ? 'even' : 'dead'; },
  },
  {
    id: 7, title: 'Deux parités de blocs', prompt: 'Ensemble des mots tels que chaque bloc maximal de $a$ est de longueur paire et chaque bloc maximal de $b$ de longueur impaire.', alphabet: alphabetAB,
    accepted: ['', 'aa', 'b', 'aabbb', 'baab'], rejected: ['a', 'bb', 'abb', 'aabb'], initial: 'start',
    isFinal: (state) => state === 'start' || state === 'a-even' || state === 'b-odd',
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'start') return symbol === 'a' ? 'a-odd' : 'b-odd'; if (state === 'a-odd') return symbol === 'a' ? 'a-even' : 'dead'; if (state === 'a-even') return symbol === 'a' ? 'a-odd' : 'b-odd'; if (state === 'b-odd') return symbol === 'b' ? 'b-even' : 'a-odd'; return symbol === 'b' ? 'b-odd' : 'dead'; },
  },
  {
    id: 8, title: 'Alphabet autorisé après #', prompt: 'Ensemble des mots tels que $\\#$ apparaît exactement une fois et qu’après lui, seules des lettres déjà apparues avant lui sont utilisées.', alphabet: ['0', '1', '#'],
    accepted: ['#', '0#', '01#100', '10#111'], rejected: ['', '#0', '0#1', '0#0#'], initial: 'pre:0',
    isFinal: (state) => state.startsWith('post:'),
    transition: (state, symbol) => { if (state === 'dead') return 'dead'; const [side, rawMask] = state.split(':'); const mask = Number(rawMask); if (side === 'pre') { if (symbol === '#') return `post:${mask}`; return `pre:${mask | (symbol === '0' ? 1 : 2)}`; } if (symbol === '#') return 'dead'; const bit = symbol === '0' ? 1 : 2; return mask & bit ? state : 'dead'; },
  },
  {
    id: 9, title: 'Deux compteurs indépendants', prompt: 'Ensemble des mots tels que le nombre de $a$ est multiple de $3$ et le nombre de $b$ est pair ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'ccc', 'aaa', 'bb', 'aaabbc'], rejected: ['a', 'b', 'ab', 'aaab'], initial: '0:0',
    isFinal: (state) => state === '0:0',
    transition: (state, symbol) => { const [a, b] = state.split(':').map(Number); return symbol === 'a' ? `${(a + 1) % 3}:${b}` : symbol === 'b' ? `${a}:${1 - b}` : state; },
  },
  {
    id: 10, title: 'Congruence croisée modulo cinq', prompt: 'Ensemble des mots tels que le nombre de $a$ est congru au double du nombre de $b$ modulo $5$ ; la lettre $c$ est neutre.', alphabet: ['a', 'b', 'c'],
    accepted: ['', 'c', 'aab', 'bbbbb', 'aaaaaccc'], rejected: ['a', 'b', 'ab', 'aabb'], initial: '0',
    isFinal: (state) => state === '0',
    transition: (state, symbol) => String((Number(state) + (symbol === 'a' ? 1 : symbol === 'b' ? 3 : 0)) % 5),
  },
];

const exerciseNode = (id: string, x: number, y: number, initial = false, final = false): StateNode => ({
  id,
  type: 'state',
  position: { x, y },
  data: { label: id.slice(1), initial, final },
});
const exerciseEdge = (id: string, source: string, target: string, label: string): Edge => ({ id, source, target, label, type: 'automaton' });

const regexExercises: RegexExerciseDefinition[] = [
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

function compareLanguage(nodes: StateNode[], edges: Edge[], exercise: LanguageExerciseDefinition) {
  const initialStates = nodes.filter((node) => node.data.initial).map((node) => node.id).sort();
  const queue = [{ states: initialStates, targetState: exercise.initial, word: '' }];
  const visited = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const key = `${current.states.join(',')}|${current.targetState}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const studentAccepts = nodes.some((node) => node.data.final && current.states.includes(node.id));
    if (studentAccepts !== exercise.isFinal(current.targetState)) {
      return { equivalent: false as const, word: current.word, studentAccepts };
    }

    for (const symbol of exercise.alphabet) {
      const sources = new Set(current.states);
      const states = [...new Set(edges
        .filter((edge) => sources.has(edge.source) && String(edge.label ?? '').split(',').map((item) => item.trim()).includes(symbol))
        .map((edge) => edge.target))].sort();
      queue.push({ states, targetState: exercise.transition(current.targetState, symbol), word: current.word + symbol });
    }
  }

  return { equivalent: true as const };
}

function toLatex(nodes: StateNode[], edges: Edge[]) {
  const nodeLines = nodes.map((node) => {
    const options = ['state', node.data.initial && 'initial', node.data.final && 'accepting'].filter(Boolean).join(', ');
    return `  \\node[${options}] (${node.id}) at (${(node.position.x / 100).toFixed(1)},${(-node.position.y / 100).toFixed(1)}) {$${node.data.label}$};`;
  });
  const edgeLines = edges.map((edge) => {
    const reciprocal = edge.source !== edge.target && edges.some((item) => item.source === edge.target && item.target === edge.source);
    const options = edge.source === edge.target ? '[loop above]' : reciprocal ? '[bend left=20]' : '';
    return `    (${edge.source}) edge${options} node {$${String(edge.label ?? '').replaceAll(',', ',\\,')}$} (${edge.target})`;
  });
  return ['\\begin{tikzpicture}[shorten >=1pt, node distance=2cm, on grid, auto]', ...nodeLines, '  \\path[->]', ...edgeLines.map((line, index) => `${line}${index === edgeLines.length - 1 ? ';' : ''}`), '\\end{tikzpicture}'].join('\n');
}

type RegexAst =
  | { kind: 'empty' }
  | { kind: 'epsilon' }
  | { kind: 'literal'; value: string }
  | { kind: 'union'; parts: RegexAst[] }
  | { kind: 'concat'; parts: RegexAst[] }
  | { kind: 'star'; inner: RegexAst };

const empty: RegexAst = { kind: 'empty' };
const epsilon: RegexAst = { kind: 'epsilon' };
const keyOf = (ast: RegexAst): string => {
  if (ast.kind === 'empty') return '∅';
  if (ast.kind === 'epsilon') return 'ε';
  if (ast.kind === 'literal') return ast.value;
  if (ast.kind === 'star') return `(${keyOf(ast.inner)})*`;
  return `${ast.kind === 'union' ? 'U' : 'C'}(${ast.parts.map(keyOf).join(',')})`;
};

const union = (...input: RegexAst[]): RegexAst => {
  const parts = input.flatMap((ast) => ast.kind === 'union' ? ast.parts : [ast]).filter((ast) => ast.kind !== 'empty');
  const unique = [...new Map(parts.map((ast) => [keyOf(ast), ast])).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ast]) => ast);
  return unique.length === 0 ? empty : unique.length === 1 ? unique[0] : { kind: 'union', parts: unique };
};

const concat = (...input: RegexAst[]): RegexAst => {
  const parts = input.flatMap((ast) => ast.kind === 'concat' ? ast.parts : [ast]);
  if (parts.some((ast) => ast.kind === 'empty')) return empty;
  const useful = parts.filter((ast) => ast.kind !== 'epsilon');
  return useful.length === 0 ? epsilon : useful.length === 1 ? useful[0] : { kind: 'concat', parts: useful };
};

const star = (inner: RegexAst): RegexAst => inner.kind === 'empty' || inner.kind === 'epsilon' ? epsilon : inner.kind === 'star' ? inner : { kind: 'star', inner };

class RegexParser {
  private index = 0;
  constructor(private readonly source: string, private readonly alphabet: Set<string>) {}
  parse() {
    const result = this.parseUnion();
    if (this.index !== this.source.length) throw new Error('Expression mal formée.');
    return result;
  }
  private parseUnion(): RegexAst {
    const parts = [this.parseConcat()];
    while (this.source[this.index] === '|') {
      this.index += 1;
      parts.push(this.parseConcat());
    }
    return union(...parts);
  }
  private parseConcat(): RegexAst {
    const parts: RegexAst[] = [];
    while (this.index < this.source.length && !['|', ')'].includes(this.source[this.index])) parts.push(this.parsePostfix());
    return concat(...parts);
  }
  private parsePostfix(): RegexAst {
    let result = this.parseAtom();
    while (this.source[this.index] === '*') {
      this.index += 1;
      result = star(result);
    }
    return result;
  }
  private parseAtom(): RegexAst {
    const token = this.source[this.index++];
    if (token === '(') {
      const result = this.parseUnion();
      if (this.source[this.index++] !== ')') throw new Error('Parenthèse fermante manquante.');
      return result;
    }
    if (token === 'ε') return epsilon;
    if (token === '∅') return empty;
    if (token && this.alphabet.has(token)) return { kind: 'literal', value: token };
    throw new Error(`Symbole « ${token ?? ''} » non reconnu.`);
  }
}

const nullable = (ast: RegexAst): boolean => {
  if (ast.kind === 'epsilon' || ast.kind === 'star') return true;
  if (ast.kind === 'empty' || ast.kind === 'literal') return false;
  return ast.kind === 'union' ? ast.parts.some(nullable) : ast.parts.every(nullable);
};

const derivative = (ast: RegexAst, symbol: string): RegexAst => {
  if (ast.kind === 'empty' || ast.kind === 'epsilon') return empty;
  if (ast.kind === 'literal') return ast.value === symbol ? epsilon : empty;
  if (ast.kind === 'union') return union(...ast.parts.map((part) => derivative(part, symbol)));
  if (ast.kind === 'star') return concat(derivative(ast.inner, symbol), ast);
  const terms: RegexAst[] = [];
  for (let index = 0; index < ast.parts.length; index += 1) {
    terms.push(concat(derivative(ast.parts[index], symbol), ...ast.parts.slice(index + 1)));
    if (!nullable(ast.parts[index])) break;
  }
  return union(...terms);
};

function parseRegex(source: string, alphabet: string[]) {
  const normalized = source.replaceAll('\\varepsilon', 'ε').replaceAll('e', 'ε').replaceAll(/\s|·/g, '').replaceAll('+', '|');
  if (!normalized) throw new Error('Saisissez une expression.');
  return new RegexParser(normalized, new Set(alphabet)).parse();
}

function compareRegex(left: RegexAst, right: RegexAst, alphabet: string[]) {
  const queue: Array<[RegexAst, RegexAst, string]> = [[left, right, '']];
  const seen = new Set<string>();
  while (queue.length) {
    const [a, b, word] = queue.shift()!;
    const pairKey = `${keyOf(a)}=${keyOf(b)}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    if (nullable(a) !== nullable(b)) return { equivalent: false, word, leftAccepts: nullable(a) };
    if (seen.size > 1000) throw new Error('Expression trop complexe pour une correction instantanée.');
    alphabet.forEach((symbol) => queue.push([derivative(a, symbol), derivative(b, symbol), word + symbol]));
  }
  return { equivalent: true };
}

function compareRegexToLanguage(candidate: RegexAst, exercise: LanguageExerciseDefinition) {
  const queue: Array<[RegexAst, string, string]> = [[candidate, exercise.initial, '']];
  const seen = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [expression, state, word] = queue[cursor];
    const pairKey = `${keyOf(expression)}=${state}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const studentAccepts = nullable(expression);
    if (studentAccepts !== exercise.isFinal(state)) return { equivalent: false as const, word, studentAccepts };
    if (seen.size > 2000) throw new Error('Expression trop complexe pour une correction instantanée.');
    exercise.alphabet.forEach((symbol) => queue.push([derivative(expression, symbol), exercise.transition(state, symbol), word + symbol]));
  }
  return { equivalent: true as const };
}

function useRoutedEdges(edges: Edge[], selectedEdgeId: string | null = null) {
  return useMemo(() => edges.map((edge) => {
    const siblings = edges.filter((item) => item.source === edge.source && item.target === edge.target);
    const index = siblings.findIndex((item) => item.id === edge.id);
    const hasReverse = edge.source !== edge.target && edges.some((item) => item.source === edge.target && item.target === edge.source);
    const routeOffset = edge.source === edge.target
      ? index * 40
      : hasReverse
        ? 56 + index * 40
        : (index - (siblings.length - 1) / 2) * 64;
    return {
      ...edge,
      type: 'automaton',
      selected: edge.id === selectedEdgeId,
      markerEnd: { type: MarkerType.ArrowClosed, color: edge.id === selectedEdgeId ? '#246b49' : '#33423a' },
      data: { ...edge.data, routeOffset },
    };
  }), [edges, selectedEdgeId]);
}

function useSolvedExercises(storageKey: string, count: number) {
  const [solved, setSolved] = useState<number[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
        if (Array.isArray(saved)) setSolved([...new Set(saved.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= count))]);
      } catch { /* Une progression invalide est simplement ignorée. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [count, storageKey]);
  const markSolved = useCallback((id: number) => {
    setSolved((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id].sort((a, b) => a - b);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);
  return { solved, markSolved };
}

const showWord = (word: string) => word ? <MathText>{word.replaceAll('#', '\\#')}</MathText> : <MathText>{'\\varepsilon'}</MathText>;

function ExercisePicker({ current, exercises, solved, onSelect, id }: { current: ExerciseDefinition; exercises: ExerciseDefinition[]; solved: number[]; onSelect: (id: number) => void; id: string }) {
  const [open, setOpen] = useState(false);
  return <div className="exercise-picker" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
    <button id={id} className={`exercise-picker-trigger ${solved.includes(current.id) ? 'is-solved' : ''}`} aria-label="Choisir un exercice" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{String(current.id).padStart(2, '0')} — {current.title}</span><ChevronDown /></button>
    {open && <div className="exercise-picker-menu" role="listbox" aria-label="Choisir un exercice">{exercises.map((item) => <button key={item.id} role="option" aria-selected={item.id === current.id} className={`${solved.includes(item.id) ? 'is-solved' : ''} ${item.id === current.id ? 'is-current' : ''}`} onClick={() => { setOpen(false); onSelect(item.id); }}><span>{String(item.id).padStart(2, '0')}</span>{item.title}</button>)}</div>}
  </div>;
}

function ExerciseData({ exercise }: { exercise: ExerciseDefinition }) {
  return <div className="language-data"><section><strong>Langage</strong><p className="language-description"><InlineMathText>{exercise.prompt}</InlineMathText></p></section><section><strong>Alphabet</strong><div className="math-chips">{exercise.alphabet.map((symbol) => <span className="math-chip" key={symbol}>{showWord(symbol)}</span>)}</div></section><section><strong>Exemples de mots</strong><div className="example-row"><span>Acceptés</span><div className="math-chips">{exercise.accepted.map((word, index) => <span className="math-chip accepted" key={`${word}-${index}`}>{showWord(word)}</span>)}</div></div><div className="example-row"><span>Refusés</span><div className="math-chips">{exercise.rejected.map((word, index) => <span className="math-chip rejected" key={`${word}-${index}`}>{showWord(word)}</span>)}</div></div></section></div>;
}

function ExercisePanel({ exercise, exercises, solved, feedback, onSelect, onRestart, onCheck, children, pickerId, showLanguageDetails = true }: { exercise: ExerciseDefinition; exercises: ExerciseDefinition[]; solved: number[]; feedback: { ok: boolean; text: string } | null; onSelect: (id: number) => void; onRestart: () => void; onCheck: () => void; children?: React.ReactNode; pickerId: string; showLanguageDetails?: boolean }) {
  return <section className="exercise-task">
    <ExercisePicker id={pickerId} current={exercise} exercises={exercises} solved={solved} onSelect={onSelect} />
    {showLanguageDetails && <ExerciseData exercise={exercise} />}
    {children}
    {feedback && <Feedback {...feedback} />}
    <div className="exercise-buttons"><button className="ghost-button" onClick={onRestart}><RotateCcw /> Recommencer</button><button className="primary" onClick={onCheck}><Check /> Vérifier</button><button className="ghost-button next-exercise" disabled={exercise.id === exercises.length} onClick={() => onSelect(exercise.id + 1)}>Exercice suivant <ArrowRight /></button></div>
  </section>;
}

function RegexAnswer({ id, value, onChange, onCheck }: { id: string; value: string; onChange: (value: string) => void; onCheck: () => void }) {
  return <div className="regex-answer">
    <input id={id} className="regex-input" aria-label="Votre expression" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCheck(); }} placeholder="Expression régulière : *, |, e, (, )" />
  </div>;
}

function Workspace({ sidebar, footer, canvasClassName = '', children }: { sidebar: React.ReactNode; footer?: React.ReactNode; canvasClassName?: string; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <section className="workspace">
    <section className={`canvas-wrap ${canvasClassName}`} aria-label="Plan de travail de l’automate">
      <button className="sidebar-toggle" aria-controls="editor-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu /><span>Ouvrir le panneau</span></button>
      {children}
    </section>
    <button className={`sidebar-backdrop ${sidebarOpen ? 'is-visible' : ''}`} aria-label="Fermer le panneau" onClick={() => setSidebarOpen(false)} />
    <aside id="editor-sidebar" className={`side-panel ${sidebarOpen ? 'is-open' : ''}`}>
      <button className="sidebar-close" aria-label="Fermer le panneau" onClick={() => setSidebarOpen(false)}><X /></button>
      {sidebar}
      {footer}
    </aside>
  </section>;
}

function Editor({ sidebarContent, defaultSymbol = 'a' }: { sidebarContent?: React.ReactNode; defaultSymbol?: string }) {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const flow = useRef<ReactFlowInstance<StateNode, Edge> | null>(null);

  const toggleNode = useCallback((id: string, field: 'initial' | 'final') => {
    setNodes(nodes.map((node) => ({ ...node, data: { ...node.data, [field]: field === 'initial' ? (node.id === id ? !node.data.initial : false) : node.id === id ? !node.data.final : node.data.final } })));
  }, [nodes, setNodes]);

  const addState = useCallback((clientX: number, clientY: number) => {
    const position = flow.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? { x: 260, y: 220 };
    const used = new Set(nodes.map((node) => node.id));
    let index = 0;
    while (used.has(`q${index}`)) index += 1;
    setNodes([...nodes, { id: `q${index}`, type: 'state', position, data: { label: String(index) } }]);
  }, [nodes, setNodes]);

  const onNodeClick: NodeMouseHandler<StateNode> = (_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const routedEdges = useRoutedEdges(edges, selectedEdgeId);
  const copyLatex = async () => {
    await navigator.clipboard.writeText(toLatex(nodes, edges));
  };

  const downloadLatex = () => {
    const url = URL.createObjectURL(new Blob([toLatex(nodes, edges)], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'automate.tex';
    link.click();
    URL.revokeObjectURL(url);
  };

  const sidebar = <>
    {sidebarContent}
    <div className={sidebarContent ? 'sidebar-properties' : ''}>
      {selectedNode ? (
        <div className="properties-form">
          <span className="eyebrow">État sélectionné</span>
          <label htmlFor="state-label">Nom</label>
          <input id="state-label" className="text-input mono" value={selectedNode.data.label} onChange={(event) => setNodes(nodes.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, label: event.target.value } } : node))} />
          <label className="check-row"><input type="checkbox" checked={!!selectedNode.data.initial} onChange={() => toggleNode(selectedNode.id, 'initial')} /><span>État initial</span></label>
          <label className="check-row"><input type="checkbox" checked={!!selectedNode.data.final} onChange={() => toggleNode(selectedNode.id, 'final')} /><span>État final</span></label>
          <button className="danger-link" onClick={() => { setNodes(nodes.filter((node) => node.id !== selectedNode.id)); setEdges(edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)); setSelectedNodeId(null); }}><Trash2 /> Supprimer l’état</button>
        </div>
      ) : selectedEdge ? (
        <div className="properties-form">
          <span className="eyebrow">Transition sélectionnée</span>
          <label htmlFor="edge-label">Lettres (séparées par des virgules)</label>
          <input id="edge-label" className="text-input mono" autoFocus value={String(selectedEdge.label ?? '')} onChange={(event) => setEdges(edges.map((edge) => edge.id === selectedEdge.id ? { ...edge, label: event.target.value } : edge))} />
          <p className="transition-summary"><span>{nodes.find((node) => node.id === selectedEdge.source)?.data.label ?? selectedEdge.source}</span><ArrowRight /><span>{nodes.find((node) => node.id === selectedEdge.target)?.data.label ?? selectedEdge.target}</span></p>
          <button className="danger-link" onClick={() => { setEdges(edges.filter((edge) => edge.id !== selectedEdge.id)); setSelectedEdgeId(null); }}><Trash2 /> Supprimer la transition</button>
        </div>
      ) : <div className="empty-selection"><div className="empty-icon"><MousePointer2 /></div><strong>Créer et modifier</strong><p>Double-cliquez pour ajouter un état, puis reliez ses poignées. Sur écran tactile, touchez la poignée de départ puis celle d’arrivée.</p></div>}
    </div>
  </>;
  const footer = <div className="export-actions sidebar-export"><button className="primary" onClick={copyLatex}><Clipboard /> Copier LaTeX</button><button className="secondary-square" onClick={downloadLatex} aria-label="Télécharger LaTeX"><Download /></button></div>;

  return <Workspace sidebar={sidebar} footer={footer}>
        <ReactFlow<StateNode, Edge>
          nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }))}
          edges={routedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(instance) => { flow.current = instance; }}
          onNodesChange={(changes) => setNodes(applyNodeChanges(changes, nodes) as StateNode[])}
          onEdgesChange={(changes) => setEdges(applyEdgeChanges(changes, edges))}
          onConnect={(connection: Connection) => setEdges([...edges, { ...connection, id: `${connection.source}-${connection.target}-${Date.now()}`, label: defaultSymbol, type: 'automaton', markerEnd: { type: MarkerType.ArrowClosed } }])}
          onNodeClick={onNodeClick}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
          onPaneClick={(event) => { setSelectedNodeId(null); setSelectedEdgeId(null); if (event.detail === 2) addState(event.clientX, event.clientY); }}
          onNodesDelete={(deleted) => { if (deleted.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null); }}
          onEdgesDelete={(deleted) => { if (deleted.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null); }}
          fitView minZoom={0.3} maxZoom={2} connectOnClick connectionRadius={30} deleteKeyCode={['Backspace', 'Delete']} defaultEdgeOptions={{ type: 'automaton' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cdd6ce" />
          <Controls showInteractive={false} position="top-right" />
        </ReactFlow>
  </Workspace>;
}

function LanguageExercise() {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [exerciseId, setExerciseId] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const { solved, markSolved } = useSolvedExercises('automates-mpi-language-solved-v3', languageExercises.length);
  const exercise = languageExercises[exerciseId - 1];

  const restart = () => {
    setNodes([{ id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: '0', initial: true } }]);
    setEdges([]);
    setFeedback(null);
  };

  const selectExercise = (id: number) => {
    setExerciseId(id);
    restart();
  };

  const check = () => {
    const result = compareLanguage(nodes, edges, exercise);
    if (result.equivalent) {
      setFeedback({ ok: true, text: 'Correct : les deux langages sont égaux.' });
      markSolved(exercise.id);
      return;
    }
    const word = result.word || 'ε';
    setFeedback({
      ok: false,
      text: `Contre-exemple : « ${word} » est ${result.studentAccepts ? 'accepté par votre automate, mais pas par le langage demandé' : 'refusé par votre automate, mais appartient au langage demandé'}.`,
    });
  };
  return <Editor defaultSymbol={exercise.alphabet[0]} sidebarContent={<ExercisePanel exercise={exercise} exercises={languageExercises} solved={solved} feedback={feedback} onSelect={selectExercise} onRestart={restart} onCheck={check} pickerId="language-exercise" />} />;
}

function RegexExercise() {
  const [exerciseId, setExerciseId] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [regex, setRegex] = useState('');
  const { solved, markSolved } = useSolvedExercises('automates-mpi-regex-solved-v2', regexExercises.length);
  const exercise = regexExercises[exerciseId - 1];
  const routedEdges = useRoutedEdges(exercise.edges);

  const restart = () => {
    setRegex('');
    setFeedback(null);
  };
  const selectExercise = (id: number) => {
    setExerciseId(id);
    setRegex('');
    setFeedback(null);
  };
  const check = () => {
    try {
      const result = compareRegex(parseRegex(regex, exercise.alphabet), parseRegex(exercise.answer, exercise.alphabet), exercise.alphabet);
      const word = result.equivalent ? '' : result.word || 'ε';
      if (result.equivalent) {
        setFeedback({ ok: true, text: 'Correct : votre expression reconnaît exactement le langage de l’automate.' });
        markSolved(exercise.id);
      } else {
        setFeedback({ ok: false, text: `Contre-exemple : « ${word} » est ${result.leftAccepts ? 'accepté par votre expression, mais refusé par l’automate' : 'refusé par votre expression, mais accepté par l’automate'}.` });
      }
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Expression non reconnue.' });
    }
  };
  const sidebar = <ExercisePanel exercise={exercise} exercises={regexExercises} solved={solved} feedback={feedback} onSelect={selectExercise} onRestart={restart} onCheck={check} pickerId="regex-exercise" showLanguageDetails={false}>
    <RegexAnswer id="automaton-regex" value={regex} onChange={(value) => { setRegex(value); setFeedback(null); }} onCheck={check} />
  </ExercisePanel>;
  return <Workspace sidebar={sidebar} canvasClassName="readonly-canvas">
    <div className="canvas-status"><span>Automate en lecture seule</span></div>
    <ReactFlow<StateNode, Edge>
      key={exercise.id}
      nodes={exercise.nodes}
      edges={routedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.28 }}
      minZoom={0.4}
      maxZoom={1.8}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cdd6ce" />
      <Controls showInteractive={false} position="top-right" />
    </ReactFlow>
  </Workspace>;
}

function LanguageRegexExercise() {
  const [exerciseId, setExerciseId] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [regex, setRegex] = useState('');
  const { solved, markSolved } = useSolvedExercises('automates-mpi-language-regex-solved-v1', languageRegexExercises.length);
  const exercise = languageRegexExercises[exerciseId - 1];
  const restart = () => { setRegex(''); setFeedback(null); };
  const selectExercise = (id: number) => { setExerciseId(id); setRegex(''); setFeedback(null); };
  const check = () => {
    try {
      const result = compareRegexToLanguage(parseRegex(regex, exercise.alphabet), exercise);
      const word = result.equivalent ? '' : result.word || 'ε';
      if (result.equivalent) {
        setFeedback({ ok: true, text: 'Correct : votre expression reconnaît exactement le langage décrit.' });
        markSolved(exercise.id);
      } else {
        setFeedback({ ok: false, text: `Contre-exemple : « ${word} » est ${result.studentAccepts ? 'accepté par votre expression, mais n’appartient pas au langage décrit' : 'refusé par votre expression, mais appartient au langage décrit'}.` });
      }
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Expression non reconnue.' });
    }
  };
  return <section className="standalone-workspace">
    <div className="standalone-exercise-card">
      <ExercisePanel exercise={exercise} exercises={languageRegexExercises} solved={solved} feedback={feedback} onSelect={selectExercise} onRestart={restart} onCheck={check} pickerId="language-regex-exercise">
        <RegexAnswer id="language-regex" value={regex} onChange={(value) => { setRegex(value); setFeedback(null); }} onCheck={check} />
      </ExercisePanel>
    </div>
  </section>;
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return <div className={`feedback ${ok ? 'success' : 'failure'}`}>{ok ? <Check /> : <X />}<span>{text}</span></div>;
}

export default function AutomataApp() {
  const [section, setSection] = useState<Section>('language');
  const nav = [
    ['language', 'Langage → automate'],
    ['language-regex', 'Langage → expression'],
    ['regex', 'Automate → expression'],
  ] as const;
  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand-button" onClick={() => setSection('language')}><AutomatonLogo /><span className="brand-copy"><strong>Automates</strong><span>MP · MPI</span></span></button>
          <nav aria-label="Sections principales">{nav.map(([id, label]) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>)}</nav>
          <div className="topbar-actions">
            <a href="https://mpi-lamartin.github.io/mpi-info" target="_blank" rel="noreferrer">MPI</a>
            <a className="icon-link" href="https://github.com/fortierq/automates" target="_blank" rel="noreferrer" aria-label="Code source sur GitHub"><Github /></a>
          </div>
        </header>
        {section === 'language' && <LanguageExercise />}
        {section === 'language-regex' && <LanguageRegexExercise />}
        {section === 'regex' && <RegexExercise />}
      </main>
    </ReactFlowProvider>
  );
}
