'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { ArrowDownToLine, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildStrip,
  experimentKeys,
  experiments,
  frameAtTime,
  interval,
  number,
  parsePayload,
  rowsAt,
  stability,
} from '@/lib/experiment';
import type { ExperimentKey, MetricRow, Payload } from '@/lib/experiment';

const Charts = lazy(() => import('@/components/experiment-charts'));
type View = 'wealth' | 'infographic' | 'scientific' | 'compare';
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: Payload };
type Datasets = Partial<Record<ExperimentKey, LoadState>>;

export default function Home() {
  const [datasets, setDatasets] = useState<Datasets>({});
  const [selected, setSelected] = useState<ExperimentKey>('system-average');
  const [activeTab, setActiveTab] = useState<View>('wealth');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const state = datasets[selected];
  const payload = state?.status === 'ready' ? state.payload : undefined;
  const index = Math.min(
    frame,
    Math.max((payload?.metrics.length ?? 1) - 1, 0),
  );
  const metric = payload?.metrics[index];
  const attempts = metric && payload ? metric.step / payload.config.agents : 0;

  const load = useCallback(async (key: ExperimentKey, signal?: AbortSignal) => {
    try {
      const response = await fetch(experiments[key].file, { signal });
      if (!response.ok)
        throw new Error(`Data request failed (${response.status}).`);
      const result = parsePayload(
        await response.json(),
        key.replaceAll('-', '_'),
      );
      if (!signal?.aborted)
        setDatasets((current) => ({
          ...current,
          [key]: { status: 'ready', payload: result },
        }));
    } catch (reason) {
      if (!signal?.aborted)
        setDatasets((current) => ({
          ...current,
          [key]: {
            status: 'error',
            message:
              reason instanceof Error
                ? reason.message
                : 'Unable to load this experiment.',
          },
        }));
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      for (const key of experimentKeys) void load(key, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!playing || reduced || !payload || index >= payload.metrics.length - 1)
      return;
    const timer = window.setTimeout(() => setFrame(index + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, payload, index]);
  const finished = !!payload && index === payload.metrics.length - 1;
  const play = () => {
    if (finished) {
      setFrame(0);
      setPlaying(true);
    } else setPlaying((value) => !value);
  };
  const changeModel = (key: ExperimentKey) => {
    setSelected(key);
    setFrame(0);
    setPlaying(false);
  };
  const retry = (key: ExperimentKey) => {
    setDatasets((current) => ({ ...current, [key]: { status: 'loading' } }));
    void load(key);
  };

  return (
    <main className="laboratory min-h-screen px-4 py-5 sm:px-7">
      <div className="mx-auto max-w-[1540px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="eyebrow">dafmedinama/ · Econophysics laboratory</p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
              Statistical mechanics{' '}
              <span className="text-primary">of money.</span>
            </h1>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Explore random exchange, compare four mechanisms and inspect what
            the observations can tell us.
          </p>
        </header>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as View)}
          className="mt-5 gap-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-full overflow-x-auto pb-2">
              <TabsList variant="line" aria-label="Analysis view">
                <TabsTrigger value="wealth">Wealth distribution</TabsTrigger>
                <TabsTrigger value="infographic">Infographic</TabsTrigger>
                <TabsTrigger value="scientific">Scientific</TabsTrigger>
                <TabsTrigger value="compare">Compare models</TabsTrigger>
              </TabsList>
            </div>
            <label className="flex flex-wrap items-center gap-3 text-sm">
              {activeTab === 'compare' ? 'Timeline model' : 'Exchange model'}
              <NativeSelect
                value={selected}
                onChange={(event) =>
                  changeModel(event.target.value as ExperimentKey)
                }
                aria-label="Exchange model"
              >
                {experimentKeys.map((key) => (
                  <NativeSelectOption key={key} value={key}>
                    {experiments[key].label}
                    {datasets[key]?.status === 'error' ? ' · unavailable' : ''}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </div>
          {payload && (
            <section
              className="panel flex flex-wrap items-center gap-4 p-4"
              aria-label="Shared time controls"
            >
              <Button
                variant="outline"
                onClick={play}
                disabled={payload.metrics.length < 2 || reduced}
                aria-label={
                  finished
                    ? 'Replay observations'
                    : playing
                      ? 'Pause observations'
                      : 'Play observations'
                }
              >
                {finished ? <RotateCcw /> : playing ? <Pause /> : <Play />}
                {finished ? 'Replay' : playing && !reduced ? 'Pause' : 'Play'}
              </Button>
              <label
                className="flex min-w-40 flex-1 flex-col gap-2 text-sm"
                htmlFor="checkpoint"
              >
                Observation {index + 1} of {payload.metrics.length}
                <input
                  id="checkpoint"
                  type="range"
                  min={0}
                  max={payload.metrics.length - 1}
                  value={index}
                  step={1}
                  onChange={(event) => {
                    setFrame(Number(event.target.value));
                    setPlaying(false);
                  }}
                  aria-valuetext={`${number(attempts)} attempts per agent, ${number(metric?.step, 0)} attempted exchanges`}
                  className="w-full accent-[var(--dm-color-aqua)]"
                />
              </label>
              <p className="text-sm">
                <strong className="font-mono text-acid">
                  {number(attempts)}
                </strong>{' '}
                attempts / agent
                <br />
                <span className="text-muted-foreground">
                  {number(metric?.step, 0)} attempts / run
                </span>
              </p>
              {reduced && (
                <p className="w-full text-sm text-muted-foreground">
                  Reduced motion is enabled. Use the observation slider to
                  explore without animation.
                </p>
              )}
            </section>
          )}
          {!payload && activeTab !== 'compare' && (
            <LoadMessage state={state} onRetry={() => retry(selected)} />
          )}
          {payload && (
            <>
              <TabsContent value="wealth">
                {activeTab === 'wealth' && (
                  <WealthStory
                    payload={payload}
                    frame={index}
                    selected={selected}
                  />
                )}
              </TabsContent>
              <TabsContent value="infographic">
                {activeTab === 'infographic' && (
                  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                    <section className="panel min-w-0 p-4 sm:p-6">
                      <SectionTitle>Ensemble distribution</SectionTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Probability per bin; shading shows an approximate 95%
                        confidence interval for the ensemble mean.
                      </p>
                      <Suspense fallback={<Loading />}>
                        <Charts
                          payload={payload}
                          frame={index}
                          mode="distribution"
                          reduced={reduced}
                        />
                      </Suspense>
                      <DistributionTable payload={payload} frame={index} />
                    </section>
                    <section className="panel p-5">
                      <SectionTitle>{experiments[selected].label}</SectionTitle>
                      <p className="mt-3 leading-relaxed text-muted-foreground">
                        {experiments[selected].explanation}
                      </p>
                      <MetricGrid metric={metric!} />
                      <Protocol payload={payload} />
                      <StabilityNote payload={payload} />
                    </section>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="scientific">
                {activeTab === 'scientific' && (
                  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                    <section className="panel min-w-0 p-4 sm:p-6">
                      <SectionTitle>Convergence diagnostics</SectionTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ensemble means with approximate 95% confidence bands.
                        The vertical marker follows the shared time control.
                      </p>
                      <Suspense fallback={<Loading />}>
                        <Charts
                          payload={payload}
                          frame={index}
                          mode="diagnostics"
                          reduced={reduced}
                        />
                      </Suspense>
                      <MetricsTable payload={payload} frame={index} />
                    </section>
                    <section className="panel p-5">
                      <SectionTitle>Experiment protocol</SectionTitle>
                      <Protocol payload={payload} />
                      <StabilityNote payload={payload} />
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Each replicate uses an independent seed and a fixed
                        random sample. Intervals describe uncertainty in the
                        ensemble mean, not the spread of individual agents. The
                        last histogram bin includes the entire right tail.
                      </p>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Money conservation is checked on the full final state:
                        mean absolute error{' '}
                        {number(payload.summary.conservation_error, 10)} units.
                        Maxima and minima are sample statistics.
                      </p>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        The exponential at T = M/N is a reference. Distance from
                        that reference and stability over time answer different
                        questions.
                      </p>
                      <a
                        className="download-link mt-5"
                        href={experiments[selected].file}
                        download={`${selected}.json`}
                      >
                        <ArrowDownToLine size={16} />
                        Download this model’s JSON
                      </a>
                    </section>
                  </div>
                )}
              </TabsContent>
            </>
          )}
          <TabsContent value="compare">
            {activeTab === 'compare' && (
              <>
                <p className="mb-5 text-base leading-relaxed text-muted-foreground">
                  Models use the same requested time in attempts per agent. Each
                  card shows its latest recorded observation at or before that
                  time; values are never interpolated. Select an available
                  timeline model if its data cannot load.
                </p>
                <div className="grid gap-5 md:grid-cols-2">
                  {experimentKeys.map((key) => {
                    const item = datasets[key];
                    if (item?.status !== 'ready')
                      return (
                        <section className="panel p-5" key={key}>
                          <SectionTitle>{experiments[key].label}</SectionTitle>
                          <LoadMessage
                            state={item}
                            onRetry={() => retry(key)}
                          />
                        </section>
                      );
                    const observed = frameAtTime(item.payload, attempts),
                      row = item.payload.metrics[observed];
                    return (
                      <section className="panel min-w-0 p-5" key={key}>
                        <SectionTitle>{experiments[key].label}</SectionTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Observed at{' '}
                          {number(row.step / item.payload.config.agents)}{' '}
                          attempts / agent · T ={' '}
                          {number(item.payload.config.temperature)}
                        </p>
                        <Suspense fallback={<Loading />}>
                          <Charts
                            payload={item.payload}
                            frame={observed}
                            mode="distribution"
                            reduced={reduced}
                            normalized
                          />
                        </Suspense>
                        <MetricGrid metric={row} />
                        <StabilityNote payload={item.payload} />
                      </section>
                    );
                  })}
                </div>
                <ComparisonTable datasets={datasets} attempts={attempts} />
              </>
            )}
          </TabsContent>
        </Tabs>
        <footer className="mt-7 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          Finite-duration experiments inspired by Drăgulescu and Yakovenko.{' '}
          {payload
            ? `The selected dataset spans ${number(payload.config.transactions / payload.config.agents)} attempted exchanges per agent. `
            : ''}
          The duration alone does not establish equilibrium.
        </footer>
      </div>
    </main>
  );
}

function WealthStory({
  payload,
  frame,
  selected,
}: {
  payload: Payload;
  frame: number;
  selected: ExperimentKey;
}) {
  const profile = useMemo(() => buildStrip(payload, frame), [payload, frame]);
  const metric = payload.metrics[frame],
    temperature = payload.config.temperature;
  const domain = useMemo(
    () =>
      Math.max(
        temperature * 2,
        ...payload.metrics.flatMap((_, index) => buildStrip(payload, index)),
      ) * 1.08,
    [payload, temperature],
  );
  return (
    <article className="equil">
      <header className="equil__head">
        <div>
          <p className="eyebrow">Equal initial balances · random exchange</p>
          <h2>
            Nobody plays
            <br />
            the game <em>better.</em>
          </h2>
          <p className="equil__lede">
            Every agent starts with {number(temperature, 0)} units. No skill,
            strategy or interest: money moves between randomly selected agents.
            The bars below summarize a sampled distribution, ordered from lower
            to higher balances.
          </p>
        </div>
        <div className="equil__aside">
          <p className="equil__note">
            160 representative quantiles reconstructed from the ensemble
            histogram. These are estimates, not individual agents. Values within
            a bin and the far tail cannot be recovered from this view.
          </p>
          <p className="equil__provenance">
            {experiments[selected].label} ·{' '}
            {number(payload.config.replicates, 0)} runs ·{' '}
            {number(payload.config.sample_agents_per_replicate, 0)} sampled
            agents of {number(payload.config.agents, 0)} per run
          </p>
        </div>
      </header>
      <div className="equil__plot">
        <figure
          className="equil__frame"
          aria-label={`Estimated money distribution. Gini ${number(metric.gini)}. Mean of sample maxima ${number(metric.maximum)} units. A numeric table follows.`}
        >
          <div className="equil__axis" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((slot) => (
              <span
                className="equil__tick"
                key={slot}
                style={{ bottom: `${slot * 25}%` }}
              >
                {number((slot * domain) / 4, 0)}
              </span>
            ))}
          </div>
          <div className="equil__field" aria-hidden="true">
            <div className="equil__bars">
              {profile.map((money, column) => (
                <span
                  key={column}
                  className="equil__bar"
                  style={{
                    transform: `scaleY(${money / domain})`,
                    backgroundColor:
                      money <= temperature
                        ? 'var(--dm-color-aqua)'
                        : 'var(--dm-color-acid)',
                  }}
                />
              ))}
            </div>
            <div
              className="equil__mean"
              style={{ bottom: `${(temperature / domain) * 100}%` }}
            >
              <b>initial mean · {number(temperature, 0)}</b>
            </div>
          </div>
        </figure>
        <p className="equil__caption">
          <span>lower balances</span>
          <span>160 estimated quantiles</span>
          <span>higher balances</span>
        </p>
        <MetricGrid metric={metric} />
      </div>
      <div className="px-5 pb-5">
        <p className="text-sm text-muted-foreground">
          Mean of sample maxima:{' '}
          <strong className="text-foreground">
            {number(metric.maximum)} units
          </strong>
          . This is not the richest agent in the full population.
        </p>
        <StabilityNote payload={payload} />
        <DistributionTable payload={payload} frame={frame} />
      </div>
    </article>
  );
}

function MetricGrid({ metric }: { metric: MetricRow }) {
  const attempts = metric.accepted_transactions + metric.rejected_transactions;
  const rows = [
    [
      'Gini coefficient',
      number(metric.gini),
      `95% CI ${interval(metric.gini_ci_low, metric.gini_ci_high)}`,
    ],
    [
      'Distance to exponential',
      number(metric.ks_distance_to_exponential),
      `95% CI ${interval(metric.ks_distance_to_exponential_ci_low, metric.ks_distance_to_exponential_ci_high)}`,
    ],
    [
      'Histogram entropy',
      number(metric.entropy),
      `95% CI ${interval(metric.entropy_ci_low, metric.entropy_ci_high)}`,
    ],
    [
      'Accepted attempts',
      attempts
        ? `${number((100 * metric.accepted_transactions) / attempts, 1)}%`
        : '—',
      attempts
        ? `${number(metric.accepted_transactions, 0)} per run (mean)`
        : 'No attempts yet',
    ],
  ];
  return (
    <dl className="my-5 grid grid-cols-2 gap-5 border-y border-border py-5">
      {rows.map(([label, value, detail]) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-mono text-2xl text-acid">{value}</dd>
          <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function Protocol({ payload }: { payload: Payload }) {
  const c = payload.config;
  const rows = [
    ['Runs', c.replicates],
    ['Agents / run', c.agents],
    ['Attempts / run', c.transactions],
    ['Attempts / agent', c.transactions / c.agents],
    ['Money / run', c.total_money],
    ['Temperature T', c.temperature],
    ['Sample / run', c.sample_agents_per_replicate],
    ['Observations', payload.metrics.length],
    ['Histogram bins', c.bins],
    ['Base seed', c.seed],
    ...(c.rule === 'fixed' ? [['Fixed amount', c.fixed_amount]] : []),
  ];
  return (
    <dl className="mt-4">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-wrap justify-between gap-3 border-b border-border py-2 text-sm"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono">{number(value as number)}</dd>
        </div>
      ))}
    </dl>
  );
}

function StabilityNote({ payload }: { payload: Payload }) {
  return (
    <div className="mt-5 border-l-2 border-primary pl-4">
      <p className="text-sm font-semibold">
        Final-window diagnostic: {stability(payload)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Heuristic: at least 20 attempts per agent and four observations, with a
        range ≤ 0.01 in Gini, KS distance and entropy / log(bins). A stable
        window does not prove equilibrium or agreement with the reference.
      </p>
    </div>
  );
}

function MetricsTable({ payload, frame }: { payload: Payload; frame: number }) {
  return (
    <details className="mt-5">
      <summary className="cursor-pointer py-3 text-sm text-primary">
        Read observation data as a table
      </summary>
      <TableScroll label="Observation data">
        <table>
          <caption>
            Ensemble means and approximate 95% confidence intervals. Selected
            observation is marked.
          </caption>
          <thead>
            <tr>
              <th scope="col">Attempts / agent</th>
              <th scope="col">Gini (95% CI)</th>
              <th scope="col">KS (95% CI)</th>
              <th scope="col">Entropy (95% CI)</th>
              <th scope="col">Mean sample maximum</th>
            </tr>
          </thead>
          <tbody>
            {payload.metrics.map((row, index) => (
              <tr
                key={row.step}
                aria-current={index === frame ? 'true' : undefined}
              >
                <th scope="row">
                  {number(row.step / payload.config.agents)}
                  {index === frame ? ' · selected' : ''}
                </th>
                <td>
                  {number(row.gini)} (
                  {interval(row.gini_ci_low, row.gini_ci_high)})
                </td>
                <td>
                  {number(row.ks_distance_to_exponential)} (
                  {interval(
                    row.ks_distance_to_exponential_ci_low,
                    row.ks_distance_to_exponential_ci_high,
                  )}
                  )
                </td>
                <td>
                  {number(row.entropy)} (
                  {interval(row.entropy_ci_low, row.entropy_ci_high)})
                </td>
                <td>{number(row.maximum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </details>
  );
}

function DistributionTable({
  payload,
  frame,
}: {
  payload: Payload;
  frame: number;
}) {
  const rows = rowsAt(payload, frame);
  return (
    <details className="mt-5">
      <summary className="cursor-pointer py-3 text-sm text-primary">
        Read histogram data as a table
      </summary>
      <TableScroll label="Histogram data">
        <table>
          <caption>
            Observed probability per bin at{' '}
            {number(payload.metrics[frame].step / payload.config.agents)}{' '}
            attempts per agent. Last bin includes overflow.
          </caption>
          <thead>
            <tr>
              <th scope="col">Money interval</th>
              <th scope="col">Mean probability</th>
              <th scope="col">95% CI</th>
              <th scope="col">Exponential reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.bin_index}>
                <th scope="row">
                  [{number(row.bin_left, 1)},{' '}
                  {index === rows.length - 1 ? '∞' : number(row.bin_right, 1)})
                </th>
                <td>{number(row.probability, 6)}</td>
                <td>
                  {number(row.probability_ci_low, 6)}–
                  {number(row.probability_ci_high, 6)}
                </td>
                <td>{number(row.theoretical_probability, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </details>
  );
}

function ComparisonTable({
  datasets,
  attempts,
}: {
  datasets: Datasets;
  attempts: number;
}) {
  return (
    <section className="panel mt-5 p-5">
      <SectionTitle>Comparison data</SectionTitle>
      <TableScroll label="Model comparison">
        <table>
          <caption>
            Latest recorded observation at or before {number(attempts)} attempts
            per agent. CIs describe each model separately; they are not a test
            of differences between models.
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Observed attempts / agent</th>
              <th scope="col">Gini (95% CI)</th>
              <th scope="col">KS (95% CI)</th>
              <th scope="col">Entropy (95% CI)</th>
            </tr>
          </thead>
          <tbody>
            {experimentKeys.map((key) => {
              const state = datasets[key];
              if (state?.status !== 'ready')
                return (
                  <tr key={key}>
                    <th scope="row">{experiments[key].label}</th>
                    <td colSpan={4}>
                      {state?.status === 'error' ? 'Unavailable' : 'Loading'}
                    </td>
                  </tr>
                );
              const row =
                state.payload.metrics[frameAtTime(state.payload, attempts)];
              return (
                <tr key={key}>
                  <th scope="row">{experiments[key].label}</th>
                  <td>{number(row.step / state.payload.config.agents)}</td>
                  <td>
                    {number(row.gini)} (
                    {interval(row.gini_ci_low, row.gini_ci_high)})
                  </td>
                  <td>
                    {number(row.ks_distance_to_exponential)} (
                    {interval(
                      row.ks_distance_to_exponential_ci_low,
                      row.ks_distance_to_exponential_ci_high,
                    )}
                    )
                  </td>
                  <td>
                    {number(row.entropy)} (
                    {interval(row.entropy_ci_low, row.entropy_ci_high)})
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-3 text-sm text-muted-foreground">
        Entropy comparisons require matching normalized bin edges. The published
        models share them. Distributions use money / T; probability per bin
        remains sensitive to bin width.
      </p>
    </section>
  );
}

function LoadMessage({
  state,
  onRetry,
}: {
  state?: LoadState;
  onRetry: () => void;
}) {
  return state?.status === 'error' ? (
    <div role="alert" className="panel p-5">
      <p>{state.message}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Retry this model
      </Button>
    </div>
  ) : (
    <Loading />
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-medium tracking-tight">{children}</h2>;
}
function Loading() {
  return (
    <output className="grid min-h-40 place-items-center p-5 text-sm text-muted-foreground">
      Loading experiment…
    </output>
  );
}
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

function TableScroll({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // Keyboard users must be able to focus and scroll an overflowing table.
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <section className="table-scroll mt-4" tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}
