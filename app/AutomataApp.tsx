'use client';

import {
  addEdge,
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
  HelpCircle,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type StateData, type StateNode, useGraphStore } from './automataStore';

type Mode = 'select' | 'state' | 'edge';
type Section = 'draw' | 'language' | 'regex' | 'methods';

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
  const loop = source === target;
  const [regularPath, regularLabelX, regularLabelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const path = loop
    ? `M ${sourceX} ${sourceY} C ${sourceX + 62} ${sourceY - 92}, ${targetX - 62} ${targetY - 92}, ${targetX} ${targetY}`
    : regularPath;
  const labelX = loop ? (sourceX + targetX) / 2 : regularLabelX;
  const labelY = loop ? Math.min(sourceY, targetY) - 67 : regularLabelY - 18;

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
        <span className={`edge-label ${selected ? 'is-selected' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>
          {String(label ?? '')}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { state: State };
const edgeTypes = { automaton: AutomatonEdge };

const words = (alphabet: string[], maxLength: number) => {
  const result = [''];
  let level = [''];
  for (let i = 1; i <= maxLength; i += 1) {
    level = level.flatMap((prefix) => alphabet.map((letter) => prefix + letter));
    result.push(...level);
  }
  return result;
};

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

function equivalentRegex(left: RegexAst, right: RegexAst) {
  const queue: Array<[RegexAst, RegexAst]> = [[left, right]];
  const seen = new Set<string>();
  while (queue.length) {
    const [a, b] = queue.shift()!;
    const pairKey = `${keyOf(a)}=${keyOf(b)}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    if (nullable(a) !== nullable(b)) return false;
    if (seen.size > 1000) throw new Error('Expression trop complexe pour une correction instantanée.');
    ['a', 'b'].forEach((symbol) => queue.push([derivative(a, symbol), derivative(b, symbol)]));
  }
  return true;
}

