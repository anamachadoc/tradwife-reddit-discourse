// Layout por força (d3-force): internos puxados p/ esquerda, externos p/ direita.
// Roda a simulação até estabilizar e devolve as posições (centro de cada nó).
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceX,
  forceY,
  forceCollide,
} from 'd3-force';

export function computeLayout(nodeIds, edges, internosSet) {
  if (nodeIds.length === 0) return {};

  // semente determinística (evita o grafo "pular" ao mexer nos filtros):
  // internos à esquerda, externos à direita, espalhados no eixo Y por índice.
  let ni = 0;
  let ne = 0;
  const nInt = nodeIds.filter((id) => internosSet.has(id)).length;
  const nExt = nodeIds.length - nInt;
  const nodes = nodeIds.map((id) => {
    const interno = internosSet.has(id);
    const k = interno ? ni++ : ne++;
    const total = interno ? nInt : nExt;
    return {
      id,
      interno,
      x: interno ? -380 : 380,
      y: (k - (total - 1) / 2) * 90,
    };
  });
  // self-loops (from === to) não entram na força: distância 0 gera NaN no d3-force
  const links = edges
    .filter((e) => e.from !== e.to)
    .map((e) => ({ source: e.from, target: e.to }));

  const sim = forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-2600))
    .force('link', forceLink(links).id((d) => d.id).distance(260).strength(0.12))
    .force('x', forceX((d) => (d.interno ? -380 : 380)).strength(0.14))
    .force('y', forceY(0).strength(0.04))
    .force('collide', forceCollide(135))
    .stop();

  for (let i = 0; i < 450; i++) sim.tick();

  const pos = {};
  nodes.forEach((n) => {
    pos[n.id] = { x: n.x, y: n.y };
  });
  return pos;
}
