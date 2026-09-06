import csv
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from econophysics.models import SimulationConfig, ExchangeRule, simulate
from econophysics.ensemble import run_ensemble, _run_replicate, _aggregate, _sample_snapshot
from econophysics.metrics import all_metrics
from econophysics.outputs import run_to_files
from econophysics.storage import atomic_json
from econophysics.convergence import stability_diagnostic


class ReliabilityTests(unittest.TestCase):
    def config(self, **kwargs):
        return SimulationConfig.from_dict({"agents": 100, "total_money": 10000,
                                           "transactions": 200, "sample_every": 100,
                                           "bins": 10, **kwargs})

    def run_cached(self, folder, config=None):
        return run_ensemble(config or self.config(), 2, 100, 3, 1, folder)

    def test_invalid_config_and_roundtrip(self):
        for key, values in {"total_money": [math.nan, math.inf, True, "100"],
                            "fixed_amount": [math.nan, math.inf, 0],
                            "agents": [2.5, True], "transactions": [-1, 2.5],
                            "bins": [1], "rule": ["unknown"]}.items():
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    self.config(**{key: value})
        self.assertEqual(SimulationConfig.from_dict(self.config().to_dict()), self.config())

    def test_short_runs_have_unique_complete_observations(self):
        for steps in (0, 1, 2, 13):
            config = self.config(transactions=steps)
            results = [_run_replicate(config, i, 100, 11) for i in range(2)]
            payload = _aggregate(config, results, 100, 11)
            observed = [m["step"] for m in payload["metrics"]]
            self.assertEqual(observed, sorted(set(observed)))
            self.assertEqual(observed[0], 0)
            self.assertEqual(observed[-1], steps)
            self.assertEqual(len(observed), min(steps + 1, 11))

    def test_zero_money_subsample(self):
        row = _sample_snapshot([0., 0., 100.], [0, 1], 10, 1000., 100/3, 1, 1, 0)
        self.assertEqual(row["gini"], 0)
        self.assertEqual(sum(row["probabilities"]), 1)

    def test_full_sample_matches_single_engine_for_every_rule(self):
        for rule in ExchangeRule:
            with self.subTest(rule=rule):
                config = self.config(rule=rule)
                expected = all_metrics(simulate(config))
                actual = _run_replicate(config, 0, 100, 3)["snapshots"]
                for a, b in zip(actual, expected, strict=True):
                    for key in ("mean", "gini", "entropy", "ks_distance_to_exponential", "accepted_transactions"):
                        self.assertAlmostEqual(a[key], b[key], places=10)

    def test_resume_is_identical_and_does_not_start_workers(self):
        with tempfile.TemporaryDirectory() as folder:
            first = self.run_cached(folder)
            with patch("econophysics.ensemble.ProcessPoolExecutor", side_effect=AssertionError("unexpected worker")):
                self.assertEqual(first, self.run_cached(folder))
            with self.assertRaisesRegex(ValueError, "another configuration"):
                self.run_cached(folder, self.config(rule="multiplicative"))
            with self.assertRaisesRegex(ValueError, "another configuration"):
                self.run_cached(folder, self.config(total_money=20000))
            path = Path(folder, "replicate-000000.json")
            damaged = json.loads(path.read_text())
            damaged["result"]["snapshots"][0]["mean"] += 1
            path.write_text(json.dumps(damaged))
            with self.assertRaisesRegex(ValueError, "checksum"):
                self.run_cached(folder)

    def test_legacy_and_truncated_checkpoints_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, "replicate-000000.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "Legacy"):
                self.run_cached(folder)
        with tempfile.TemporaryDirectory() as folder:
            self.run_cached(folder)
            Path(folder, "replicate-000000.json").write_text('{"result":')
            with self.assertRaisesRegex(ValueError, "Invalid checkpoint"):
                self.run_cached(folder)

    def test_atomic_write_preserves_previous_file_on_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, "result.json")
            atomic_json(path, {"old": 1})
            with self.assertRaises(ValueError):
                atomic_json(path, {"bad": math.nan})
            self.assertEqual(json.loads(path.read_text()), {"old": 1})
            self.assertEqual(len(list(Path(folder).iterdir())), 1)

    def test_streamed_output_matches_in_memory_metrics(self):
        config = self.config()
        with tempfile.TemporaryDirectory() as folder:
            run_to_files(config, folder)
            with Path(folder, "metrics.csv").open() as stream:
                actual = list(csv.DictReader(stream))
            for a, b in zip(actual, all_metrics(simulate(config)), strict=True):
                for key in b:
                    self.assertAlmostEqual(float(a[key]), b[key])
            self.assertTrue(json.loads(Path(folder, "metadata.json").read_text())["complete"])

    def test_stability_is_separate_from_gibbs_agreement(self):
        rows = [{"step": i*1000, "gini": .7, "entropy": 1., "ks_distance_to_exponential": .4} for i in range(4)]
        self.assertEqual(stability_diagnostic(rows, 100, 10)["status"], "stable_window")
        self.assertEqual(stability_diagnostic(rows, 4000000, 10)["status"], "insufficient_horizon")
        rows[-1]["gini"] = .8
        self.assertEqual(stability_diagnostic(rows, 100, 10)["status"], "changing")


if __name__ == "__main__":
    unittest.main()
