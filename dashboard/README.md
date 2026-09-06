# Econophysics dashboard

Interactive views of four finite-duration money-exchange ensembles, using the DM
brand system. Install with `npm ci` (Node 24 recommended) and start with
`npm run dev`. On PowerShell use `npm.cmd` if script execution policy requires it.

`npm run check` runs five data regression tests, TypeScript, application lint and
the production build. CI runs the same command. Charts load on demand; the wealth
view does not import ECharts. Application code lives in `app/`,
`components/experiment-charts.tsx`, `components/e-chart.tsx` and `lib/experiment.ts`.

The shared slider selects observations in attempts per agent. Comparison uses the
latest observation at or before that time, with common probability axes and money/T
on horizontal axes. It does not interpolate. Confidence intervals describe each
ensemble mean, not individual balances or model differences. Each model loads and
retries independently, and input schema/observations/histograms are validated.

The current data are historical aggregates: 100 seeds, 4 million agents,
10 million attempted transfers and 50,000 sampled agents per replicate. Their
2.5 attempts per agent do not establish equilibrium. The stability heuristic uses
four final observations, at least 20 attempts per agent and normalized metric ranges
≤ 0.01. It is a descriptive check, not a proof or hypothesis test. Exact provenance
of legacy replicate files is not retroactively certified.

Numeric tables accompany chart views. The wealth strip uses bin-based representatives
and explicitly distinguishes them from raw agents. Reduced motion disables automatic
playback and chart transitions; the slider remains available.

For optional browser checks, install Playwright in your tooling environment, run the
development server, then `node tests/browser-check.mjs`. Set `PLAYWRIGHT_MODULE` to
an absolute `playwright/index.mjs` path if it is installed outside this checkout.
`DASHBOARD_URL` selects another local preview. Screenshots go into ignored
`test-results/`. The check covers mobile width, 200% text, shared time, comparison,
tables, independent load failure, retry, playback and reduced motion.

This directory also has a Sites Git checkout. Preserve `.openai/hosting.json` and
its existing project ID. The parent Econophysics repository can track these source
files normally; its `scripts/track-dashboard.ps1` avoids embedding this Git repository
as an unconfigured submodule. Generated output, dependencies and build caches are ignored.
