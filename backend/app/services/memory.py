from __future__ import annotations

from math import sqrt
import re


VECTOR_SIZE = 32


def embed_text(text: str) -> list[float]:
    vector = [0.0] * VECTOR_SIZE
    tokens = re.findall(r"[a-zA-Z0-9_]+", text.lower())
    if not tokens:
        return vector

    for token in tokens:
        index = sum(ord(char) for char in token) % VECTOR_SIZE
        vector[index] += 1.0

    magnitude = sqrt(sum(value * value for value in vector)) or 1.0
    return [value / magnitude for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0

    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(value * value for value in left)) or 1.0
    right_norm = sqrt(sum(value * value for value in right)) or 1.0
    return numerator / (left_norm * right_norm)
