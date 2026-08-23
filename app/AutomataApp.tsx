'use client';

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDot,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StateData, type StateNode, useGraphStore } from './automataStore';

type Mode = 'select' | 'state' | 'edge' | 'final';
type Section = 'sandbox' | 'exercises' | 'methods';

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

const nodeTypes = { state: State };

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
      const labels = String(edge.label ?? '').split(',').map((label) => label.trim());
      if (current.has(edge.source) && labels.includes(symbol)) next.add(edge.target);
    });
    current = next;
  }
  return nodes.some((node) => node.data.final && current.has(node.id));
}

function toLatex(nodes: StateNode[], edges: Edge[]) {
  const nodeLines = nodes.map((node) => {
    const options = ['state', node.data.initial && 'initial', node.data.final && 'accepting'].filter(Boolean).join(', ');
    const x = (node.position.x / 100).toFixed(1);
    const y = (-node.position.y / 100).toFixed(1);
    return `  \\node[${options}] (${node.id}) at (${x},${y}) {$${node.data.label}$};`;
  });
  const edgeLines = edges.map((edge) => {
    const bend = edge.source === edge.target ? '[loop above]' : '';
    return `    (${edge.source}) edge${bend} node {$${String(edge.label ?? '').replaceAll(',', ',\\,')}$} (${edge.target})`;
  });
  return [
    '\\begin{tikzpicture}[shorten >=1pt, node distance=2cm, on grid, auto]',
    ...nodeLines,
    '  \\path[->]',
    ...edgeLines.map((line, index) => `${line}${index === edgeLines.length - 1 ? ';' : ''}`),
    '\\end{tikzpicture}',
  ].join('\n');
}

