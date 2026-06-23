import { useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, useInternalNode } from '@xyflow/react';
import { getEdgeParams } from './floating.js';
import { HighlightContext } from './highlight.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DIR = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 };          // p/ dentro do nó
const OUT = { left: Math.PI, right: 0, top: -Math.PI / 2, bottom: Math.PI / 2 };           // p/ fora do nó
const ALONG = { left: [0, 1], right: [0, 1], top: [1, 0], bottom: [1, 0] };                // ao longo do lado do nó

const center = (node) => ({
  x: node.internals.positionAbsolute.x + node.measured.width / 2,
  y: node.internals.positionAbsolute.y + node.measured.height / 2,
});

export default function FloatingEdge({ id, source, target, data }) {
  const { active } = useContext(HighlightContext);
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s?.measured?.width || !t?.measured?.width) return null;

  const { value, count, neg, srcColor, baseW, bend = 0 } = data;

  const isHi = active && (source === active || target === active);
  const dim = active && !isHi;

  let stroke, w, labelColor, op;
  if (dim) {
    stroke = '#e3e6ea'; w = clamp(baseW * 0.6, 0.8, 3); labelColor = '#cfd3d9'; op = 0.5;
  } else if (isHi) {
    stroke = srcColor; w = clamp(baseW * 1.5, 1.8, 6.5); labelColor = srcColor; op = 1;
  } else {
    stroke = '#cbd0d8'; w = baseW; labelColor = '#9aa1ac'; op = 1;
  }

  const label = `${value >= 0 ? '+' : ''}${value.toFixed(2)} · ${count}`;

  // ---- self-loop (X → X): laço acima do nó, a geometria flutuante não se aplica ----
  if (source === target) {
    const W = s.measured.width, H = s.measured.height;
    const nx = s.internals.positionAbsolute.x;
    const ny = s.internals.positionAbsolute.y;
    const ox = nx + W * 0.60, oy = ny;          // sai pelo topo (direita)
    const ax = nx + W * 0.40, ay = ny;          // volta pelo topo (esquerda)
    const lift = 70, spread = 48;               // altura/abertura do laço
    const dir = Math.PI / 2;                     // seta desce de volta ao nó
    const L = clamp(w * 1.6 + 5, 8, 16);
    const hw = L * 0.42;
    const ex = ax - L * Math.cos(dir), ey = ay - L * Math.sin(dir);
    const px = Math.cos(dir + Math.PI / 2), py = Math.sin(dir + Math.PI / 2);
    const arrow = `${ax},${ay} ${ex + hw * px},${ey + hw * py} ${ex - hw * px},${ey - hw * py}`;
    const path = `M ${ox},${oy} C ${ox + spread},${oy - lift} ${ax - spread},${ay - lift} ${ex},${ey}`;
    const labelX = (ox + ax) / 2, labelY = oy - lift - 4;
    return (
      <>
        <BaseEdge
          id={id}
          path={path}
          style={{ stroke, strokeWidth: w, strokeDasharray: neg ? '7 5' : undefined, opacity: op }}
        />
        <polygon points={arrow} fill={stroke} opacity={op} style={{ pointerEvents: 'none' }} />
        {!dim && (
          <EdgeLabelRenderer>
            <div
              className={`edge-label ${isHi ? 'hi' : ''}`}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                color: labelColor,
              }}
            >
              {label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }

  const r = getEdgeParams(s, t);
  const { sourcePos, targetPos } = r;

  // ---- separação garantida (sem cruzar) dos pares bidirecionais ----
  // lado canônico da reta entre os centros (mesmo p/ as duas irmãs); o sinal manda
  // uma p/ "cima" e a outra p/ "baixo". Desloco a ponta AO LONGO da borda na direção
  // desse lado (seta continua no nó) e arqueio o meio p/ o mesmo lado.
  let sx = r.sx, sy = r.sy, tx = r.tx, ty = r.ty, bowx = 0, bowy = 0, dirx = 0, diry = 0;
  const fwd = source < target;
  if (bend) {
    const cs = center(s), ct = center(t);
    const cdx = fwd ? ct.x - cs.x : cs.x - ct.x;
    const cdy = fwd ? ct.y - cs.y : cs.y - ct.y;
    const plen = Math.hypot(cdx, cdy) || 1;
    dirx = (-cdy / plen) * (fwd ? 1 : -1);   // direção do lado desta aresta
    diry = (cdx / plen) * (fwd ? 1 : -1);
    const aS = ALONG[sourcePos] || [0, 0];
    const aT = ALONG[targetPos] || [0, 0];
    // desloca a ponta ao longo da borda pela PROJEÇÃO da direção do lado (robusto
    // quando o lado fica quase paralelo à reta — não joga pro lado errado)
    const offS = bend * (aS[0] * dirx + aS[1] * diry);
    const offT = bend * (aT[0] * dirx + aT[1] * diry);
    sx = r.sx + aS[0] * offS; sy = r.sy + aS[1] * offS;
    tx = r.tx + aT[0] * offT; ty = r.ty + aT[1] * offT;
    bowx = dirx * bend; bowy = diry * bend;   // bow só no controle da ORIGEM (seta limpa)
  }

  // ponta no nó; a linha termina na BASE da seta (junção limpa)
  const dir = targetPos in DIR ? DIR[targetPos] : Math.atan2(ty - sy, tx - sx);
  const L = clamp(w * 1.6 + 5, 8, 16);
  const hw = L * 0.42;
  const ex = tx - L * Math.cos(dir);
  const ey = ty - L * Math.sin(dir);
  const px = Math.cos(dir + Math.PI / 2);
  const py = Math.sin(dir + Math.PI / 2);
  const arrow = `${tx},${ty} ${ex + hw * px},${ey + hw * py} ${ex - hw * px},${ey - hw * py}`;

  // cúbica: controles saem pela lateral do nó (curva suave) + arqueamento pro lado
  const dx = ex - sx, dy = ey - sy;
  const dist = Math.hypot(dx, dy) || 1;
  const c = Math.min(0.32 * dist, 130);
  const so = sourcePos in OUT ? OUT[sourcePos] : Math.atan2(dy, dx);
  const to = targetPos in OUT ? OUT[targetPos] : Math.atan2(-dy, -dx);
  const c1x = sx + Math.cos(so) * c + bowx, c1y = sy + Math.sin(so) * c + bowy;
  const c2x = ex + Math.cos(to) * c, c2y = ey + Math.sin(to) * c;   // sem bow → linha chega reta na seta
  const path = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`;

  // base do label SEM o arqueamento (bow): os dois irmãos partem ~do mesmo ponto,
  // e a separação fica 100% sob controle do bloco abaixo (sem o bow cancelar/somar).
  let labelX = 0.125 * sx + 0.375 * (c1x - bowx) + 0.375 * c2x + 0.125 * ex;
  let labelY = 0.125 * sy + 0.375 * (c1y - bowy) + 0.375 * c2y + 0.125 * ey;
  // par bidirecional: separo os dois labels SEMPRE no eixo vertical (um acima, outro
  // abaixo) — é o que evita sobreposição de texto em qualquer orientação. O sentido
  // vertical acompanha o lado p/ onde a aresta arqueia (sign(diry)); quando a aresta
  // é ~vertical o lado é horizontal (diry≈0) e não separaria em Y, então desempato
  // por sentido (fwd, oposto p/ cada irmã). Um leve deslocamento horizontal (dirx)
  // evita empilhar os dois no mesmo X nas arestas verticais.
  if (bend) {
    const vdir = Math.abs(diry) > 0.5 ? Math.sign(diry) : (fwd ? 1 : -1);
    labelX += dirx * 8;
    labelY += vdir * 14;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke, strokeWidth: w, strokeDasharray: neg ? '7 5' : undefined, opacity: op }}
      />
      <polygon points={arrow} fill={stroke} opacity={op} style={{ pointerEvents: 'none' }} />
      {!dim && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label ${isHi ? 'hi' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: labelColor,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
