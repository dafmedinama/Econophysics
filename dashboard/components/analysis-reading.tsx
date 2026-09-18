'use client';

import { useState } from 'react';
import { experiments, number, stability } from '@/lib/experiment';
import type { ExperimentKey, MetricRow, Payload } from '@/lib/experiment';

export function AnalysisReading({
  payload,
  metric,
  selected,
  mode,
}: {
  payload: Payload;
  metric: MetricRow;
  selected: ExperimentKey;
  mode: 'infographic' | 'scientific' | 'compare';
}) {
  const [page, setPage] = useState(0);
  const final = payload.metrics.at(-1)!;
  const chapters =
    mode === 'infographic'
      ? [
          [
            'Mechanism',
            'Equality is a starting condition.',
            experiments[selected].explanation +
              ' The donor must afford the transfer. Money moves between agents while the system total stays constant.',
          ],
          [
            'Evidence',
            'The mean hides the differences.',
            `At this observation, Gini is ${number(metric.gini)} (0 means equality). The final recorded Gini is ${number(final.gini)}. A conserved mean can coexist with widely unequal balances; follow the spread, not only the average.`,
          ],
          [
            'Social meaning',
            'A fortune is not a measure of merit.',
            'This experiment assigns no differences in effort or ability, yet unequal outcomes emerge. It is a counterexample to the claim that unequal balances necessarily reflect unequal merit. It cannot identify why a particular person is wealthy.',
          ],
          [
            'Limits',
            'Emergence does not mean inevitability.',
            'The model omits production, wages, assets, inheritance, taxes and power. Its rules can generate inequality; that does not make inequality fair, unavoidable or an adequate description of a society.',
          ],
        ]
      : mode === 'scientific'
        ? [
            [
              'Hypothesis',
              'What is being tested?',
              'Can conserved random exchange produce a broad money distribution from equal balances? The exponential curve is a theoretical benchmark for suitable exchange rules, not a universal prediction for every model here.',
            ],
            [
              'Gini',
              'Measure dispersion, not deservingness.',
              `Gini = ${number(metric.gini)}; 95% interval ${number(metric.gini_ci_low, 5)} to ${number(metric.gini_ci_high, 5)} across repeated runs. It summarizes sample inequality, not poverty thresholds, mobility or the cause of anyone’s balance.`,
            ],
            [
              'KS & entropy',
              'Shape and spread answer different questions.',
              `KS = ${number(metric.ks_distance_to_exponential)} measures distance to the exponential reference, not distance to equilibrium. Histogram entropy = ${number(metric.entropy)} depends on the bins; it is not a measure of social welfare.`,
            ],
            [
              'Uncertainty',
              'Repeated runs are not a census.',
              `${number(payload.config.replicates, 0)} runs, ${number(payload.config.sample_agents_per_replicate, 0)} sampled agents per run. Bands describe uncertainty in ensemble means; they do not contain 95% of agents or account for missing real-world mechanisms.`,
            ],
            [
              'Convergence',
              'A final frame is not an equilibrium.',
              `${stability(payload)}: the run covers ${number(final.step / payload.config.agents)} attempts per agent. Longer runs and stable diagnostics are needed before claiming stationarity; a small KS alone cannot establish it.`,
            ],
            [
              'Reference',
              'The theory has conditions.',
              'Dragulescu & Yakovenko (2000) study conserved money exchange and exponential distributions, including exceptions when exchange symmetry is broken. Conservation alone is not enough to justify the same reference for every rule.',
            ],
          ]
        : [
            [
              'Read the comparison',
              'Same clock. Different rules.',
              'Compare at attempts per agent, with money divided by the initial mean T. Each chart uses its latest observation at or before that time. This aligns recorded effort, without inventing intermediate data.',
            ],
            [
              'Mechanisms',
              'The transfer rule changes the outcome.',
              'System average uses the economy-wide mean; pair average uses the pair’s balances. Fixed exchange creates discrete balance levels. Multiplicative exchange scales transfers to the donor’s money. These are different mechanisms, not interchangeable curves.',
            ],
            [
              'Interpretation',
              'Compare inequality and shape separately.',
              'Higher Gini means more unequal sampled balances at that time. Lower KS means closer to the exponential reference, not a better or fairer economy. For fixed and multiplicative rules, disagreement with that curve need not be a simulation failure.',
            ],
            [
              'Social question',
              'Which rules would change the result?',
              'These experiments isolate exchange rules. They motivate testing redistribution, saving or unequal initial conditions, but do not measure those policies. A causal social conclusion needs those mechanisms and empirical evidence.',
            ],
          ];
  const chapter = chapters[page];
  if (mode !== 'compare') {
    return (
      <section
        className="analysis-reading analysis-reading-all"
        aria-label={`${mode} analysis`}
      >
        {chapters.map(([label, title, copy], index) => (
          <article className="analysis-chapter" key={label}>
            <p className="analysis-index">
              {String(index + 1).padStart(2, '0')} / {label}
            </p>
            <h3>{title}</h3>
            <p>{copy}</p>
            {mode === 'scientific' && index === 5 && (
              <a
                href="https://arxiv.org/abs/cond-mat/0001432"
                target="_blank"
                rel="noreferrer"
              >
                Read the original paper ↗
              </a>
            )}
          </article>
        ))}
      </section>
    );
  }
  return (
    <section className="analysis-reading" aria-label={`${mode} analysis`}>
      <nav aria-label="Analysis chapters">
        <button
          aria-label="Previous analysis"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          ←
        </button>
        <span>
          {page + 1} / {chapters.length} · {chapter[0]}
        </span>
        <button
          aria-label="Next analysis"
          disabled={page === chapters.length - 1}
          onClick={() => setPage(page + 1)}
        >
          →
        </button>
      </nav>
      <div aria-live="polite">
        <h3>{chapter[1]}</h3>
        <p>{chapter[2]}</p>
      </div>
    </section>
  );
}
