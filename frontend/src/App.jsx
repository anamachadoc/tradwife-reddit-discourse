import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import MacroNode from './MacroNode.jsx';
import FloatingEdge from './FloatingEdge.jsx';
import { computeLayout } from './layout.js';
import { HighlightContext } from './highlight.js';

const nodeTypes = { macro: MacroNode };
const edgeTypes = { floating: FloatingEdge };

// cor estável por macro (matiz HSV espaçado) — colore as arestas pela origem
function hsv(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  const hx = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
  return '#' + hx(r) + hx(g) + hx(b);
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export default function App() {
  const [data, setData] = useState(null);
  const [cluster, setCluster] = useState('0');
  const [metric, setMetric] = useState('pmi');
  const [minCount, setMinCount] = useState(3);
  const [onlySignif, setOnlySignif] = useState(true);
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [includeSelf, setIncludeSelf] = useState(false);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}cbmg_data_g.json`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error('falha ao carregar cbmg_data_g.json', e));
  }, []);

  const internosSet = useMemo(() => new Set(data?.nos_internos || []), [data]);

  const colorMap = useMemo(() => {
    if (!data) return {};
    const internos = [...data.nos_internos].sort();
    const externos = [...new Set(
      Object.values(data.clusters)
        .flatMap(({ edges }) => edges.flatMap(({ from, to }) => [from, to])),
    )].filter((m) => !internosSet.has(m)).sort();
    const all = [...internos, ...externos];
    const map = {};
    all.forEach((m, i) => { map[m] = hsv(i / all.length, 0.58, 0.66); });
    return map;
  }, [data, internosSet]);

  const visibleEdges = useMemo(() => {
    if (!data) return [];
    const raw = data.clusters[cluster]?.edges || [];
    const isSelf = (e) => e.self ?? (e.from === e.to);
    // dois modos de inclusão: significância (G²/Fisher + FDR) OU contagem mínima
    return raw.filter((e) =>
      (includeSelf || !isSelf(e)) &&
      (onlySignif ? e.signif : e.count >= minCount) &&
      (!onlyPositive || e[metric] > 0));
  }, [data, cluster, minCount, onlySignif, onlyPositive, includeSelf, metric]);

  const nodeIds = useMemo(() => {
    const s = new Set();
    visibleEdges.forEach((e) => { s.add(e.from); s.add(e.to); });
    return [...s];
  }, [visibleEdges]);

  const positions = useMemo(
    () => computeLayout(nodeIds, visibleEdges, internosSet),
    [nodeIds, visibleEdges, internosSet],
  );

  // ---- monta nós/arestas UMA vez por cluster/filtro (não muda no hover → sem tremor, drag preservado) ----
  const builtNodes = useMemo(() => {
    if (!data) return [];
    return nodeIds.map((id) => ({
      id,
      type: 'macro',
      position: { x: (positions[id]?.x || 0) - 101, y: (positions[id]?.y || 0) - 30 },
      data: {
        label: id,
        lado: internosSet.has(id) ? 'interno' : 'externo',
      },
    }));
  }, [data, nodeIds, positions, internosSet]);

  const builtEdges = useMemo(() => {
    const scale = metric === 'npmi' ? 6 : 0.7;
    const present = new Set(visibleEdges.map((e) => e.from + ' >> ' + e.to));
    return visibleEdges.map((e, i) => {
      const v = e[metric];
      const neg = v < 0;
      const reverse = present.has(e.to + ' >> ' + e.from);   // existe a aresta inversa?
      return {
        id: 'e' + i,
        source: e.from,
        target: e.to,
        type: 'floating',
        data: {
          value: v,
          count: e.count,
          neg,
          srcColor: neg ? '#c0392b' : colorMap[e.from] || '#999',
          baseW: clamp(0.9 + Math.abs(v) * scale, 0.9, 5),
          bend: reverse ? 13 : 0,                              // separa pares bidirecionais
        },
      };
    });
  }, [visibleEdges, metric, colorMap]);

  useEffect(() => { setNodes(builtNodes); }, [builtNodes, setNodes]);
  useEffect(() => { setEdges(builtEdges); }, [builtEdges, setEdges]);

  // z-order (só mexe no zIndex → não re-mede, sem tremor): esmaecidos no fundo;
  // nós conectados/selecionado por cima; arestas destacadas acima dos esmaecidos,
  // atrás dos cards conectados.
  useEffect(() => {
    const a = pinned ?? hover;
    const conn = (() => {
      if (!a) return null;
      const sset = new Set([a]);
      visibleEdges.forEach((e) => {
        if (e.from === a) sset.add(e.to);
        if (e.to === a) sset.add(e.from);
      });
      return sset;
    })();
    setNodes((nds) => nds.map((n) => {
      const isDim = conn && !conn.has(n.id);
      return { ...n, zIndex: isDim ? 0 : n.id === pinned ? 11 : 10 };
    }));
    setEdges((eds) => eds.map((e) => {
      const isHi = a && (e.source === a || e.target === a);
      return { ...e, zIndex: isHi ? 5 : a ? 1 : 4 };
    }));
  }, [hover, pinned, visibleEdges, setNodes, setEdges]);

  // ---- estado de destaque (vai via context; não recria os arrays) ----
  const active = pinned ?? hover;
  const connected = useMemo(() => {
    if (!active) return null;
    const s = new Set([active]);
    visibleEdges.forEach((e) => {
      if (e.from === active) s.add(e.to);
      if (e.to === active) s.add(e.from);
    });
    return s;
  }, [active, visibleEdges]);

  const hl = useMemo(() => ({ active, connected, pinned }), [active, connected, pinned]);

  if (!data) return <div className="loading">Carregando cbmg_data_g.json…</div>;

  const clusterKeys = Object.keys(data.clusters).sort((a, b) => +a - +b);

  return (
    <div className="app">
      <aside className="panel">
        <h1>CBMG · PMI</h1>
        <p className="muted">sem autoras — logo depois de falar de X, ela fala de Y</p>

        <label className="field">
          <span>Cluster</span>
          <select value={cluster} onChange={(e) => { setCluster(e.target.value); setPinned(null); setHover(null); }}>
            {clusterKeys.map((k) => (
              <option key={k} value={k}>
                Cluster {k} · {data.clusters[k].n_trans.toLocaleString('pt-BR')} transições
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Métrica</span>
          <div className="seg-toggle">
            <button className={metric === 'pmi' ? 'on' : ''} onClick={() => setMetric('pmi')}>PMI</button>
            <button className={metric === 'npmi' ? 'on' : ''} onClick={() => setMetric('npmi')}>npmi</button>
          </div>
        </label>

        <label className="check">
          <input type="checkbox" checked={onlySignif} onChange={(e) => setOnlySignif(e.target.checked)} />
          <span>só significativas (G²/Fisher, q ≤ {data.alpha ?? 0.05})</span>
        </label>

        <label className="field" style={{ opacity: onlySignif ? 0.4 : 1 }}>
          <span>Contagem mínima: {minCount}{onlySignif ? ' · ignorada no modo significância' : ''}</span>
          <input type="range" min="1" max="50" value={minCount} disabled={onlySignif} onChange={(e) => setMinCount(+e.target.value)} />
        </label>

        <label className="check">
          <input type="checkbox" checked={onlyPositive} onChange={(e) => setOnlyPositive(e.target.checked)} />
          <span>só associações positivas (acima do acaso)</span>
        </label>

        <label className="check">
          <input type="checkbox" checked={includeSelf} onChange={(e) => setIncludeSelf(e.target.checked)} />
          <span>incluir self-loops (ela continua no mesmo macro: X → X)</span>
        </label>

        <div className="legend">
          <div className="lg"><span className="dot int" /> Interno (borda verde)</div>
          <div className="lg"><span className="dot ext" /> Externo (borda âmbar)</div>
          <div className="lg muted">hover destaca entradas e saídas; clique fixa; arraste reposiciona</div>
          <div className="lg muted">{visibleEdges.length} arestas · {nodeIds.length} nós</div>
        </div>
      </aside>

      <div className="canvas">
        <HighlightContext.Provider value={hl}>
          <ReactFlow
            key={cluster}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.1}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
            onNodeMouseEnter={(_, n) => setHover(n.id)}
            onNodeMouseLeave={() => setHover(null)}
            onNodeClick={(_, n) => setPinned((p) => (p === n.id ? null : n.id))}
            onPaneClick={() => setPinned(null)}
          >
            <Background color="#dfe2e8" gap={24} size={1} />
            <MiniMap pannable zoomable maskColor="rgba(246,247,249,0.7)"
                     nodeColor={(n) => (n.data?.lado === 'interno' ? '#9fd6b0' : '#f1cf86')} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </HighlightContext.Provider>
      </div>
    </div>
  );
}
