"""Command-line interface for reproducible experiments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .models import SimulationConfig
from .outputs import run_to_files
from .ensemble import run_ensemble
from .storage import atomic_json
from .convergence import stability_diagnostic


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="econophysics")
    subparsers = parser.add_subparsers(dest="command", required=True)
    run = subparsers.add_parser("run", help="run an experiment from JSON")
    run.add_argument("--config", required=True, type=Path)
    run.add_argument("--output", required=True, type=Path)
    run.add_argument(
        "--dashboard-json",
        type=Path,
        help="also write a compact JSON payload for the static dashboard",
    )
    ensemble = subparsers.add_parser(
        "ensemble", help="run or resume a parallel ensemble experiment"
    )
    ensemble.add_argument("--config", required=True, type=Path)
    ensemble.add_argument("--output", required=True, type=Path)
    ensemble.add_argument("--checkpoint-dir", required=True, type=Path)
    ensemble.add_argument("--replicates", type=int, default=100)
    ensemble.add_argument("--sample-agents", type=int, default=50_000)
    ensemble.add_argument("--observation-points", type=int, default=11)
    ensemble.add_argument("--workers", type=int, default=10)
    diagnose = subparsers.add_parser("diagnose", help="check the recorded stability window of an existing payload")
    diagnose.add_argument("--input", required=True, type=Path)
    diagnose.add_argument("--output", type=Path, help="optionally write the diagnostic JSON")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    arguments = parser.parse_args(argv)
    try:
        return execute(arguments)
    except (ValueError, TypeError, KeyError, OSError) as exc:
        parser.error(str(exc))


def execute(arguments: argparse.Namespace) -> int:
    if arguments.command == "diagnose":
        payload = json.loads(arguments.input.read_text(encoding="utf-8"))
        diagnostic = stability_diagnostic(payload["metrics"], payload["config"]["agents"], payload["config"]["bins"])
        if arguments.output:
            atomic_json(arguments.output, diagnostic)
        print(json.dumps(diagnostic, indent=2))
        return 0
    values = json.loads(arguments.config.read_text(encoding="utf-8"))
    config = SimulationConfig.from_dict(values)
    if arguments.command == "run":
        target = run_to_files(config, arguments.output, arguments.dashboard_json)
        print(f"Results written to {target}")
        return 0

    def report(completed: int, total: int) -> None:
        if completed == total or completed % max(total // 20, 1) == 0:
            print(f"Ensemble progress: {completed}/{total}", flush=True)

    payload = run_ensemble(
        config=config,
        replicates=arguments.replicates,
        sample_agents=arguments.sample_agents,
        observation_points=arguments.observation_points,
        workers=arguments.workers,
        checkpoint_dir=arguments.checkpoint_dir,
        progress=report,
    )
    atomic_json(arguments.output, payload)
    print(f"Ensemble written to {arguments.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
