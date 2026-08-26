'use client';

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeProps,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Menu,
  MousePointer2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StateData, type StateNode, useGraphStore } from './automataStore';

type Section = 'language' | 'regex' | 'methods';
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

function MathText({ children }: { children: string }) {
  return <span className="math" dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { throwOnError: false }) }} />;
}

function State({ data, selected }: { data: StateData; selected?: boolean }) {
  return (
    <div className={`flow-state ${data.final ? 'is-final' : ''} ${selected ? 'is-selected' : ''}`}>
      {data.initial && <span className="initial-marker">→</span>}
      <Handle type="target" position={Position.Left} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function AutomatonEdge(props: EdgeProps<Edge>) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, label, selected } = props;
  const data = (props.data ?? {}) as EdgeRouteData;
  const loop = source === target;
  const offset = data.routeOffset ?? 0;
  const [regularPath, regularLabelX, regularLabelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  let path = regularPath;
  let labelX = regularLabelX;
  let labelY = regularLabelY - 18;
  if (loop) {
    path = `M ${sourceX} ${sourceY} C ${sourceX + 62 + offset / 2} ${sourceY - 92 - offset}, ${targetX - 62 - offset / 2} ${targetY - 92 - offset}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = Math.min(sourceY, targetY) - 67 - offset;
  } else if (offset !== 0) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.hypot(dx, dy) || 1;
    const controlX = (sourceX + targetX) / 2 - (dy / length) * offset;
    const controlY = (sourceY + targetY) / 2 + (dx / length) * offset;
    path = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY}, ${targetX} ${targetY}`;
    labelX = (sourceX + 2 * controlX + targetX) / 4;
    labelY = (sourceY + 2 * controlY + targetY) / 4 - 16;
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
  { id: 1, title: 'Mot vide', prompt: 'Reconnaître le mot vide.', alphabet: alphabetAB, accepted: [''], rejected: ['a', 'b', 'ab'], initial: 'start', isFinal: (state) => state === 'start', transition: () => 'dead' },
  { id: 2, title: 'Le mot a uniquement', prompt: 'Reconnaître uniquement le mot a.', alphabet: alphabetAB, accepted: ['a'], rejected: ['', 'b', 'aa'], initial: 'start', isFinal: (state) => state === 'a', transition: (state, symbol) => state === 'start' && symbol === 'a' ? 'a' : 'dead' },
  { id: 3, title: 'Se terminer par a', prompt: 'Reconnaître les mots qui se terminent par a.', alphabet: alphabetAB, accepted: ['a', 'ba', 'abba'], rejected: ['', 'b', 'aab'], initial: 'no', isFinal: (state) => state === 'a', transition: (_, symbol) => symbol === 'a' ? 'a' : 'no' },
  { id: 4, title: 'Commencer par b', prompt: 'Reconnaître les mots qui commencent par b.', alphabet: alphabetAB, accepted: ['b', 'ba', 'bbaa'], rejected: ['', 'a', 'ab'], initial: 'start', isFinal: (state) => state === 'yes', transition: (state, symbol) => state === 'start' ? (symbol === 'b' ? 'yes' : 'no') : state },
  { id: 5, title: 'Contenir ab', prompt: 'Reconnaître les mots qui contiennent le facteur ab.', alphabet: alphabetAB, accepted: ['ab', 'aab', 'baba'], rejected: ['', 'a', 'bbaa'], initial: '0', isFinal: (state) => state === '2', transition: (state, symbol) => state === '2' ? '2' : state === '1' && symbol === 'b' ? '2' : symbol === 'a' ? '1' : '0' },
  { id: 6, title: 'Un nombre pair de a', prompt: 'Reconnaître les mots contenant un nombre pair de lettres a.', alphabet: alphabetAB, accepted: ['', 'bb', 'aa', 'abba'], rejected: ['a', 'ba', 'aaa'], initial: 'even', isFinal: (state) => state === 'even', transition: (state, symbol) => symbol === 'a' ? (state === 'even' ? 'odd' : 'even') : state },
  { id: 7, title: 'Aucun facteur bb', prompt: 'Reconnaître les mots qui ne contiennent jamais deux b consécutifs.', alphabet: alphabetAB, accepted: ['', 'a', 'bab', 'ababa'], rejected: ['bb', 'abb', 'bba'], initial: 'ok', isFinal: (state) => state !== 'dead', transition: (state, symbol) => state === 'dead' ? 'dead' : symbol === 'a' ? 'ok' : state === 'b' ? 'dead' : 'b' },
  { id: 8, title: 'Exactement deux a', prompt: 'Reconnaître les mots contenant exactement deux lettres a.', alphabet: alphabetAB, accepted: ['aa', 'aba', 'bbaab'], rejected: ['', 'a', 'aaa'], initial: '0', isFinal: (state) => state === '2', transition: (state, symbol) => symbol === 'b' ? state : String(Math.min(3, Number(state) + 1)) },
  { id: 9, title: 'Parités combinées', prompt: 'Reconnaître les mots ayant un nombre pair de a et un nombre impair de b.', alphabet: alphabetAB, accepted: ['b', 'aab', 'baabb'], rejected: ['', 'a', 'bb', 'ab'], initial: '00', isFinal: (state) => state === '01', transition: (state, symbol) => symbol === 'a' ? `${1 - Number(state[0])}${state[1]}` : `${state[0]}${1 - Number(state[1])}` },
  { id: 10, title: 'Contenir aba et bab', prompt: 'Reconnaître les mots qui contiennent à la fois les facteurs aba et bab.', alphabet: alphabetAB, accepted: ['abab', 'baba', 'aababb'], rejected: ['', 'aba', 'bab', 'abba'], initial: '0|', isFinal: (state) => state.startsWith('3|'), transition: (state, symbol) => { const [rawMask, suffix] = state.split('|'); const word = suffix + symbol; const mask = Number(rawMask) | (word.endsWith('aba') ? 1 : 0) | (word.endsWith('bab') ? 2 : 0); return `${mask}|${word.slice(-2)}`; } },
  { id: 11, title: 'Multiples de trois en binaire', prompt: 'Reconnaître les écritures binaires non vides des entiers divisibles par trois. Les zéros initiaux sont autorisés.', alphabet: ['0', '1'], accepted: ['0', '11', '110', '1001'], rejected: ['', '1', '10', '101'], initial: 'start', isFinal: (state) => state === 'r0', transition: (state, symbol) => { const remainder = state === 'start' ? 0 : Number(state[1]); return `r${(remainder * 2 + Number(symbol)) % 3}`; } },
  { id: 12, title: 'Jamais trois bits identiques', prompt: 'Reconnaître les mots binaires ne contenant ni 000 ni 111 comme facteur.', alphabet: ['0', '1'], accepted: ['', '0011', '01010', '1100'], rejected: ['000', '111', '10001'], initial: 'start', isFinal: (state) => state !== 'dead', transition: (state, symbol) => { if (state === 'dead' || state === symbol.repeat(2)) return 'dead'; return state.endsWith(symbol) ? symbol.repeat(2) : symbol; } },
  { id: 13, title: 'Séparateur assorti', prompt: 'Reconnaître les mots contenant exactement un #, avec le même symbole juste avant et juste après #.', alphabet: ['0', '1', '#'], accepted: ['0#0', '101#1', '10#01'], rejected: ['#0', '0#', '0#1', '0#0#0'], initial: 'left-none', isFinal: (state) => state === 'ok', transition: (state, symbol) => { if (state === 'dead') return 'dead'; if (state === 'ok') return symbol === '#' ? 'dead' : 'ok'; if (state === 'need-0' || state === 'need-1') return symbol === state.at(-1) ? 'ok' : 'dead'; if (symbol === '#') return state === 'left-none' ? 'dead' : `need-${state.at(-1)}`; return `left-${symbol}`; } },
  { id: 14, title: 'Trois parités synchronisées', prompt: 'Reconnaître les mots où les nombres de a, de b et de c ont tous la même parité.', alphabet: ['a', 'b', 'c'], accepted: ['', 'abc', 'aabbcc', 'abccba'], rejected: ['a', 'ab', 'abbc'], initial: '000', isFinal: (state) => state === '000' || state === '111', transition: (state, symbol) => { const index = ['a', 'b', 'c'].indexOf(symbol); return state.split('').map((bit, position) => position === index ? String(1 - Number(bit)) : bit).join(''); } },
  { id: 15, title: 'Congruence croisée modulo cinq', prompt: 'Reconnaître les mots tels que le nombre de a soit congru au double du nombre de b modulo cinq.', alphabet: alphabetAB, accepted: ['', 'aab', 'bbbbb', 'aaaaa'], rejected: ['a', 'b', 'ab', 'aabb'], initial: '0', isFinal: (state) => state === '0', transition: (state, symbol) => String((Number(state) + (symbol === 'a' ? 1 : 3)) % 5) },
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
  const edgeLines = edges.map((edge) => `    (${edge.source}) edge${edge.source === edge.target ? '[loop above]' : ''} node {$${String(edge.label ?? '').replaceAll(',', ',\\,')}$} (${edge.target})`);
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
  constructor(private readonly source: string) {}
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
    if (token === 'a' || token === 'b') return { kind: 'literal', value: token };
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

function parseRegex(source: string) {
  const normalized = source.replaceAll(/\s|·/g, '').replaceAll('+', '|');
  if (!normalized) throw new Error('Saisissez une expression.');
  return new RegexParser(normalized).parse();
}

function compareRegex(left: RegexAst, right: RegexAst) {
  const queue: Array<[RegexAst, RegexAst, string]> = [[left, right, '']];
  const seen = new Set<string>();
  while (queue.length) {
    const [a, b, word] = queue.shift()!;
    const pairKey = `${keyOf(a)}=${keyOf(b)}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    if (nullable(a) !== nullable(b)) return { equivalent: false, word, leftAccepts: nullable(a) };
    if (seen.size > 1000) throw new Error('Expression trop complexe pour une correction instantanée.');
    ['a', 'b'].forEach((symbol) => queue.push([derivative(a, symbol), derivative(b, symbol), word + symbol]));
  }
  return { equivalent: true };
}

function Editor({ sidebarContent, defaultSymbol = 'a' }: { sidebarContent?: React.ReactNode; defaultSymbol?: string }) {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState('Enregistré localement');
  const flow = useRef<ReactFlowInstance<StateNode, Edge> | null>(null);

  const toggleNode = useCallback((id: string, field: 'initial' | 'final') => {
    setNodes(nodes.map((node) => ({ ...node, data: { ...node.data, [field]: field === 'initial' ? (node.id === id ? !node.data.initial : false) : node.id === id ? !node.data.final : node.data.final } })));
  }, [nodes, setNodes]);

  const addState = useCallback((clientX: number, clientY: number) => {
    const position = flow.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? { x: 260, y: 220 };
    const used = new Set(nodes.map((node) => node.id));
    let index = 0;
    while (used.has(`q${index}`)) index += 1;
    setNodes([...nodes, { id: `q${index}`, type: 'state', position, data: { label: `q${index}` } }]);
  }, [nodes, setNodes]);

  const onNodeClick: NodeMouseHandler<StateNode> = (_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const routedEdges = useMemo(() => edges.map((edge) => {
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
      data: {
        ...edge.data,
        routeOffset,
      },
    };
  }), [edges, selectedEdgeId]);
  const copyLatex = async () => {
    await navigator.clipboard.writeText(toLatex(nodes, edges));
    setNotice('LaTeX copié');
    window.setTimeout(() => setNotice('Enregistré localement'), 1800);
  };

  const downloadLatex = () => {
    const url = URL.createObjectURL(new Blob([toLatex(nodes, edges)], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'automate.tex';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="workspace">
      <section className="canvas-wrap" aria-label="Plan de travail de l’automate">
        <button className="sidebar-toggle" aria-controls="editor-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu /><span>Ouvrir le panneau</span></button>
        <div className="canvas-status"><span>{notice}</span></div>
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
          fitView minZoom={0.3} maxZoom={2} deleteKeyCode={['Backspace', 'Delete']} defaultEdgeOptions={{ type: 'automaton' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cdd6ce" />
          <Controls showInteractive={false} position="top-right" />
        </ReactFlow>
      </section>

      <button className={`sidebar-backdrop ${sidebarOpen ? 'is-visible' : ''}`} aria-label="Fermer le panneau" onClick={() => setSidebarOpen(false)} />
      <aside id="editor-sidebar" className={`side-panel ${sidebarOpen ? 'is-open' : ''}`}>
        <button className="sidebar-close" aria-label="Fermer le panneau" onClick={() => setSidebarOpen(false)}><X /></button>
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
          ) : <div className="empty-selection"><div className="empty-icon"><MousePointer2 /></div><strong>Créer et modifier</strong><p>Double-cliquez pour ajouter un état, puis reliez ses poignées pour créer une transition.</p></div>}
        </div>
        <div className="export-actions sidebar-export"><button className="primary" onClick={copyLatex}><Clipboard /> Copier le LaTeX</button><button className="secondary-square" onClick={downloadLatex} aria-label="Télécharger le fichier LaTeX"><Download /></button></div>
      </aside>

    </section>
  );
}

function LanguageExercise() {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [exerciseId, setExerciseId] = useState(1);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  const [solved, setSolved] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const exercise = languageExercises[exerciseId - 1];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('automates-mpi-language-solved') ?? '[]');
        if (Array.isArray(saved)) setSolved([...new Set(saved.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= languageExercises.length))]);
      } catch { /* Une progression invalide est simplement ignorée. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const restart = () => {
    setNodes([{ id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: 'q₀', initial: true } }]);
    setEdges([]);
    setFeedback(null);
  };

  const selectExercise = (id: number) => {
    setExerciseId(id);
    setExerciseMenuOpen(false);
    restart();
  };

  const check = () => {
    const result = compareLanguage(nodes, edges, exercise);
    if (result.equivalent) {
      setFeedback({ ok: true, text: 'Correct : les deux langages sont égaux.' });
      if (!solved.includes(exercise.id)) {
        const next = [...solved, exercise.id].sort((a, b) => a - b);
        setSolved(next);
        localStorage.setItem('automates-mpi-language-solved', JSON.stringify(next));
      }
      return;
    }
    const word = result.word || 'ε';
    setFeedback({
      ok: false,
      text: `Contre-exemple : « ${word} » est ${result.studentAccepts ? 'accepté par votre automate, mais pas par le langage demandé' : 'refusé par votre automate, mais appartient au langage demandé'}.`,
    });
  };
  const showWord = (word: string) => word ? <MathText>{word.replaceAll('#', '\\#')}</MathText> : <MathText>{'\\varepsilon'}</MathText>;
  return <Editor defaultSymbol={exercise.alphabet[0]} sidebarContent={<section className="language-task">
    <label htmlFor="language-exercise">Exercice</label>
    <div className="exercise-picker" onKeyDown={(event) => { if (event.key === 'Escape') setExerciseMenuOpen(false); }}>
      <button id="language-exercise" className={`exercise-picker-trigger ${solved.includes(exercise.id) ? 'is-solved' : ''}`} aria-haspopup="listbox" aria-expanded={exerciseMenuOpen} onClick={() => setExerciseMenuOpen((open) => !open)}><span>{String(exercise.id).padStart(2, '0')} — {exercise.title}</span><ChevronDown /></button>
      {exerciseMenuOpen && <div className="exercise-picker-menu" role="listbox" aria-label="Choisir un exercice">{languageExercises.map((item) => <button key={item.id} role="option" aria-selected={item.id === exercise.id} className={`${solved.includes(item.id) ? 'is-solved' : ''} ${item.id === exercise.id ? 'is-current' : ''}`} onClick={() => selectExercise(item.id)}><span>{String(item.id).padStart(2, '0')}</span>{item.title}</button>)}</div>}
    </div>
    <h2>{exercise.title}</h2>
    <p>{exercise.prompt}</p>
    <div className="language-data"><section><strong>Alphabet</strong><div className="math-chips">{exercise.alphabet.map((symbol) => <span className="math-chip" key={symbol}>{showWord(symbol)}</span>)}</div></section><section><strong>Exemples de mots</strong><div className="example-row"><span>Acceptés</span><div className="math-chips">{exercise.accepted.map((word, index) => <span className="math-chip accepted" key={`${word}-${index}`}>{showWord(word)}</span>)}</div></div><div className="example-row"><span>Refusés</span><div className="math-chips">{exercise.rejected.map((word, index) => <span className="math-chip rejected" key={`${word}-${index}`}>{showWord(word)}</span>)}</div></div></section></div>
    {feedback && <Feedback {...feedback} />}
    <div className="exercise-buttons"><button className="ghost-button" onClick={restart}><RotateCcw /> Recommencer</button><button className="primary" onClick={check}><Check /> Vérifier</button><button className="ghost-button next-exercise" disabled={exerciseId === languageExercises.length} onClick={() => selectExercise(exerciseId + 1)}>Exercice suivant <ArrowRight /></button></div>
  </section>} />;
}

function RegexExercise() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [regex, setRegex] = useState('');
  const check = () => {
    try {
      const result = compareRegex(parseRegex(regex), parseRegex('ab'));
      const word = result.equivalent ? '' : result.word || 'ε';
      setFeedback(result.equivalent
        ? { ok: true, text: 'Correct.' }
        : { ok: false, text: `Contre-exemple : « ${word} » est ${result.leftAccepts ? 'accepté par votre expression, mais refusé par l’automate' : 'refusé par votre expression, mais accepté par l’automate'}.` });
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Expression non reconnue.' });
    }
  };
  return <ExerciseLayout title="Retrouver une expression régulière équivalente." progress="Automate → expression">
    <article className="prompt-card"><span className="number">02</span><span className="difficulty">Essentiel</span><h2>Donner une expression régulière</h2><p>L’automate lit <MathText>a</MathText> de <MathText>{'q_0'}</MathText> à <MathText>{'q_1'}</MathText>, puis <MathText>b</MathText> pour atteindre l’unique état final <MathText>{'q_2'}</MathText>.</p><div className="mini-automaton three"><span className="mini-node initial"><MathText>{'q_0'}</MathText></span><span className="mini-edge"><MathText>a</MathText> →</span><span className="mini-node"><MathText>{'q_1'}</MathText></span><span className="mini-edge"><MathText>b</MathText> →</span><span className="mini-node final"><MathText>{'q_2'}</MathText></span></div></article>
    <article className="answer-card"><label htmlFor="regex">Votre expression</label><input id="regex" className="regex-input" value={regex} onChange={(event) => { setRegex(event.target.value); setFeedback(null); }} placeholder="Ex. (a|a)b" /><p>Notation : <MathText>{'\\mid'}</MathText> ou <MathText>+</MathText> pour l’union, <MathText>*</MathText>, <MathText>{'\\varepsilon'}</MathText> et parenthèses. La correction compare les langages, pas le texte.</p><button className="outline-button" onClick={check}><Check /> Vérifier l’expression</button>{feedback && <Feedback {...feedback} />}</article>
  </ExerciseLayout>;
}

function ExerciseLayout({ title, progress, children }: { title: string; progress: string; children: React.ReactNode }) {
  return <section className="exercise-page"><div className="exercise-head"><div><span className="eyebrow">Entraînement guidé</span><h1>{title}</h1></div><div className="progress-pill">{progress}</div></div><div className="exercise-grid">{children}</div></section>;
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return <div className={`feedback ${ok ? 'success' : 'failure'}`}>{ok ? <Check /> : <X />}<span>{text}</span></div>;
}

function Methods() {
  return <section className="methods-page"><div className="methods-intro"><span className="eyebrow">Bientôt</span><h1>Les algorithmes du cours, étape par étape.</h1><p>Chaque méthode sera manipulable visuellement, avec contrôle de chaque étape.</p></div><div className="method-grid">{[
    ['01', 'Déterminisation', 'Construire les états comme ensembles d’états.'],
    ['02', 'Automate de Glushkov', 'Passer d’une expression régulière à un automate.'],
    ['03', 'Élimination des états', 'Retrouver une expression régulière depuis un automate.'],
  ].map(([number, title, text]) => <article key={number}><span>{number}</span><BookOpen /><h2>{title}</h2><p>{text}</p><small>En préparation</small></article>)}</div></section>;
}

export default function AutomataApp() {
  const [section, setSection] = useState<Section>('language');
  const nav = [
    ['language', 'Langage → automate'],
    ['regex', 'Automate → expression'],
    ['methods', 'Méthodes'],
  ] as const;
  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand-button" onClick={() => setSection('language')}><span className="brand-mark">A</span><span className="brand-copy"><strong>Automates</strong><span>MP · MPI</span></span></button>
          <nav aria-label="Sections principales">{nav.map(([id, label]) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>)}</nav>
        </header>
        {section === 'language' && <LanguageExercise />}
        {section === 'regex' && <RegexExercise />}
        {section === 'methods' && <Methods />}
      </main>
    </ReactFlowProvider>
  );
}
