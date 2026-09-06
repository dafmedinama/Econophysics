"""Machine-readable result writers."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
import json
from pathlib import Path
from dataclasses import asdict

from .metrics import all_metrics, histogram_rows, summary, snapshot_metrics
from .models import SimulationResult, SimulationConfig, iter_snapshots
from .storage import atomic_json
from .convergence import stability_diagnostic


def write_results(result: SimulationResult, output_dir: str | Path) -> Path:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    metadata = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config": result.config.to_dict(),
    }
    (target / "metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    (target / "summary.json").write_text(
        json.dumps(summary(result), indent=2), encoding="utf-8"
    )

    metrics = all_metrics(result)
    with (target / "metrics.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(metrics[0]))
        writer.writeheader()
        writer.writerows(metrics)

    distributions = histogram_rows(result)
    with (target / "distributions.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(distributions[0].__dataclass_fields__))
        writer.writeheader()
        writer.writerows(
            {field: getattr(row, field) for field in row.__dataclass_fields__}
            for row in distributions
        )
    return target


def dashboard_payload(result: SimulationResult) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "config": result.config.to_dict(),
        "summary": summary(result),
        "metrics": all_metrics(result),
        "distributions": [
            {field: getattr(row, field) for field in row.__dataclass_fields__}
            for row in histogram_rows(result)
        ],
    }


def run_to_files(config: SimulationConfig, output_dir: str | Path,
                 dashboard_json: str | Path | None = None) -> Path:
    """Stream snapshots to CSV, retaining only compact metrics/histograms.

    Unlike simulate(), memory for balances does not grow with checkpoint count.
    Metadata is a completion marker and is published after both CSVs close.
    """
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    # Prevent an interrupted rerun from retaining a misleading completion marker.
    (target / "metadata.json").unlink(missing_ok=True)
    metrics = []
    distributions = []
    with (target / "metrics.csv").open("w", newline="", encoding="utf-8") as metric_stream, \
            (target / "distributions.csv").open("w", newline="", encoding="utf-8") as histogram_stream:
        metric_writer = None
        histogram_writer = None
        for snapshot in iter_snapshots(config):
            row = snapshot_metrics(snapshot, config.total_money, config.bins)
            rows = [asdict(item) for item in histogram_rows(SimulationResult(config, (snapshot,)))]
            if metric_writer is None:
                metric_writer = csv.DictWriter(metric_stream, fieldnames=list(row))
                histogram_writer = csv.DictWriter(histogram_stream, fieldnames=list(rows[0]))
                metric_writer.writeheader()
                histogram_writer.writeheader()
            metric_writer.writerow(row)
            histogram_writer.writerows(rows)
            metrics.append(row)
            if dashboard_json is not None:
                distributions.extend(rows)
    final = {**metrics[-1], "rule": config.rule.value,
             "temperature_theoretical": config.temperature,
             "temperature_empirical": metrics[-1]["mean"]}
    stability = stability_diagnostic(metrics, config.agents, config.bins)
    atomic_json(target / "summary.json", {**final, "stability": stability})
    if dashboard_json is not None:
        atomic_json(dashboard_json, {"schemaVersion": 1, "config": config.to_dict(),
                                    "summary": final, "metrics": metrics,
                                    "distributions": distributions, "stability": stability})
    atomic_json(target / "metadata.json", {
        "schema_version": 2, "generated_at": datetime.now(timezone.utc).isoformat(),
        "config": config.to_dict(), "storage": "streamed full-state snapshots",
        "histogram": "fixed edges; final bin includes overflow", "complete": True,
    })
    return target
