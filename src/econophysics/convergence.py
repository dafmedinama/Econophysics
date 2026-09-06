"""Descriptive stability checks, not a statistical proof of equilibrium."""

import math
from collections.abc import Sequence, Mapping


def stability_diagnostic(metrics: Sequence[Mapping[str, float | int]], agents: int,
                         bins: int, *, window: int = 4, tolerance: float = 0.01,
                         minimum_attempts_per_agent: float = 20.0) -> dict[str, object]:
    """Check the range of three normalized metrics over the last observations.

    A flat initial state or a short run cannot pass. This heuristic describes
    the recorded window only; it does not test stationarity or Gibbs agreement.
    """
    if window < 2 or tolerance <= 0 or minimum_attempts_per_agent <= 0:
        raise ValueError("invalid stability thresholds")
    attempts = float(metrics[-1]["step"]) / agents if metrics else 0.0
    enough = len(metrics) >= window and attempts >= minimum_attempts_per_agent
    ranges = {}
    for key in ("gini", "ks_distance_to_exponential", "entropy"):
        values = [float(row[key]) for row in metrics[-window:]]
        scale = math.log(bins) if key == "entropy" else 1.0
        ranges[key] = (max(values) - min(values)) / scale if values else None
    stable = enough and all(value is not None and value <= tolerance for value in ranges.values())
    return {
        "status": "stable_window" if stable else "changing" if enough else "insufficient_horizon",
        "window": window,
        "tolerance": tolerance,
        "minimum_attempts_per_agent": minimum_attempts_per_agent,
        "attempts_per_agent": attempts,
        "normalized_ranges": ranges,
        "interpretation": "Descriptive window check; not proof of equilibrium or agreement with the exponential reference.",
    }
