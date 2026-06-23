"""
Variante de prep_data.py com PORTEIRO DE SIGNIFICÂNCIA (G²/Fisher + BH-FDR).
Gera public/cbmg_data_g.json — NÃO toca no cbmg_data.json original.

Mesma estrutura do prep_data.py (PMI/npmi por cluster, sem self-loops), mas cada
aresta ganha:
  - q       : q-valor (Benjamini-Hochberg / FDR) da associação i→j
  - teste   : 'g2' (chi2, 1 g.l.) ou 'fisher' (quando alguma célula esperada < 5)
  - signif  : bool, q <= ALPHA

O PMI continua sendo o que se mede (sinal/força); o G²/Fisher só diz quais arestas
têm evidência suficiente — substituindo o corte arbitrário por contagem (min_count).
Emite TODAS as arestas (como o prep_data.py original) para o slider de contagem
seguir funcionando; o React decide se filtra por `signif`/`q` ou por `count`.

Mesma lógica do cbgm_pmi_g.ipynb. Rode:  python prep_data_g.py
"""
import json
import math
from pathlib import Path

from scipy.stats import chi2, fisher_exact

ROOT = Path(__file__).resolve().parents[1]
SA = ROOT / "data" / "topic_modeling_externo_sem_autoras"

ALPHA = 0.05   # nível de FDR (q-valor) para marcar uma aresta como significativa

NOS_INTERNOS = [
    "Identidade tradwife e disputa de definição",
    "Organização material da vida tradicional",
    "Família, maternidade e segurança relacional",
    "Religião, moralidade e tradição cultural",
    "Práticas simbólicas de feminilidade",
    "Comunidade, metadiscurso e recursos",
]


def _bh_fdr(pvals):
    """q-valores Benjamini-Hochberg (FDR), na ordem original dos p-valores."""
    m = len(pvals)
    if m == 0:
        return []
    order = sorted(range(m), key=lambda k: pvals[k])   # p crescente
    q = [0.0] * m
    prev = 1.0
    for rank in range(m, 0, -1):                        # do maior p ao menor (impõe monotonia)
        k = order[rank - 1]
        prev = min(prev, pvals[k] * m / rank)
        q[k] = prev
    return q


def _g2_pvalue(a, b, c, d):
    """G² (log-likelihood ratio) da tabela 2x2 [[a,b],[c,d]] e seu p-valor.
    G² = 2 * sum O*ln(O/E), ~ chi2(1) sob independência (Dunning, 1993).
    Fisher exato quando alguma célula ESPERADA < 5 (regra de Cochran)."""
    n = a + b + c + d
    r1, r2 = a + b, c + d          # totais de linha (origem = i / origem != i)
    k1, k2 = a + c, b + d          # totais de coluna (destino = j / destino != j)
    E = [r1 * k1 / n, r1 * k2 / n, r2 * k1 / n, r2 * k2 / n]
    O = [a, b, c, d]
    g2 = 2 * sum(o * math.log(o / e) for o, e in zip(O, E) if o > 0)
    if min(E) < 5:
        _, p = fisher_exact([[a, b], [c, d]])
        return g2, p, "fisher"
    return g2, chi2.sf(g2, 1), "g2"


def signif_edges(counts, alpha=ALPHA):
    """PMI/npmi de cada transição i→j + significância (G²/Fisher + FDR).
    Emite todas as arestas, inclusive os self-loops i→i (marcados com `self: True`)
    para o front poder mostrá-los ou não por uma opção. Os self-loops formam uma
    FAMÍLIA SEPARADA na correção FDR — assim ligar/desligar a opção `self` não muda
    a significância das transições i→j (a família delas é a mesma de antes).
    `signif` marca as que passam em q <= alpha."""
    N = sum(n for d in counts.values() for n in d.values())
    src = {i: sum(d.values()) for i, d in counts.items()}
    dst = {}
    for d in counts.values():
        for j, n in d.items():
            dst[j] = dst.get(j, 0) + n
    off, diag = [], []     # i→j (transições) e i→i (self-loops): famílias separadas no FDR
    for i, d in counts.items():
        for j, n in d.items():
            a = n
            b = src[i] - a
            c = dst[j] - a
            dd = N - a - b - c
            g2, p, teste = _g2_pvalue(a, b, c, dd)
            p_ij = n / N
            pmi = math.log2(p_ij / ((src[i] / N) * (dst[j] / N)))
            npmi = pmi / (-math.log2(p_ij)) if p_ij < 1 else 1.0
            (diag if i == j else off).append({
                "from": i, "to": j,
                "pmi": round(pmi, 3), "npmi": round(npmi, 3),
                "count": n, "pcond": round(n / src[i], 3),
                "g2": round(g2, 3), "p": float(p), "teste": teste,
                "self": i == j,
            })
    for group in (off, diag):
        for e, q in zip(group, _bh_fdr([e["p"] for e in group])):
            e["q"] = float(q)
            e["signif"] = bool(q <= alpha)
    return off + diag


def main():
    cont = json.load(open(SA / "contagens_clusters.json"))

    clusters = {}
    for c, counts in cont.items():
        edges = signif_edges(counts, alpha=ALPHA)
        n_trans = sum(n for d in counts.values() for n in d.values())
        clusters[c] = {"n_trans": n_trans, "edges": edges}

    data = {
        "nos_internos": NOS_INTERNOS,
        "alpha": ALPHA,
        "clusters": clusters,
    }

    out = Path(__file__).resolve().parent / "public" / "cbmg_data_g.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"escrito: {out}")
    print(f"  clusters: {sorted(clusters, key=int)}")
    for c in sorted(clusters, key=int):
        edges = clusters[c]["edges"]
        ns = sum(1 for e in edges if e["signif"])
        nself = sum(1 for e in edges if e.get("self"))
        print(f"  cluster {c:>2}: {len(edges):>3} arestas ({nself} self) | "
              f"{ns:>3} significativas (q<=ALPHA={ALPHA})")


if __name__ == "__main__":
    main()
