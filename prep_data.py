"""
Gera public/cbmg_data.json para o app React, a partir dos resultados JÁ existentes
(não toca em notebook nenhum):
  - data/topic_modeling_externo_sem_autoras/contagens_clusters.json  (transições por cluster)
  - data/topic_modeling_externo_sem_autoras/sentimento_por_macro.csv  (sentimento por macro)

Computa o PMI/npmi por cluster (mesma fórmula do cbmg_pmi.ipynb) e empacota tudo
num único JSON. Rode:  python prep_data.py
"""
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SA = ROOT / "data" / "topic_modeling_externo_sem_autoras"

NOS_INTERNOS = [
    "Identidade tradwife e disputa de definição",
    "Organização material da vida tradicional",
    "Família, maternidade e segurança relacional",
    "Religião, moralidade e tradição cultural",
    "Práticas simbólicas de feminilidade",
    "Comunidade, metadiscurso e recursos",
]


def pmi_edges(counts, min_count=1):
    """PMI/npmi de cada transição i→j (exclui self-loops)."""
    N = sum(n for d in counts.values() for n in d.values())
    src = {i: sum(d.values()) for i, d in counts.items()}
    dst = {}
    for d in counts.values():
        for j, n in d.items():
            dst[j] = dst.get(j, 0) + n
    out = []
    for i, d in counts.items():
        for j, n in d.items():
            if i == j or n < min_count:
                continue
            p_ij = n / N
            pmi = math.log2(p_ij / ((src[i] / N) * (dst[j] / N)))
            npmi = pmi / (-math.log2(p_ij)) if p_ij < 1 else 1.0
            out.append({
                "from": i, "to": j,
                "pmi": round(pmi, 3), "npmi": round(npmi, 3),
                "count": n, "pcond": round(n / src[i], 3),
            })
    return out


def main():
    cont = json.load(open(SA / "contagens_clusters.json"))

    sentimento = {}
    with open(SA / "sentimento_por_macro.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sentimento[row["macro"]] = {
                "neg": round(float(row["negative"]), 1),
                "neu": round(float(row["neutral"]), 1),
                "pos": round(float(row["positive"]), 1),
                "lado": row["lado"],
                "n": int(row["n"]),
            }

    clusters = {}
    for c, counts in cont.items():
        edges = pmi_edges(counts, min_count=1)
        n_trans = sum(n for d in counts.values() for n in d.values())
        clusters[c] = {"n_trans": n_trans, "edges": edges}

    data = {
        "nos_internos": NOS_INTERNOS,
        "sentimento": sentimento,
        "clusters": clusters,
    }

    out = Path(__file__).resolve().parent / "public" / "cbmg_data.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"escrito: {out}")
    print(f"  clusters: {sorted(clusters, key=int)}")
    print(f"  macros com sentimento: {len(sentimento)}")
    print(f"  arestas (cluster 0): {len(clusters['0']['edges'])}")


if __name__ == "__main__":
    main()
