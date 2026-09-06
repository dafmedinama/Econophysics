"""Metrics and histogram construction for simulation results."""

from __future__ import annotations

from dataclasses import dataclass
import math

from .models import SimulationResult, Snapshot


@dataclass(frozen=True, slots=True)
class HistogramRow:
    step: int
    bin_index: int
    bin_left: float
    bin_right: float
    midpoint: float
    count: int
    probability: float
    theoretical_probability: float


def gini(values: tuple[float, ...]) -> float:
    ordered = sorted(values)
    total = math.fsum(ordered)
    if not ordered or total == 0:
        return 0.0
    weighted = math.fsum((index + 1) * value for index, value in enumerate(ordered))
    return (2.0 * weighted) / (len(ordered) * total) - (len(ordered) + 1) / len(ordered)


def _histogram_bound(result: SimulationResult) -> float:
    # Shared fixed bins; the last bin includes the entire right tail.
    return -math.log(1e-6) * result.config.temperature


def histogram_rows(result: SimulationResult) -> list[HistogramRow]:
    bins = result.config.bins
    upper = _histogram_bound(result)
    width = upper / bins
    temperature = result.config.temperature
    rows: list[HistogramRow] = []

    for snapshot in result.snapshots:
        counts = [0] * bins
        for value in snapshot.balances:
            index = min(int(value / width), bins - 1)
            counts[index] += 1

        for index, count in enumerate(counts):
            left = index * width
            right = (index + 1) * width
            theoretical = (
                math.exp(-left / temperature)
                if index == bins - 1
                else math.exp(-left / temperature) - math.exp(-right / temperature)
            )
            rows.append(
                HistogramRow(
                    step=snapshot.step,
                    bin_index=index,
                    bin_left=left,
                    bin_right=right,
                    midpoint=(left + right) / 2.0,
                    count=count,
                    probability=count / result.config.agents,
                    theoretical_probability=theoretical,
                )
            )
    return rows


def snapshot_metrics(snapshot: Snapshot, initial_total: float, bins: int) -> dict[str, float | int]:
    values = snapshot.balances
    count = len(values)
    total = math.fsum(values)
    mean = total / count
    variance = math.fsum((value - mean) ** 2 for value in values) / count

    width = -math.log(1e-6) * (initial_total / count) / bins
    histogram = [0] * bins
    for value in values:
        histogram[min(int(value / width), bins - 1)] += 1
    probabilities = (item / count for item in histogram if item)
    entropy = -math.fsum(p * math.log(p) for p in probabilities)

    return {
        "step": snapshot.step,
        "attempts_per_agent": snapshot.step / count,
        "money_total": total,
        "conservation_error": total - initial_total,
        "mean": mean,
        "variance": variance,
        "minimum": min(values),
        "maximum": max(values),
        "gini": gini(values),
        "entropy": entropy,
        "ks_distance_to_exponential": kolmogorov_smirnov_exponential(values, initial_total / count),
        "accepted_transactions": snapshot.accepted_transactions,
        "rejected_transactions": snapshot.rejected_transactions,
    }


def all_metrics(result: SimulationResult) -> list[dict[str, float | int]]:
    return [
        snapshot_metrics(snapshot, result.config.total_money, result.config.bins)
        for snapshot in result.snapshots
    ]


def kolmogorov_smirnov_exponential(values: tuple[float, ...], temperature: float) -> float:
    ordered = sorted(values)
    count = len(ordered)
    distance = 0.0
    for index, value in enumerate(ordered, start=1):
        theoretical = 1.0 - math.exp(-value / temperature)
        distance = max(
            distance,
            abs(index / count - theoretical),
            abs((index - 1) / count - theoretical),
        )
    return distance


def summary(result: SimulationResult) -> dict[str, float | int | str]:
    final = all_metrics(result)[-1]
    return {
        "rule": result.config.rule.value,
        "temperature_theoretical": result.config.temperature,
        "temperature_empirical": float(final["mean"]),
        "ks_distance_to_exponential": kolmogorov_smirnov_exponential(
            result.final_balances, result.config.temperature
        ),
        **final,
    }
