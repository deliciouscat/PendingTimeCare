"""Shared numerical feature and deterministic diversity selection; no network I/O."""
import re
import numpy as np
from rank_bm25 import BM25Okapi


def features(q, candidates):
    if len(q) != 6 or any(x is not None and (not np.isfinite(x) or not 0 <= x <= 100) for x in q):
        raise ValueError('INVALID_Q')
    rows = []
    ids = set()
    for c in candidates:
        if c['id'] in ids or len(c['n']) != 3 or len(c['m']) != 6:
            raise ValueError('INVALID_CANDIDATE')
        ids.add(c['id'])
        if any(not np.isfinite(x) for x in c['n'] + c['m']) or any(not 0 <= x <= 1 for x in c['m']):
            raise ValueError('INVALID_FEATURE')
        rows.append([np.nan if v is None else v for v in q] + c['n'] + c['m'])
    return np.asarray(rows, dtype=np.float32).reshape((-1, 15))


def tokenize(text):
    # Character bigrams augment words for Korean particles without an external dictionary.
    words = re.findall(r'[가-힣a-z0-9]+', text.lower())
    return words + [word[i:i+2] for word in words for i in range(len(word)-1)]


def similarity(candidates):
    n = len(candidates)
    if n < 2:
        return np.zeros((n, n))
    tokens = [tokenize(c['body']) for c in candidates]
    if not any(tokens):
        return np.zeros((n, n))
    bm25 = BM25Okapi([t or ['__empty__'] for t in tokens])
    raw = np.maximum(np.array([bm25.get_scores(t) for t in tokens]), 0)
    np.fill_diagonal(raw, 0)
    maxima = raw.max(axis=1, keepdims=True)
    normalized = np.divide(raw, maxima, out=np.zeros_like(raw), where=maxima > 0)
    return (normalized + normalized.T) / 2


def select(scores, candidates, k, diversity=True, weight=0.7):
    if not 0 <= weight <= 1 or k < 0 or len(scores) != len(candidates):
        raise ValueError('INVALID_SELECTION')
    if not np.isfinite(scores).all():
        raise ValueError('NON_FINITE_SCORES')
    if not candidates or k == 0:
        return []
    scores = np.asarray(scores)
    span = np.ptp(scores)
    rel = (scores - scores.min()) / span if span else np.zeros(len(scores))
    sim = similarity(candidates) if diversity else np.zeros((len(scores), len(scores)))
    chosen = []
    while len(chosen) < min(k, len(candidates)):
        options = [i for i in range(len(candidates)) if i not in chosen]
        def key(i):
            penalty = max((sim[i, j] for j in chosen), default=0)
            value = weight * rel[i] - (1-weight) * penalty if diversity else rel[i]
            return (-value, candidates[i]['id'])
        chosen.append(min(options, key=key))
    return chosen


def ndcg(labels, selected, k=3):
    def dcg(vals):
        return sum((2**float(v)-1) / np.log2(i+2) for i, v in enumerate(vals[:k]))
    ideal = dcg(sorted(labels, reverse=True))
    return dcg([labels[i] for i in selected]) / ideal if ideal else 0.0
