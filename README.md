# Grafo de Transições Temáticas Interativo

Aplicação React para explorar, por cluster, as transições entre macrotemas do
discurso em `r/tradwives`. O grafo mostra macrotemas internos e externos e as
associações entre eles calculadas com PMI/nPMI.

Cada aresta `X → Y` representa uma transição observada de `X` para `Y` no
conjunto analisado. O valor de PMI indica se a transição ocorreu mais ou menos
do que o esperado ao acaso; ele não estabelece causalidade.

## Executar a aplicação

Pré-requisitos:

- Node.js 18 ou superior;
- npm.

O repositório já contém o arquivo de dados usado pela interface. Para iniciar o
ambiente de desenvolvimento:

```bash
npm ci
npm run dev
```

Abra o endereço mostrado pelo Vite — normalmente
[`http://localhost:5173`](http://localhost:5173).

Para gerar uma versão de produção:

```bash
npm run build
npm run preview
```

O build é produzido em `dist/`.

## Controles da interface

- **Cluster** seleciona o conjunto de transições exibido.
- **Métrica** alterna entre PMI e nPMI.
- **Só significativas** mostra apenas associações que passam na correção
  Benjamini-Hochberg/FDR (`q ≤ 0,05`). Ao desmarcar, a **contagem mínima** passa
  a controlar o filtro.
- **Só associações positivas** oculta transições com PMI/nPMI negativo.
- **Incluir self-loops** exibe transições de um macrotema para ele próprio.
- Passar o mouse sobre um nó destaca suas entradas e saídas; clicar fixa o
  destaque; arrastar reposiciona o nó.

Os nós verdes representam macrotemas internos e os amarelos, macrotemas externos.

## Atualizar os dados do grafo

Esta etapa é opcional para executar o frontend. Use-a apenas quando
`contagens_clusters.json` tiver sido atualizado.

Além do Node.js, ela requer Python 3 e SciPy:

```bash
python3 -m pip install scipy
python3 prep_data_g.py
```

O script lê o arquivo abaixo e regrava `public/cbmg_data_g.json`:

```text
../data/topic_modeling_externo_sem_autoras/contagens_clusters.json
```

O caminho é relativo à raiz deste projeto: o diretório `data` deve ser irmão do
diretório do repositório. O arquivo gerado contém somente rótulos de macrotemas,
contagens agregadas e métricas estatísticas; não inclui análise de sentimento.

## Estrutura principal

| Arquivo | Responsabilidade |
|---|---|
| `src/App.jsx` | Estado, filtros, criação do grafo e interações. |
| `src/MacroNode.jsx` | Cartão visual de cada macrotema. |
| `src/FloatingEdge.jsx` e `src/floating.js` | Desenho e rótulos das arestas. |
| `src/layout.js` | Layout por força com `d3-force`. |
| `src/styles.css` | Estilos da interface. |
| `prep_data_g.py` | Gera os dados agregados com PMI/nPMI e testes de significância. |
| `public/cbmg_data_g.json` | Dados consumidos pelo frontend. |

## Dados e privacidade

O frontend usa apenas resultados agregados. Dados brutos eventualmente usados
para gerar `contagens_clusters.json` ficam fora deste repositório, no diretório
`../data`, e devem ser tratados conforme as regras de privacidade aplicáveis.
