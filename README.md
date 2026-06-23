# react_cbmg — CBMG PMI interativo (React + React Flow)

App web em **React + React Flow** para explorar o CBMG (PMI) por cluster, com nós
desenhados como **cards** (nome + barra de sentimento neg/neu/pos no rodapé) e um
**seletor de cluster** (visualiza um cluster por vez).

Usa **só os resultados já existentes** — não toca nos notebooks. Os dados saem de:
- `data/topic_modeling_externo_sem_autoras/contagens_clusters.json` (transições por cluster)
- `data/topic_modeling_externo_sem_autoras/sentimento_por_macro.csv` (sentimento por macro)

## Como rodar

```bash
cd react_cbmg
python prep_data.py        # gera public/cbmg_data.json a partir dos resultados existentes
npm install
npm run dev                # abre em http://localhost:5173
```

> Se rerodar os notebooks e os resultados mudarem, rode `python prep_data.py` de novo
> para atualizar o `public/cbmg_data.json`.

## O que dá pra fazer

- **Cluster**: dropdown troca o cluster exibido (um por vez).
- **Métrica**: PMI ou npmi.
- **Contagem mínima**: corta transições raras (PMI fica ruidoso com poucas contagens).
- **Só positivas**: mostra só associações acima do acaso ("logo depois de X → Y");
  desmarque para incluir as evitações (negativas, em vermelho tracejado).
- **Hover** num nó destaca as entradas e saídas dele (com os valores); **clique** fixa;
  clique no fundo para soltar.
- Cada nó é um card: borda verde = interno, âmbar = externo; o **rodapé** é a barra de
  sentimento (vermelho neg · cinza neu · verde pos), com os % e tooltip.

## Estrutura

| Arquivo | Papel |
|---|---|
| `prep_data.py` | Lê os resultados existentes, computa PMI/npmi por cluster, gera `public/cbmg_data.json`. |
| `src/App.jsx` | Estado, controles, layout por força e o realce hover/clique. |
| `src/SentimentNode.jsx` | Nó-card (nome + barra de sentimento). |
| `src/FloatingEdge.jsx` + `src/floating.js` | Arestas flutuantes (centro→centro, recorte na borda). |
| `src/layout.js` | Layout `d3-force` (internos à esquerda, externos à direita). |
| `src/styles.css` | Estilos (painel + card). |

## Por que React Flow

Diferente do `vis-network` (canvas, nós fechados), aqui o nó **é um componente React**:
o card com rodapé de sentimento é só HTML/CSS (`overflow:hidden` + `border-radius`
arredondam o rodapé de graça), sem os hacks de canvas que precisamos no notebook.
