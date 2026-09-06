"""Parallel, resumable ensemble simulations with online uncertainty summaries."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, as_completed
import json
import hashlib
import math
from pathlib import Path
import random
from statistics import fmean, stdev
from typing import Callable

from .models import ExchangeRule, SimulationConfig
from .storage import atomic_json
from .convergence import stability_diagnostic

ENGINE_VERSION = "2"
CHECKPOINT_SCHEMA = 1


def observation_steps(transactions: int, observation_points: int) -> list[int]:
    """Unique integer checkpoints including the initial and final states."""
    return sorted({index * transactions // (observation_points - 1)
                   for index in range(observation_points)})


def checkpoint_identity(config: SimulationConfig, sample_agents: int, observation_points: int) -> dict[str, object]:
    return {"engine_version": ENGINE_VERSION, "config": config.to_dict(),
            "sample_agents": min(sample_agents, config.agents),
            "steps": observation_steps(config.transactions, observation_points)}


def _digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def _validate_checkpoint(envelope: dict, identity: dict, replicate: int) -> dict:
    if not isinstance(envelope, dict):
        raise ValueError("checkpoint must be a JSON object")
    if envelope.get("schema_version") != CHECKPOINT_SCHEMA or envelope.get("identity") != identity:
        raise ValueError("checkpoint configuration or engine version does not match")
    result = envelope["result"]
    if not isinstance(result, dict):
        raise ValueError("checkpoint result must be a JSON object")
    if envelope.get("sha256") != _digest(result):
        raise ValueError("checkpoint checksum does not match")
    config = identity["config"]
    if result["replicate"] != replicate or result["seed"] != config["seed"] + replicate * 1_000_003:
        raise ValueError("checkpoint replicate or seed does not match")
    if [row["step"] for row in result["snapshots"]] != identity["steps"]:
        raise ValueError("checkpoint observations do not match")
    if not math.isclose(result["money_total"], config["total_money"], rel_tol=1e-10, abs_tol=1e-8):
        raise ValueError("checkpoint violates money conservation")
    for row in result["snapshots"]:
        probabilities = row["probabilities"]
        if (len(probabilities) != config["bins"] or
                any(not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities) or
                not math.isclose(sum(probabilities), 1.0, abs_tol=1e-10)):
            raise ValueError("checkpoint histogram is invalid")
        if row["accepted_transactions"] + row["rejected_transactions"] != row["step"]:
            raise ValueError("checkpoint transaction counters are invalid")
        if any(not math.isfinite(value) for key, value in row.items() if key != "probabilities"):
            raise ValueError("checkpoint contains non-finite metrics")
    return result


def _sample_snapshot(
    balances: list[float],
    sample_indices: list[int],
    bins: int,
    upper: float,
    temperature: float,
    step: int,
    accepted: int,
    rejected: int,
) -> dict[str, object]:
    values = sorted(balances[index] for index in sample_indices)
    count = len(values)
    total = math.fsum(values)
    mean = total / count
    variance = math.fsum((value - mean) ** 2 for value in values) / count
    weighted = math.fsum((index + 1) * value for index, value in enumerate(values))
    gini = (2.0 * weighted) / (count * total) - (count + 1) / count if total else 0.0

    width = upper / bins
    counts = [0] * bins
    ks_distance = 0.0
    for rank, value in enumerate(values, start=1):
        counts[min(int(value / width), bins - 1)] += 1
        theoretical_cdf = 1.0 - math.exp(-value / temperature)
        ks_distance = max(
            ks_distance,
            abs(rank / count - theoretical_cdf),
            abs((rank - 1) / count - theoretical_cdf),
        )

    probabilities = [item / count for item in counts]
    entropy = -math.fsum(p * math.log(p) for p in probabilities if p)
    return {
        "step": step,
        "mean": mean,
        "variance": variance,
        "minimum": values[0],
        "maximum": values[-1],
        "gini": gini,
        "entropy": entropy,
        "ks_distance_to_exponential": ks_distance,
        "accepted_transactions": accepted,
        "rejected_transactions": rejected,
        "probabilities": probabilities,
    }


def _run_replicate(
    config: SimulationConfig,
    replicate: int,
    sample_agents: int,
    observation_points: int,
) -> dict[str, object]:
    seed = config.seed + replicate * 1_000_003
    rng = random.Random(seed)
    sample_rng = random.Random(seed ^ 0x9E3779B97F4A7C15)
    balances = [config.temperature] * config.agents
    sample_indices = sample_rng.sample(
        range(config.agents), min(sample_agents, config.agents)
    )
    upper = -math.log(1e-6) * config.temperature
    checkpoints = observation_steps(config.transactions, observation_points)

    accepted = 0
    rejected = 0
    snapshots = [
        _sample_snapshot(
            balances,
            sample_indices,
            config.bins,
            upper,
            config.temperature,
            0,
            accepted,
            rejected,
        )
    ]
    next_checkpoint = 1

    for step in range(1, config.transactions + 1):
        loser = rng.randrange(config.agents)
        winner = rng.randrange(config.agents - 1)
        if winner >= loser:
            winner += 1
        nu = rng.random()

        if config.rule is ExchangeRule.SYSTEM_AVERAGE:
            delta = nu * config.temperature
        elif config.rule is ExchangeRule.PAIR_AVERAGE:
            delta = nu * (balances[loser] + balances[winner]) / 2.0
        elif config.rule is ExchangeRule.FIXED:
            delta = config.fixed_amount
        elif config.rule is ExchangeRule.MULTIPLICATIVE:
            delta = nu * balances[loser]
        else:  # pragma: no cover - guarded by SimulationConfig
            raise ValueError(f"unsupported exchange rule: {config.rule}")

        if delta <= balances[loser] and math.isfinite(delta):
            balances[loser] -= delta
            balances[winner] += delta
            accepted += 1
        else:
            rejected += 1

        if next_checkpoint < len(checkpoints) and step == checkpoints[next_checkpoint]:
            snapshots.append(
                _sample_snapshot(
                    balances,
                    sample_indices,
                    config.bins,
                    upper,
                    config.temperature,
                    step,
                    accepted,
                    rejected,
                )
            )
            next_checkpoint += 1

    return {
        "replicate": replicate,
        "seed": seed,
        "money_total": math.fsum(balances),
        "snapshots": snapshots,
    }


def _mean_ci(values: list[float]) -> tuple[float, float, float, float]:
    mean = fmean(values)
    standard_error = stdev(values) / math.sqrt(len(values)) if len(values) > 1 else 0.0
    margin = 1.96 * standard_error
    return mean, max(mean - margin, 0.0), mean + margin, standard_error


def _aggregate(
    config: SimulationConfig,
    results: list[dict[str, object]],
    sample_agents: int,
    observation_points: int,
) -> dict[str, object]:
    results.sort(key=lambda item: int(item["replicate"]))
    metrics: list[dict[str, float | int]] = []
    distributions: list[dict[str, float | int]] = []
    metric_names = (
        "mean",
        "variance",
        "minimum",
        "maximum",
        "gini",
        "entropy",
        "ks_distance_to_exponential",
        "accepted_transactions",
        "rejected_transactions",
    )
    upper = -math.log(1e-6) * config.temperature
    width = upper / config.bins

    for snapshot_index in range(len(observation_steps(config.transactions, observation_points))):
        snapshots = [result["snapshots"][snapshot_index] for result in results]  # type: ignore[index]
        row: dict[str, float | int] = {"step": int(snapshots[0]["step"])}  # type: ignore[index]
        row["attempts_per_agent"] = int(row["step"]) / config.agents
        for name in metric_names:
            values = [float(snapshot[name]) for snapshot in snapshots]  # type: ignore[index]
            mean, low, high, standard_error = _mean_ci(values)
            row[name] = mean
            row[f"{name}_ci_low"] = low
            row[f"{name}_ci_high"] = high
            row[f"{name}_standard_error"] = standard_error
        metrics.append(row)

        for bin_index in range(config.bins):
            probabilities = [
                float(snapshot["probabilities"][bin_index]) for snapshot in snapshots  # type: ignore[index]
            ]
            probability, low, high, standard_error = _mean_ci(probabilities)
            left = bin_index * width
            right = (bin_index + 1) * width
            theoretical = (
                math.exp(-left / config.temperature)
                if bin_index == config.bins - 1
                else math.exp(-left / config.temperature)
                - math.exp(-right / config.temperature)
            )
            distributions.append(
                {
                    "step": row["step"],
                    "bin_index": bin_index,
                    "bin_left": left,
                    "bin_right": right,
                    "midpoint": (left + right) / 2.0,
                    "count": probability * config.agents,
                    "probability": probability,
                    "probability_ci_low": low,
                    "probability_ci_high": high,
                    "probability_standard_error": standard_error,
                    "theoretical_probability": theoretical,
                }
            )

    conservation_errors = [
        float(result["money_total"]) - config.total_money for result in results
    ]
    conservation, conservation_low, conservation_high, conservation_se = _mean_ci(
        [abs(value) for value in conservation_errors]
    )
    summary = dict(metrics[-1])
    summary.update(
        {
            "rule": config.rule.value,
            "temperature_theoretical": config.temperature,
            "temperature_empirical": metrics[-1]["mean"],
            "conservation_error": conservation,
            "conservation_error_ci_low": conservation_low,
            "conservation_error_ci_high": conservation_high,
            "conservation_error_standard_error": conservation_se,
        }
    )
    return {
        "schemaVersion": 2,
        "config": {
            **config.to_dict(),
            "replicates": len(results),
            "sample_agents_per_replicate": min(sample_agents, config.agents),
            "observation_points": len(metrics),
            "requested_observation_points": observation_points,
        },
        "method": {
            "estimator": "independent-seed ensemble mean",
            "uncertainty": "normal 95% confidence interval across replicates",
            "evolution_sampling": "fixed random agent subsample per replicate",
            "final_conservation": "full-state math.fsum per replicate",
            "histogram": "fixed bins from 0 to -log(1e-6)*T; last bin includes the right tail",
            "extrema": "ensemble means of sample minima and maxima, not population extrema",
            "engine_version": ENGINE_VERSION,
        },
        "summary": summary,
        "metrics": metrics,
        "distributions": distributions,
        "stability": stability_diagnostic(metrics, config.agents, config.bins),
    }


def run_ensemble(
    config: SimulationConfig,
    replicates: int,
    sample_agents: int,
    observation_points: int,
    workers: int,
    checkpoint_dir: str | Path,
    progress: Callable[[int, int], None] | None = None,
) -> dict[str, object]:
    """Run or resume an ensemble and return its aggregated dashboard payload."""

    for name, value in (("replicates", replicates), ("sample_agents", sample_agents),
                        ("observation_points", observation_points), ("workers", workers)):
        if type(value) is not int:
            raise ValueError(f"{name} must be an integer")
    if workers < 1:
        raise ValueError("workers must be positive")
    if replicates < 2:
        raise ValueError("replicates must be at least 2 for confidence intervals")
    if observation_points < 2:
        raise ValueError("observation_points must be at least 2")
    if sample_agents < 100:
        raise ValueError("sample_agents must be at least 100")

    target = Path(checkpoint_dir)
    target.mkdir(parents=True, exist_ok=True)
    identity = checkpoint_identity(config, sample_agents, observation_points)
    manifest_path = target / "manifest.json"
    if manifest_path.exists():
        if json.loads(manifest_path.read_text(encoding="utf-8")) != identity:
            raise ValueError("Checkpoint directory belongs to another configuration or engine version; use a new directory.")
    elif any(target.glob("replicate-*.json")):
        raise ValueError("Legacy checkpoints have no verifiable provenance; use a new checkpoint directory.")
    else:
        atomic_json(manifest_path, identity)
    results: list[dict[str, object]] = []
    pending: list[int] = []
    for replicate in range(replicates):
        path = target / f"replicate-{replicate:06d}.json"
        if path.exists():
            try:
                results.append(_validate_checkpoint(json.loads(path.read_text(encoding="utf-8")), identity, replicate))
            except (ValueError, KeyError, TypeError, OverflowError) as exc:
                raise ValueError(f"Invalid checkpoint {path.name}: {exc}. Use a new directory or remove only the damaged replicate.") from exc
        else:
            pending.append(replicate)

    completed = len(results)
    if progress:
        progress(completed, replicates)

    if not pending:
        return _aggregate(config, results, sample_agents, observation_points)

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                _run_replicate,
                config,
                replicate,
                sample_agents,
                observation_points,
            ): replicate
            for replicate in pending
        }
        for future in as_completed(futures):
            result = future.result()
            replicate = int(result["replicate"])
            path = target / f"replicate-{replicate:06d}.json"
            envelope = {"schema_version": CHECKPOINT_SCHEMA, "identity": identity,
                        "sha256": _digest(result), "result": result}
            _validate_checkpoint(envelope, identity, replicate)
            atomic_json(path, envelope)
            results.append(result)
            completed += 1
            if progress:
                progress(completed, replicates)

    return _aggregate(config, results, sample_agents, observation_points)
