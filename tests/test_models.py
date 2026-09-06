from __future__ import annotations

import math
import unittest

from econophysics.metrics import kolmogorov_smirnov_exponential
from econophysics.models import ExchangeRule, SimulationConfig, simulate
from econophysics.ensemble import _aggregate, _run_replicate


class SimulationTests(unittest.TestCase):
    def test_money_is_conserved_and_balances_are_nonnegative(self) -> None:
        config = SimulationConfig(
            agents=80,
            total_money=8_000,
            transactions=20_000,
            sample_every=1_000,
            seed=17,
        )
        result = simulate(config)
        for snapshot in result.snapshots:
            self.assertTrue(all(value >= 0 for value in snapshot.balances))
            self.assertTrue(
                math.isclose(math.fsum(snapshot.balances), config.total_money, abs_tol=1e-8)
            )

    def test_seed_makes_runs_reproducible(self) -> None:
        config = SimulationConfig(
            agents=20,
            total_money=2_000,
            transactions=2_000,
            sample_every=200,
            seed=99,
        )
        self.assertEqual(simulate(config), simulate(config))

    def test_multiplicative_rule_is_available_as_comparison(self) -> None:
        config = SimulationConfig(
            agents=20,
            total_money=2_000,
            transactions=1_000,
            sample_every=100,
            seed=3,
            rule=ExchangeRule.MULTIPLICATIVE,
        )
        result = simulate(config)
        self.assertEqual(result.config.rule, ExchangeRule.MULTIPLICATIVE)
        self.assertTrue(all(value >= 0 for value in result.final_balances))

    def test_every_exchange_rule_preserves_closed_system_invariants(self) -> None:
        for rule in ExchangeRule:
            with self.subTest(rule=rule.value):
                config = SimulationConfig(
                    agents=40,
                    total_money=4_000,
                    transactions=5_000,
                    sample_every=1_000,
                    seed=101,
                    rule=rule,
                )
                result = simulate(config)
                for snapshot in result.snapshots:
                    self.assertTrue(all(value >= 0 for value in snapshot.balances))
                    self.assertTrue(
                        math.isclose(
                            math.fsum(snapshot.balances),
                            config.total_money,
                            abs_tol=1e-8,
                        )
                    )

    def test_reference_rule_approaches_exponential_distribution(self) -> None:
        config = SimulationConfig(
            agents=400,
            total_money=400_000,
            transactions=180_000,
            sample_every=30_000,
            seed=2026,
        )
        result = simulate(config)
        distance = kolmogorov_smirnov_exponential(
            result.final_balances, config.temperature
        )
        self.assertLess(distance, 0.11)

    def test_ensemble_aggregation_reports_uncertainty_and_conservation(self) -> None:
        config = SimulationConfig(
            agents=200,
            total_money=200_000,
            transactions=2_000,
            sample_every=1_000,
            bins=12,
            seed=41,
        )
        results = [
            _run_replicate(config, replicate, sample_agents=100, observation_points=3)
            for replicate in range(3)
        ]
        payload = _aggregate(
            config,
            results,
            sample_agents=100,
            observation_points=3,
        )
        self.assertEqual(payload["config"]["replicates"], 3)
        self.assertEqual(len(payload["metrics"]), 3)
        self.assertEqual(len(payload["distributions"]), 36)
        self.assertIn("gini_ci_low", payload["summary"])
        self.assertLess(payload["summary"]["conservation_error"], 1e-8)


if __name__ == "__main__":
    unittest.main()
