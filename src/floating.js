// Cálculo dos pontos de conexão de uma aresta "flutuante" (centro→centro,
// recortando na borda do nó). Adaptado do exemplo oficial do React Flow v12.
import { Position } from '@xyflow/react';

function getNodeIntersection(intersectionNode, targetNode) {
  const { width, height } = intersectionNode.measured;
  const posA = intersectionNode.internals.positionAbsolute;
  const posB = targetNode.internals.positionAbsolute;

  const w = width / 2;
  const h = height / 2;
  const x2 = posA.x + w;
  const y2 = posA.y + h;
  const x1 = posB.x + targetNode.measured.width / 2;
  const y1 = posB.y + targetNode.measured.height / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;
  return { x, y };
}

function getEdgePosition(node, point) {
  const n = node.internals.positionAbsolute;
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + node.measured.width - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + node.measured.height - 1) return Position.Bottom;
  return Position.Top;
}

export function getEdgeParams(source, target) {
  const sp = getNodeIntersection(source, target);
  const tp = getNodeIntersection(target, source);
  return {
    sx: sp.x,
    sy: sp.y,
    tx: tp.x,
    ty: tp.y,
    sourcePos: getEdgePosition(source, sp),
    targetPos: getEdgePosition(target, tp),
  };
}
