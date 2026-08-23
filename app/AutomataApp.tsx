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
import {
  ArrowRight,
  BookOpen,
  Check,
  Clipboard,
  Download,
  MousePointer2,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type StateData, type StateNode, useGraphStore } from './automataStore';

type Section = 'draw' | 'language' | 'regex' | 'methods';
type EdgeRouteData = {
  routeOffset?: number;
};

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
    const x = (sourceX + targetX) / 2;
    const y = (sourceY + targetY) / 2 + offset;
    path = `M ${sourceX} ${sourceY} Q ${x} ${y}, ${targetX} ${targetY}`;
    labelX = x;
    labelY = y / 2 + (sourceY + targetY) / 4 - 16;
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

function accepts(nodes: StateNode[], edges: Edge[], word: string) {
  let current = new Set(nodes.filter((node) => node.data.initial).map((node) => node.id));
  for (const symbol of word) {
    const next = new Set<string>();
    edges.forEach((edge) => {
      const labels = String(edge.label ?? '').split(',').map((item) => item.trim());
      if (current.has(edge.source) && labels.includes(symbol)) next.add(edge.target);
    });
    current = next;
  }
  return nodes.some((node) => node.data.final && current.has(node.id));
}

function compareWithWordsEndingInA(nodes: StateNode[], edges: Edge[]) {
  const alphabet = ['a', 'b'];
  const initialStates = nodes.filter((node) => node.data.initial).map((node) => node.id).sort();
  const queue = [{ states: initialStates, targetAccepts: false, word: '' }];
  const visited = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const key = `${current.states.join(',')}|${current.targetAccepts}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const studentAccepts = nodes.some((node) => node.data.final && current.states.includes(node.id));
    if (studentAccepts !== current.targetAccepts) {
      return { equivalent: false as const, word: current.word, studentAccepts };
    }

    for (const symbol of alphabet) {
      const sources = new Set(current.states);
      const states = [...new Set(edges
        .filter((edge) => sources.has(edge.source) && String(edge.label ?? '').split(',').map((item) => item.trim()).includes(symbol))
        .map((edge) => edge.target))].sort();
      queue.push({ states, targetAccepts: symbol === 'a', word: current.word + symbol });
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
  | { kind: 'empty' | 'epsilon' }
  | { kind: 'literal'; value: string }
  | { kind: 'union' | 'concat'; parts: RegexAst[] }
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

function Editor({ challenge }: { challenge?: React.ReactNode }) {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [testWord, setTestWord] = useState('abb');
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [panel, setPanel] = useState<'properties' | 'test'>('properties');
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
    setPanel('properties');
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const routedEdges = useMemo(() => edges.map((edge) => {
    const siblings = edges.filter((item) => item.source === edge.source && item.target === edge.target);
    const index = siblings.findIndex((item) => item.id === edge.id);
    const routeOffset = edge.source === edge.target ? index * 40 : (index - (siblings.length - 1) / 2) * 64;
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

  const test = () => {
    setTestResult(accepts(nodes, edges, testWord));
    setPanel('test');
  };

  return (
    <section className={`workspace ${challenge ? 'has-challenge' : ''}`}>
      {challenge && <div className="challenge-bar">{challenge}</div>}
      <section className="canvas-wrap" aria-label="Plan de travail de l’automate">
        <div className="canvas-status"><span>{notice}</span></div>
        <ReactFlow<StateNode, Edge>
          nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }))}
          edges={routedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(instance) => { flow.current = instance; }}
          onNodesChange={(changes) => setNodes(applyNodeChanges(changes, nodes) as StateNode[])}
          onEdgesChange={(changes) => setEdges(applyEdgeChanges(changes, edges))}
          onConnect={(connection: Connection) => setEdges([...edges, { ...connection, id: `${connection.source}-${connection.target}-${Date.now()}`, label: 'a', type: 'automaton', markerEnd: { type: MarkerType.ArrowClosed } }])}
          onNodeClick={onNodeClick}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); setPanel('properties'); }}
          onPaneClick={(event) => { setSelectedNodeId(null); setSelectedEdgeId(null); if (event.detail === 2) addState(event.clientX, event.clientY); }}
          onNodesDelete={(deleted) => { if (deleted.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null); }}
          onEdgesDelete={(deleted) => { if (deleted.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null); }}
          fitView minZoom={0.3} maxZoom={2} deleteKeyCode={['Backspace', 'Delete']} defaultEdgeOptions={{ type: 'automaton' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cdd6ce" />
          <Controls showInteractive={false} position="top-right" />
        </ReactFlow>
      </section>

      <aside className="side-panel">
        <div className="tabs"><button className={panel === 'properties' ? 'active' : ''} onClick={() => setPanel('properties')}>Propriétés</button><button className={panel === 'test' ? 'active' : ''} onClick={() => setPanel('test')}>Tester</button></div>
        {panel === 'properties' ? (
          selectedNode ? (
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
              <label htmlFor="edge-label">Lettre(s)</label>
              <input id="edge-label" className="text-input mono" autoFocus value={String(selectedEdge.label ?? '')} onChange={(event) => setEdges(edges.map((edge) => edge.id === selectedEdge.id ? { ...edge, label: event.target.value } : edge))} />
              <p className="transition-summary"><span>{nodes.find((node) => node.id === selectedEdge.source)?.data.label ?? selectedEdge.source}</span><ArrowRight /><span>{nodes.find((node) => node.id === selectedEdge.target)?.data.label ?? selectedEdge.target}</span></p>
              <button className="danger-link" onClick={() => { setEdges(edges.filter((edge) => edge.id !== selectedEdge.id)); setSelectedEdgeId(null); }}><Trash2 /> Supprimer la transition</button>
            </div>
          ) : <div className="empty-selection"><div className="empty-icon"><MousePointer2 /></div><strong>Créer et modifier</strong><p>Double-cliquez pour ajouter un état, puis reliez ses poignées pour créer une transition.</p></div>
        ) : (
          <div className="test-panel">
            <span className="eyebrow">Mot à reconnaître</span>
            <div className="test-row"><input className="text-input mono" value={testWord} placeholder="abba" onChange={(event) => { setTestWord(event.target.value); setTestResult(null); }} /><button className="square-button" onClick={test} aria-label="Tester le mot"><Play /></button></div>
            {testResult !== null && <div className={`result-box ${testResult ? 'success' : 'failure'}`}>{testResult ? <Check /> : <X />}<span><strong>{testResult ? 'Mot accepté' : 'Mot refusé'}</strong><small>{testWord || 'ε'} termine {testResult ? '' : 'pas '}dans un état final.</small></span></div>}
          </div>
        )}
        <div className="export-card"><span className="eyebrow">Exporter</span><h2>Prêt pour votre copie</h2><p>Code TikZ compatible avec la bibliothèque <code>automata</code>.</p><div className="export-actions"><button className="primary" onClick={copyLatex}><Clipboard /> Copier le LaTeX</button><button className="secondary-square" onClick={downloadLatex} aria-label="Télécharger le fichier LaTeX"><Download /></button></div></div>
      </aside>

    </section>
  );
}

function LanguageExercise() {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const restart = () => {
    setNodes([{ id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: 'q₀', initial: true } }]);
    setEdges([]);
    setFeedback(null);
  };
  const check = () => {
    const result = compareWithWordsEndingInA(nodes, edges);
    if (result.equivalent) {
      setFeedback({ ok: true, text: 'Correct : les deux langages sont égaux.' });
      return;
    }
    const word = result.word || 'ε';
    setFeedback({
      ok: false,
      text: `Contre-exemple : « ${word} » est ${result.studentAccepts ? 'accepté par votre automate, mais ne se termine pas par a' : 'refusé par votre automate, alors qu’il se termine par a'}.`,
    });
  };
  return <Editor challenge={<>
    <div className="challenge-copy"><span className="eyebrow">Exercice · Langage → automate</span><strong>Mots sur Σ = {'{a, b}'} se terminant par a</strong><span>Acceptés : <code>a</code>, <code>ba</code>, <code>abba</code> · Refusés : <code>ε</code>, <code>b</code>, <code>aab</code></span></div>
    <div className="challenge-actions">{feedback && <Feedback {...feedback} />}<button className="ghost-button" onClick={restart}><RotateCcw /> Recommencer</button><button className="primary" onClick={check}><Check /> Vérifier l’automate</button></div>
  </>} />;
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
    <article className="prompt-card"><span className="number">02</span><span className="difficulty">Essentiel</span><h2>Donner une expression régulière</h2><p>L’automate lit <code>a</code> de q₀ à q₁, puis <code>b</code> pour atteindre l’unique état final q₂.</p><div className="mini-automaton three"><span className="mini-node initial">q₀</span><span className="mini-edge">a →</span><span className="mini-node">q₁</span><span className="mini-edge">b →</span><span className="mini-node final">q₂</span></div></article>
    <article className="answer-card"><label htmlFor="regex">Votre expression</label><input id="regex" className="regex-input" value={regex} onChange={(event) => { setRegex(event.target.value); setFeedback(null); }} placeholder="Ex. (a|a)b" /><p>Notation : <code>|</code> ou <code>+</code> pour l’union, <code>*</code>, <code>ε</code> et parenthèses. La correction compare les langages, pas le texte.</p><button className="outline-button" onClick={check}><Check /> Vérifier l’expression</button>{feedback && <Feedback {...feedback} />}</article>
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
  const [section, setSection] = useState<Section>('draw');
  const nav = [
    ['draw', 'Dessiner'],
    ['language', 'Langage → automate'],
    ['regex', 'Automate → expression'],
    ['methods', 'Méthodes'],
  ] as const;
  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand-button" onClick={() => setSection('draw')}><span className="brand-mark">A</span><span className="brand-copy"><strong>Automates</strong><span>MP · MPI</span></span></button>
          <nav aria-label="Sections principales">{nav.map(([id, label]) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>)}</nav>
        </header>
        {section === 'draw' && <Editor />}
        {section === 'language' && <LanguageExercise />}
        {section === 'regex' && <RegexExercise />}
        {section === 'methods' && <Methods />}
      </main>
    </ReactFlowProvider>
  );
}