function Editor() {
  const { nodes, edges, setNodes, setEdges, reset } = useGraphStore();
  const [mode, setMode] = useState<Mode>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [alphabet, setAlphabet] = useState('a, b');
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
    setMode('select');
  }, [nodes, setNodes]);

  const onNodeClick: NodeMouseHandler<StateNode> = (_, node) => {
    if (mode === 'edge') {
      if (!edgeSource) setEdgeSource(node.id);
      else {
        const id = `${edgeSource}-${node.id}-${Date.now()}`;
        setEdges(addEdge({ id, source: edgeSource, target: node.id, label: alphabet.split(',')[0]?.trim() || 'a', type: 'automaton', markerEnd: { type: MarkerType.ArrowClosed } }, edges));
        setSelectedEdgeId(id);
        setSelectedNodeId(null);
        setEdgeSource(null);
        setMode('select');
      }
      return;
    }
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setPanel('properties');
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const deterministic = useMemo(() => {
    const seen = new Set<string>();
    if (nodes.filter((node) => node.data.initial).length !== 1) return false;
    return edges.every((edge) => String(edge.label ?? '').split(',').every((label) => {
      const key = `${edge.source}:${label.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }, [edges, nodes]);

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
    <section className="workspace">
      <aside className="tool-panel">
        <div className="eyebrow">Construction</div>
        <h1>Dessiner un automate</h1>
        <p className="muted">Ajoutez des états, reliez-les, puis sélectionnez tout élément pour le modifier.</p>
        <div className="tool-grid compact">
          <Tool active={mode === 'select'} icon={<MousePointer2 />} label="Sélection" onClick={() => { setMode('select'); setEdgeSource(null); }} />
          <Tool active={mode === 'state'} icon={<Plus />} label="État" onClick={() => setMode('state')} />
          <Tool active={mode === 'edge'} icon={<ArrowRight />} label={edgeSource ? 'Cible…' : 'Transition'} onClick={() => { setMode('edge'); setEdgeSource(null); }} />
        </div>
        <label className="field-label" htmlFor="alphabet">Alphabet</label>
        <input className="text-input mono" id="alphabet" value={alphabet} onChange={(event) => setAlphabet(event.target.value)} />
        <div className="tip-box"><Sparkles /><span>{mode === 'edge' && edgeSource ? 'Choisissez l’état d’arrivée — le même état créera une boucle.' : 'Sélectionnez une transition pour modifier sa lettre.'}</span></div>
      </aside>

      <section className={`canvas-wrap ${mode !== 'select' ? 'is-creating' : ''}`} aria-label="Plan de travail de l’automate">
        <div className="canvas-status"><span>{notice}</span></div>
        <ReactFlow<StateNode, Edge>
          nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }))}
          edges={edges.map((edge) => ({ ...edge, type: 'automaton', selected: edge.id === selectedEdgeId, markerEnd: { type: MarkerType.ArrowClosed, color: edge.id === selectedEdgeId ? '#246b49' : '#33423a' } }))}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(instance) => { flow.current = instance; }}
          onNodesChange={(changes) => setNodes(applyNodeChanges(changes, nodes) as StateNode[])}
          onEdgesChange={(changes) => setEdges(applyEdgeChanges(changes, edges))}
          onConnect={(connection: Connection) => setEdges(addEdge({ ...connection, label: alphabet.split(',')[0]?.trim() || 'a', type: 'automaton', markerEnd: { type: MarkerType.ArrowClosed } }, edges))}
          onNodeClick={onNodeClick}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); setPanel('properties'); setMode('select'); }}
          onPaneClick={(event) => { setSelectedNodeId(null); setSelectedEdgeId(null); if (mode === 'state' || event.detail === 2) addState(event.clientX, event.clientY); }}
          onNodesDelete={(deleted) => { if (deleted.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null); }}
          onEdgesDelete={(deleted) => { if (deleted.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null); }}
          fitView minZoom={0.3} maxZoom={2} deleteKeyCode={['Backspace', 'Delete']}
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
          ) : <div className="empty-selection"><div className="empty-icon"><MousePointer2 /></div><strong>Aucune sélection</strong><p>Sélectionnez un état ou une transition pour le modifier.</p></div>
        ) : (
          <div className="test-panel">
            <span className="eyebrow">Mot à reconnaître</span>
            <div className="test-row"><input className="text-input mono" value={testWord} placeholder="abba" onChange={(event) => { setTestWord(event.target.value); setTestResult(null); }} /><button className="square-button" onClick={test} aria-label="Tester le mot"><Play /></button></div>
            {testResult !== null && <div className={`result-box ${testResult ? 'success' : 'failure'}`}>{testResult ? <Check /> : <X />}<span><strong>{testResult ? 'Mot accepté' : 'Mot refusé'}</strong><small>{testWord || 'ε'} termine {testResult ? '' : 'pas '}dans un état final.</small></span></div>}
          </div>
        )}
        <div className="export-card"><span className="eyebrow">Exporter</span><h2>Prêt pour votre copie</h2><p>Code TikZ compatible avec la bibliothèque <code>automata</code>.</p><div className="export-actions"><button className="primary" onClick={copyLatex}><Clipboard /> Copier le LaTeX</button><button className="secondary-square" onClick={downloadLatex} aria-label="Télécharger le fichier LaTeX"><Download /></button></div></div>
      </aside>

      <div className="statusbar"><span>{nodes.length} état{nodes.length > 1 ? 's' : ''}</span><span>{edges.length} transition{edges.length > 1 ? 's' : ''}</span><span className={deterministic ? 'status-ok' : ''}>{deterministic ? 'Déterministe' : 'Non déterministe'}</span><button onClick={() => reset(true)}><RotateCcw /> Effacer</button></div>
    </section>
  );
}

function Tool({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`tool ${active ? 'active' : ''}`} onClick={onClick}><span className="tool-icon">{icon}</span>{label}</button>;
}

function LanguageExercise({ onOpenEditor }: { onOpenEditor: () => void }) {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const start = () => {
    setNodes([{ id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: 'q₀', initial: true } }]);
    setEdges([]);
    setFeedback(null);
    onOpenEditor();
  };
  const check = () => {
    const mismatch = words(['a', 'b'], 5).find((word) => accepts(nodes, edges, word) !== word.endsWith('a'));
    setFeedback(mismatch === undefined ? { ok: true, text: 'Correct sur tous les mots de longueur ≤ 5. La structure attendue est bien présente.' } : { ok: false, text: `À revoir : le mot ${mismatch || 'ε'} devrait être ${mismatch.endsWith('a') ? 'accepté' : 'refusé'}.` });
  };
  return <ExerciseLayout title="Construire un automate à partir d’un langage." progress="Langage → automate">
    <article className="prompt-card"><span className="number">01</span><span className="difficulty">Essentiel</span><h2>Mots se terminant par a</h2><p>Dessinez un automate déterministe sur Σ = {'{a, b}'} qui reconnaît les mots <strong>se terminant par a</strong>.</p><div className="examples"><span>Acceptés <code>a</code> <code>ba</code> <code>abba</code></span><span>Refusés <code>ε</code> <code>b</code> <code>aab</code></span></div><button className="primary wide" onClick={start}>Dessiner la solution <ArrowRight /></button></article>
    <article className="answer-card"><span className="eyebrow">Votre construction actuelle</span><div className="mini-stats"><span><strong>{nodes.length}</strong> états</span><span><strong>{edges.length}</strong> transitions</span></div><p>La vérification compare le langage obtenu sur tous les mots de longueur au plus 5.</p><button className="outline-button" onClick={check}><Check /> Vérifier l’automate</button>{feedback && <Feedback {...feedback} />}</article>
  </ExerciseLayout>;
}

function RegexExercise() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [regex, setRegex] = useState('');
  const check = () => {
    try {
      const ok = equivalentRegex(parseRegex(regex), parseRegex('ab'));
      setFeedback(ok ? { ok: true, text: 'Exact : cette expression reconnaît le même langage, même si sa forme est différente.' } : { ok: false, text: 'Cette expression ne reconnaît pas exactement le même langage que l’automate.' });
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
  return <section className="exercise-page"><div className="exercise-head"><div><span className="eyebrow">Entraînement guidé</span><h1>{title}</h1><p>Une consigne courte, avec une correction immédiate et utile.</p></div><div className="progress-pill">{progress}</div></div><div className="exercise-grid">{children}</div></section>;
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
          <a className="help-link" href="https://fr.wikipedia.org/wiki/Automate_fini" target="_blank" rel="noreferrer"><HelpCircle /><span>Aide</span></a>
        </header>
        {section === 'draw' && <Editor />}
        {section === 'language' && <LanguageExercise onOpenEditor={() => setSection('draw')} />}
        {section === 'regex' && <RegexExercise />}
        {section === 'methods' && <Methods />}
      </main>
    </ReactFlowProvider>
  );
}
