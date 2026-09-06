from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from econophysics.models import SimulationConfig, simulate
from econophysics.outputs import write_results


class OutputTests(unittest.TestCase):
    def test_standard_result_files_are_written(self) -> None:
        result = simulate(
            SimulationConfig(
                agents=10,
                total_money=1_000,
                transactions=20,
                sample_every=10,
                bins=5,
                seed=4,
            )
        )
        with tempfile.TemporaryDirectory() as directory:
            target = write_results(result, directory)
            self.assertEqual(
                {path.name for path in target.iterdir()},
                {"metadata.json", "summary.json", "metrics.csv", "distributions.csv"},
            )
            summary = json.loads((Path(directory) / "summary.json").read_text())
            self.assertAlmostEqual(summary["money_total"], 1_000)


if __name__ == "__main__":
    unittest.main()
