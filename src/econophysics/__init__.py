"""Agent-based econophysics simulation tools."""

from .models import ExchangeRule, SimulationConfig, SimulationResult, iter_snapshots, simulate

__all__ = ["ExchangeRule", "SimulationConfig", "SimulationResult", "simulate", "iter_snapshots"]
__version__ = "0.1.0"
