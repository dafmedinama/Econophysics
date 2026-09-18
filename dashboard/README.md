# Econophysics dashboard

Interactive views of four finite-duration money-exchange ensembles, using the DM
brand system. Install with `npm ci` (Node 24 recommended) and start with
`npm run dev`. On PowerShell use `npm.cmd` if script execution policy requires it.

`npm run check` runs five data regression tests, TypeScript, application lint and
the production build. CI runs the same command. Charts load on demand; the wealth
view does not import ECharts. Application code lives in `app/`,
`components/experiment-charts.tsx`, `components/e-chart.tsx` and `lib/experiment.ts`.

Wealth shares is composed as an editorial plate around a wealth pyramid. Agents are
stacked by the money they hold: the right wing is the population in each band, the
left wing is the money that band holds, and both wings are drawn at the same unit, so
a perfectly equal ending would be a perfect mirror. The average line marks where every
agent started; the gutters carry the money level and the population at or above it.
The Lorenz curve is kept as a footnote figure. Download poster saves the pyramid as a
standalone PNG. Pyramid geometry lives in `lib/pyramid.ts` and
`components/wealth-pyramid.tsx`.
All analysis chapters are visible together beside the other charts. Shares are estimated from 160
histogram representatives. The shared slider in the other views
selects observations in attempts per agent. Comparison uses the
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

Numeric data and methodology open in a separate dialog, with paginated observations
and histogram bins. Desktop views fit the viewport; narrow screens and text zoom use
normal document flow so labels and controls remain readable. Comparison retains a
four-model metric summary and the selected model's chart. The wealth view explicitly
distinguishes estimates from raw agents.
Reduced motion disables automatic playback and chart transitions.

For optional browser checks, install Playwright in your tooling environment, run the
development server, then `node tests/browser-check.mjs`. Set `PLAYWRIGHT_MODULE` to
an absolute `playwright/index.mjs` path if it is installed outside this checkout.
`DASHBOARD_URL` selects another local preview. Screenshots go into ignored
`test-results/`. The check covers horizontal fit from 320×568 to desktop, tabs without
scrollbars, the wealth pyramid and its dot budget, shared time, comparison, paginated data, independent
load failure, retry, playback and reduced motion.

This directory also has a Sites Git checkout. Preserve `.openai/hosting.json` and
its existing project ID. The parent Econophysics repository can track these source
files normally; its `scripts/track-dashboard.ps1` avoids embedding this Git repository
as an unconfigured submodule. Generated output, dependencies and build caches are ignored.

Analysis defaults to a complete, scrollable reading beside each chart. Distribution
and diagnostics split the available desktop width equally between chart and analysis.
On short mobile screens, comparison uses the model selector instead of the summary
table to preserve chart space.

The wealth view uses an original, dark newspaper composition. Its protagonist is a
wealth pyramid rather than dashboard cards: a dotted population wing and money wing
sharing one vertical money axis, annotated at the average line, the apex and the base,
with typographic findings arranged like a reported spread. The bands bloom outward
from the average line on entry, which is the only state every agent shared.
