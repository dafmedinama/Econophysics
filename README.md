# Econophysics

Reproducible money-exchange experiments inspired by Drăgulescu and Yakovenko,
with a dependency-free Python engine and an interactive ECharts dashboard.

## Start with a small experiment

Requires Python 3.11+. From the project root:

```sh
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
python -m pip install -e .
python -m unittest discover -s tests -v
python -m econophysics.cli run --config experiments/demo.json --output data/results/demo
```

On Windows PowerShell, activation is optional:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e .
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe -m econophysics.cli run --config experiments/demo.json --output data/results/demo
```

For development without installation: set `$env:PYTHONPATH='src'` in PowerShell,
`set PYTHONPATH=src` in cmd.exe, or `export PYTHONPATH=src` in Bash.

The demo uses 500 agents and 50,000 attempted exchanges. The `paper_*` and
comparison configurations are large research runs, not quick-start examples.

`run` streams observations to `metrics.csv` and `distributions.csv`, then writes
`summary.json` and `metadata.json`. Metadata with `complete: true` is the completion
marker; interrupted CSV exports should be rerun. Historical full balances are
not retained by the CLI. The Python `simulate()` API still returns all snapshots
for callers that need them; use `iter_snapshots()` for bounded balance storage.

`--dashboard-json data/results/demo.json` optionally writes a single-run schema-1
payload for analysis. The website consumes ensemble schema-2 payloads only.

## Run or resume an ensemble

Start with a small ensemble, using one line in any shell:

```sh
python -m econophysics.cli ensemble --config experiments/demo.json --output data/results/demo-ensemble.json --checkpoint-dir experiments/ensemble-checkpoints/demo-v2 --replicates 10 --sample-agents 500 --observation-points 21 --workers 2
```

Each worker stores one full population and samples agents for observations.
Choose workers to fit available memory, especially for four-million-agent runs.
Replicates and requested observation points must be at least 2, samples at least
100, and workers at least 1. Sampling is capped at the population size. Short runs
emit only unique integer observation steps, always including zero and the final step.

Checkpoints have a manifest binding the configuration, sample size, actual
observation steps and engine version. Each completed replicate includes its seed,
identity and SHA-256 checksum. JSON writes use a temporary file and atomic replacement.
Resumption verifies checksums, dimensions, counters and final conservation before
aggregation. A changed configuration or legacy directory is rejected, not silently reused.

Use a new directory for a different experiment. Legacy checkpoints cannot be
verified retroactively and are not migrated automatically. A damaged replicate
can be removed individually and recomputed with the original manifest. Run only
one writer per checkpoint directory. Resumption is between completed replicates,
not midway through an individual replicate.

To regenerate the system-average research payload, replace the demo config with
`experiments/paper_figure_1.json`, use `--replicates 100 --sample-agents 50000
--observation-points 11`, and write to `dashboard/public/data/system-average.json`.
The other files use their corresponding experiment configurations. Keep separate
checkpoint directories for all four mechanisms.

## Interpret the results

- An exchange step counts an **attempt**, whether accepted or rejected. Time is
  also reported as attempts divided by agents; it is not the number of successful
  transfers or the number of encounters experienced by every individual.
- The existing published data describe 100 seeds, 4,000,000 agents and 10,000,000
  attempts per model, with 50,000 sampled agents per replicate. This is only
  **2.5 attempts per agent**, and does not establish equilibrium. Existing aggregates
  are retained as historical observations, not certified by the new checkpoint format.
- Gini, entropy, KS distance, means and extrema are sample-based ensemble statistics.
  In particular, the mean of sample maxima is not the population's richest agent.
  Conservation is checked separately against each replicate's full final state.
- Both execution paths use fixed bins from zero to `-log(1e-6)*T`, with the last
  bin absorbing the entire right tail. Entropy uses those same bins at every time.
  Histogram values are probability **per bin**, not a probability density.
- Approximate normal 95% intervals use `mean ± 1.96 * standard_error` across seeds,
  with the lower end clipped at zero. This approximation is less reliable with
  few replicates. These are intervals for means, not individual-agent ranges or
  simultaneous confidence bands. Model differences require their own analysis.
- The wealth strip shows 160 histogram-based representatives, not raw agents.
  Discrete transfers retain their balance lattice; within-bin positions and the
  far tail are not inferred as exact balances.
- A descriptive stability check requires at least 20 attempts per agent and four
  observations. Over the last four observations, ranges of Gini, KS and
  `entropy/log(bins)` must each be ≤ 0.01. Thresholds are explicit heuristics,
  not a stationarity test. Stable values do not imply agreement with Gibbs.

Inspect the recorded stability window without rerunning an experiment:

```sh
python -m econophysics.cli diagnose --input dashboard/public/data/system-average.json
```

For stronger equilibrium evidence, extend the horizon, inspect multiple late
windows and initial conditions, and assess sampling error. Do not infer equilibrium
from the total number of agents or seeds alone.

## Dashboard

Node 24 LTS is used by CI (the application supports Node ≥22.13).

```sh
cd dashboard
npm ci
npm run dev
```

Use `npm.cmd` in PowerShell if execution policy blocks `npm.ps1`.
The dashboard needs no simulation backend. Wealth shares uses an editorial Lorenz
plate to contrast the poorest 50% and richest 10%, with an annotated equality gap,
group-average ratio and PNG export. The other views share an observation slider and playback
control. Comparison aligns observations by attempts per agent,
uses money/T on horizontal axes and reports actual recorded times without
interpolation. Failed files have independent errors and retry buttons. Numeric
paginated data, keyboard controls and reduced-motion support provide alternatives
to animated charts. Desktop views fit the viewport; narrow screens and text zoom use
normal vertical flow instead of shrinking labels. Methodology and detailed data open
separately. On narrow screens, comparison shows
all models' metrics and the selected model's chart. ECharts loads only in chart views.

```sh
npm run check
```

This runs data/behavior tests, TypeScript, lint for application code and the
production build. Root CI additionally tests Python 3.11/3.13 and the demo CLI.
The dashboard has its own workflow for its Sites source repository.

## Source layout and delivery

`src/`, `tests/`, `experiments/` and dashboard source belong to this project.
The existing `dashboard/.git` is a separate Sites publishing checkout. It is
preserved; do not delete it or accidentally add `dashboard` as an embedded Git
repository without configuring a submodule. The parent can track the dashboard's
source files explicitly using `scripts/track-dashboard.ps1`, which excludes nested
Git metadata, dependencies, build output and temporary files. The parent stores
normal files, so a fresh clone can run both CI jobs without private submodule access.

Generated research outputs, checkpoints, environments and build artifacts remain
ignored. `dashboard/.openai/hosting.json` identifies the existing Sites project;
preserve it. Build and review before publishing to the existing audience.

## Exchange rules

| Rule | Proposed transfer |
| --- | --- |
| `system_average` | `ν * M / N` |
| `pair_average` | `ν * (m_i + m_j) / 2` |
| `fixed` | Configured constant; published value is 500 = T/2 |
| `multiplicative` | `ν * m_loser` |

Here ν is uniform on [0,1). A proposal is rejected if the donor cannot pay.
Money is conserved by transfers. Fixed exchange occupies discrete money levels;
the continuous exponential is a comparison rather than its exact discrete reference.

## Reference

A. Drăgulescu and V. M. Yakovenko, *Statistical mechanics of money*,
European Physical Journal B 17, 723–729 (2000),
https://arxiv.org/abs/cond-mat/0001432.
