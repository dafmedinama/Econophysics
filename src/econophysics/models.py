"""Closed-system money exchange models.

The baseline rules follow section III of Dragulescu and Yakovenko (2000).
The multiplicative rule is kept as an explicit non-reversible comparison.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum
import math
import random
from typing import Any
from collections.abc import Iterator


class ExchangeRule(StrEnum):
    SYSTEM_AVERAGE = "system_average"
    PAIR_AVERAGE = "pair_average"
    FIXED = "fixed"
    MULTIPLICATIVE = "multiplicative"


@dataclass(frozen=True, slots=True)
class SimulationConfig:
    agents: int = 500
    total_money: float = 500_000.0
    transactions: int = 400_000
    sample_every: int = 2_000
    bins: int = 60
    seed: int = 20260828
    rule: ExchangeRule = ExchangeRule.SYSTEM_AVERAGE
    fixed_amount: float = 1.0

    def __post_init__(self) -> None:
        for name in ("agents", "transactions", "sample_every", "bins", "seed"):
            if type(getattr(self, name)) is not int:
                raise ValueError(f"{name} must be an integer")
        for name in ("total_money", "fixed_amount"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"{name} must be a finite number")
        object.__setattr__(self, "rule", ExchangeRule(self.rule))
        if self.agents < 2:
            raise ValueError("agents must be at least 2")
        if self.total_money <= 0:
            raise ValueError("total_money must be positive")
        if self.transactions < 0:
            raise ValueError("transactions cannot be negative")
        if self.sample_every <= 0:
            raise ValueError("sample_every must be positive")
        if self.bins < 2:
            raise ValueError("bins must be at least 2")
        if self.fixed_amount <= 0:
            raise ValueError("fixed_amount must be positive")
        if self.temperature <= 0 or not math.isfinite(self.temperature * 14):
            raise ValueError("temperature is outside the supported floating-point range")

    @property
    def temperature(self) -> float:
        return self.total_money / self.agents

    @classmethod
    def from_dict(cls, values: dict[str, Any]) -> "SimulationConfig":
        data = dict(values)
        temperature = data.pop("temperature", None)
        data["rule"] = ExchangeRule(data.get("rule", ExchangeRule.SYSTEM_AVERAGE))
        config = cls(**data)
        if temperature is not None and temperature != config.temperature:
            raise ValueError("temperature must equal total_money / agents")
        return config

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["rule"] = self.rule.value
        data["temperature"] = self.temperature
        return data


@dataclass(frozen=True, slots=True)
class Snapshot:
    step: int
    balances: tuple[float, ...]
    accepted_transactions: int
    rejected_transactions: int


@dataclass(frozen=True, slots=True)
class SimulationResult:
    config: SimulationConfig
    snapshots: tuple[Snapshot, ...]

    @property
    def final_balances(self) -> tuple[float, ...]:
        return self.snapshots[-1].balances


def _distinct_agents(rng: random.Random, agents: int) -> tuple[int, int]:
    loser = rng.randrange(agents)
    winner = rng.randrange(agents - 1)
    if winner >= loser:
        winner += 1
    return loser, winner


def _transfer_amount(
    config: SimulationConfig,
    rng: random.Random,
    loser_money: float,
    winner_money: float,
) -> float:
    nu = rng.random()
    if config.rule is ExchangeRule.SYSTEM_AVERAGE:
        return nu * config.temperature
    if config.rule is ExchangeRule.PAIR_AVERAGE:
        return nu * (loser_money + winner_money) / 2.0
    if config.rule is ExchangeRule.FIXED:
        return config.fixed_amount
    if config.rule is ExchangeRule.MULTIPLICATIVE:
        return nu * loser_money
    raise ValueError(f"unsupported exchange rule: {config.rule}")


def simulate(config: SimulationConfig) -> SimulationResult:
    """Run a deterministic simulation for a given configuration."""
    return SimulationResult(config=config, snapshots=tuple(iter_snapshots(config)))


def iter_snapshots(config: SimulationConfig) -> Iterator[Snapshot]:
    """Yield full-state observations without retaining previous balances."""

    rng = random.Random(config.seed)
    balances = [config.temperature] * config.agents
    accepted = 0
    rejected = 0
    yield Snapshot(0, tuple(balances), accepted, rejected)

    for step in range(1, config.transactions + 1):
        loser, winner = _distinct_agents(rng, config.agents)
        delta = _transfer_amount(
            config, rng, balances[loser], balances[winner]
        )
        if delta <= balances[loser] and math.isfinite(delta):
            balances[loser] -= delta
            balances[winner] += delta
            accepted += 1
        else:
            rejected += 1

        if step % config.sample_every == 0 or step == config.transactions:
            yield Snapshot(step, tuple(balances), accepted, rejected)
