import { createContext } from 'react';

// Estado de destaque compartilhado com nós e arestas SEM mexer nos arrays do
// React Flow (evita re-medição/tremor no hover e preserva o arraste).
export const HighlightContext = createContext({
  active: null,
  connected: null,
  pinned: null,
});
