"""Weak relevance from consultation-note and column features in shared N/M axes."""
import numpy as np

SUPERVISION_VERSION = 'consultation-nm-cosine-rank-v1'


def _cosine(left, right):
    left, right = np.asarray(left, dtype=float), np.asarray(right, dtype=float)
    if left.ndim != 1 or left.shape != right.shape or not np.isfinite(left).all() or not np.isfinite(right).all():
        raise ValueError('INVALID_SUPERVISION_FEATURE')
    denominator = np.linalg.norm(left) * np.linalg.norm(right)
    return float(np.clip(np.dot(left, right) / denominator, 0, 1)) if denominator else 0.0


def derive_relevance(note, candidates):
    """Equal-weight block cosine; relative similarity grades, not a human topic rubric.

    Compute N and M cosine separately before averaging so their dimensions
    do not change the block weights. Grade 3 is closest; 0 is least close within
    this candidate set, not proof that a column is clinically irrelevant.
    """
    scores = [0.5 * _cosine(note['n'], c['n']) + 0.5 * _cosine(note['m'], c['m'])
              for c in candidates]
    rounded = np.round(scores, 6)
    unique = sorted(set(rounded), reverse=True)
    if len(unique) < 2:
        raise ValueError('NO_SUPERVISION_SIGNAL')
    ranks = {score: rank for rank, score in enumerate(unique)}
    labels = [int(np.floor(3 * (len(unique) - 1 - ranks[score]) / (len(unique) - 1) + 1e-9))
              for score in rounded]
    return {'scores': scores, 'labels': labels}