function Sandbox() {
  const { nodes, edges, setNodes, setEdges, reset } = useGraphStore();
  const [mode, setMode] = useState<Mode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [alphabet, setAlphabet] = useState('a, b');
  const [testWord, setTestWord] = useState('abb');
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [panel, setPanel] = useState<'properties' | 'test'>('properties');
  const [notice, setNotice] = useState('Enregistré localement');
  const flow = useRef<ReactFlowInstance<StateNode, Edge> | null>(null);

  const toggleNode = useCallback((id: string, field: 'initial' | 'final') => {
    setNodes(nodes.map((node) => ({
      ...node,
      data: { ...node.data, [field]: field === 'initial' ? (node.id === id ? !node.data.initial : false) : node.id === id ? !node.data.final : node.data.final },
    })));
  }, [nodes, setNodes]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedId || ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;
      if (event.key.toLowerCase() === 'f') toggleNode(selectedId, 'final');
      if (event.key.toLowerCase() === 'i') toggleNode(selectedId, 'initial');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, toggleNode]);

  const addState = useCallback((clientX: number, clientY: number) => {
    const position = flow.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? { x: 260, y: 220 };
    const used = new Set(nodes.map((node) => node.id));
    let index = 0;
    while (used.has(`q${index}`)) index += 1;
    setNodes([...nodes, { id: `q${index}`, type: 'state', position, data: { label: `q${index}` } }]);
    setMode('select');
  }, [nodes, setNodes]);

  const onNodeClick: NodeMouseHandler<StateNode> = (_, node) => {
    if (mode === 'final') {
      toggleNode(node.id, 'final');
      setMode('select');
      return;
    }
    if (mode === 'edge') {
      if (!edgeSource) setEdgeSource(node.id);
      else {
        setEdges(addEdge({ source: edgeSource, target: node.id, label: alphabet.split(',')[0]?.trim() || 'a', markerEnd: { type: MarkerType.ArrowClosed }, type: 'smoothstep' }, edges));
        setEdgeSource(null);
        setMode('select');
      }
      return;
    }
    setSelectedId(node.id);
    setPanel('properties');
  };

  const selectedNode = nodes.find((node) => node.id === selectedId);
  const deterministic = useMemo(() => {
    const seen = new Set<string>();
    if (nodes.filter((node) => node.data.initial).length !== 1) return false;
    return edges.every((edge) => {
      const key = `${edge.source}:${String(edge.label).trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        <p className="muted">Ajoutez des états puis reliez-les. Le dessin reste sur cet appareil.</p>
        <div className="tool-grid">
          <Tool active={mode === 'select'} icon={<MousePointer2 />} label="Sélection" onClick={() => { setMode('select'); setEdgeSource(null); }} />
          <Tool active={mode === 'state'} icon={<Plus />} label="État" onClick={() => setMode('state')} />
          <Tool active={mode === 'edge'} icon={<ArrowRight />} label={edgeSource ? 'Cible…' : 'Transition'} onClick={() => { setMode('edge'); setEdgeSource(null); }} />
          <Tool active={mode === 'final'} icon={<CircleDot />} label="Final" onClick={() => setMode('final')} />
        </div>
        <label className="field-label" htmlFor="alphabet">Alphabet</label>
        <input className="text-input mono" id="alphabet" value={alphabet} onChange={(event) => setAlphabet(event.target.value)} />
        <div className="tip-box"><Sparkles /><span>{mode === 'edge' && edgeSource ? 'Choisissez maintenant l’état d’arrivée.' : 'Double-cliquez dans le plan pour créer rapidement un état.'}</span></div>
        <div className="shortcut-list"><div><kbd>⌫</kbd><span>Supprimer</span></div><div><kbd>F</kbd><span>État final</span></div><div><kbd>I</kbd><span>État initial</span></div></div>
      </aside>

      <section className={`canvas-wrap ${mode !== 'select' ? 'is-creating' : ''}`} aria-label="Plan de travail de l’automate">
        <div className="canvas-status"><span>{notice}</span></div>
        <ReactFlow<StateNode, Edge>
          nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedId }))}
          edges={edges.map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed, color: '#33423a' }, style: { stroke: '#33423a', strokeWidth: 1.6 }, labelStyle: { fontFamily: 'var(--font-geist-mono)', fontSize: 12 } }))}
          nodeTypes={nodeTypes}
          onInit={(instance) => { flow.current = instance; }}
          onNodesChange={(changes) => setNodes(applyNodeChanges(changes, nodes) as StateNode[])}
          onEdgesChange={(changes) => setEdges(applyEdgeChanges(changes, edges))}
          onConnect={(connection: Connection) => setEdges(addEdge({ ...connection, label: alphabet.split(',')[0]?.trim() || 'a', markerEnd: { type: MarkerType.ArrowClosed } }, edges))}
          onNodeClick={onNodeClick}
          onPaneClick={(event) => { setSelectedId(null); if (mode === 'state' || event.detail === 2) addState(event.clientX, event.clientY); }}
          onNodesDelete={(deleted) => { if (deleted.some((node) => node.id === selectedId)) setSelectedId(null); }}
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
              <button className="danger-link" onClick={() => { setNodes(nodes.filter((node) => node.id !== selectedNode.id)); setEdges(edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)); setSelectedId(null); }}><Trash2 /> Supprimer l’état</button>
            </div>
          ) : <div className="empty-selection"><div className="empty-icon"><MousePointer2 /></div><strong>Aucune sélection</strong><p>Sélectionnez un état pour modifier son nom et son rôle.</p></div>
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

function Exercises({ onOpenSandbox }: { onOpenSandbox: () => void }) {
  const { nodes, edges, setNodes, setEdges } = useGraphStore();
  const [exercise, setExercise] = useState<'language' | 'regex'>('language');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [regex, setRegex] = useState('');

  const startLanguageExercise = () => {
    setNodes([{ id: 'q0', type: 'state', position: { x: 180, y: 200 }, data: { label: 'q₀', initial: true } }]);
    setEdges([]);
    setFeedback(null);
    onOpenSandbox();
  };

  const checkCurrentGraph = () => {
    const mismatch = words(['a', 'b'], 4).find((word) => accepts(nodes, edges, word) !== word.endsWith('a'));
    setFeedback(mismatch === undefined ? { ok: true, text: 'Correct sur tous les mots de longueur ≤ 4. La structure attendue est bien présente.' } : { ok: false, text: `À revoir : le mot ${mismatch || 'ε'} devrait être ${mismatch.endsWith('a') ? 'accepté' : 'refusé'}.` });
  };

  const checkRegex = () => {
    const normalized = regex.replaceAll(' ', '').replaceAll('·', '').replaceAll('ε', '');
    const ok = ['a*b', '(a)*b'].includes(normalized);
    setFeedback(ok ? { ok: true, text: 'Exact : zéro ou plusieurs a, puis un unique b.' } : { ok: false, text: 'Pas encore. Observez la boucle sur a avant la transition b.' });
  };

  return (
    <section className="exercise-page">
      <div className="exercise-head"><div><span className="eyebrow">Entraînement guidé</span><h1>Passer d’un langage à un automate — et inversement.</h1><p>Deux formats courts, avec une correction immédiate et utile.</p></div><div className="progress-pill">Série découverte · 2 exercices</div></div>
      <div className="exercise-tabs"><button className={exercise === 'language' ? 'active' : ''} onClick={() => { setExercise('language'); setFeedback(null); }}>01 · Langage → automate</button><button className={exercise === 'regex' ? 'active' : ''} onClick={() => { setExercise('regex'); setFeedback(null); }}>02 · Automate → expression</button></div>
      {exercise === 'language' ? (
        <div className="exercise-grid">
          <article className="prompt-card"><span className="number">01</span><span className="difficulty">Essentiel</span><h2>Construire l’automate</h2><p>Dessinez un automate déterministe sur Σ = {'{a, b}'} qui reconnaît les mots <strong>se terminant par a</strong>.</p><div className="examples"><span>Acceptés <code>a</code> <code>ba</code> <code>abba</code></span><span>Refusés <code>ε</code> <code>b</code> <code>aab</code></span></div><button className="primary wide" onClick={startLanguageExercise}>Ouvrir dans le bac à sable <ArrowRight /></button></article>
          <article className="answer-card"><span className="eyebrow">Votre construction actuelle</span><div className="mini-stats"><span><strong>{nodes.length}</strong> états</span><span><strong>{edges.length}</strong> transitions</span></div><p>La vérification compare le langage obtenu sur tous les mots de longueur au plus 4.</p><button className="outline-button" onClick={checkCurrentGraph}><Check /> Vérifier l’automate</button>{feedback && <Feedback {...feedback} />}</article>
        </div>
      ) : (
        <div className="exercise-grid">
          <article className="prompt-card"><span className="number">02</span><span className="difficulty">Essentiel</span><h2>Donner une expression régulière</h2><p>L’automate part de q₀, boucle sur <code>a</code>, puis lit <code>b</code> pour atteindre l’unique état final q₁.</p><div className="mini-automaton"><span className="mini-loop">a</span><span className="mini-node initial">q₀</span><span className="mini-edge">b →</span><span className="mini-node final">q₁</span></div></article>
          <article className="answer-card"><label htmlFor="regex">Votre expression</label><input id="regex" className="regex-input" value={regex} onChange={(event) => { setRegex(event.target.value); setFeedback(null); }} placeholder="Ex. (a+b)*" /><p>Notation acceptée : <code>+</code> pour l’union, <code>*</code> pour l’étoile.</p><button className="outline-button" onClick={checkRegex}><Check /> Vérifier l’expression</button>{feedback && <Feedback {...feedback} />}</article>
        </div>
      )}
    </section>
  );
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
  const [section, setSection] = useState<Section>('sandbox');
  return (
    <ReactFlowProvider>
      <main className="app-shell">
        <header className="topbar">
          <button className="brand-button" onClick={() => setSection('sandbox')}><span className="brand-mark">A</span><span className="brand-copy"><strong>Automates</strong><span>MP · MPI</span></span></button>
          <nav aria-label="Sections principales"><button className={`nav-item ${section === 'sandbox' ? 'active' : ''}`} onClick={() => setSection('sandbox')}>Bac à sable</button><button className={`nav-item ${section === 'exercises' ? 'active' : ''}`} onClick={() => setSection('exercises')}>Exercices</button><button className={`nav-item ${section === 'methods' ? 'active' : ''}`} onClick={() => setSection('methods')}>Méthodes</button></nav>
          <a className="help-link" href="https://fr.wikipedia.org/wiki/Automate_fini" target="_blank" rel="noreferrer"><HelpCircle /><span>Aide</span></a>
        </header>
        {section === 'sandbox' && <Sandbox />}
        {section === 'exercises' && <Exercises onOpenSandbox={() => setSection('sandbox')} />}
        {section === 'methods' && <Methods />}
      </main>
    </ReactFlowProvider>
  );
}
