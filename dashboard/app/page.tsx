'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WealthResult } from '@/components/wealth-result';
import { AnalysisReading } from '@/components/analysis-reading';
import {
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

export default function Home() {
  const [datasets, setDatasets] = useState<
    Partial<Record<ExperimentKey, LoadState>>
  >({});
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
    } catch (error) {
      if (!signal?.aborted)
        setDatasets((current) => ({
          ...current,
          [key]: {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
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
    if (
      activeTab === 'wealth' ||
      !playing ||
      reduced ||
      !payload ||
      index >= payload.metrics.length - 1
    )
      return;
    const timer = window.setTimeout(() => setFrame(index + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [activeTab, playing, reduced, payload, index]);
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
    <main className="laboratory viewport-lab">
      <header className="lab-header">
        <div>
          <p className="eyebrow">dafmedinama/ · Econophysics laboratory</p>
          <h1>
            Statistical mechanics <span>of money.</span>
          </h1>
        </div>
        <p className="header-note">
          Four exchange rules.
          <br />
          One conserved total.
        </p>
      </header>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as View);
          setPlaying(false);
        }}
        className="lab-tabs"
      >
        <div className="lab-navigation">
          <TabsList variant="line" aria-label="Analysis view">
            <TabsTrigger value="wealth">Wealth shares</TabsTrigger>
            <TabsTrigger value="infographic">Distribution</TabsTrigger>
            <TabsTrigger value="scientific">Diagnostics</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>
          <label className="model-select">
            <span>
              {activeTab === 'compare' ? 'Focus model' : 'Exchange rule'}
            </span>
            <NativeSelect
              value={selected}
              onChange={(event) =>
                changeModel(event.target.value as ExperimentKey)
              }
              aria-label="Exchange rule"
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
        {payload && activeTab !== 'wealth' && (
          <section
            className="time-controls panel"
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
              <span>
                {finished ? 'Replay' : playing && !reduced ? 'Pause' : 'Play'}
              </span>
            </Button>
            <label htmlFor="checkpoint">
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
                aria-valuetext={`${number(attempts)} attempts per agent`}
              />
            </label>
            <p>
              <b>{number(attempts)}</b> attempts / agent
            </p>
          </section>
        )}
        {!payload && activeTab !== 'compare' && (
          <LoadMessage state={state} retry={() => retry(selected)} />
        )}
        <TabsContent value="wealth" className="view-panel">
          {activeTab === 'wealth' && payload && (
            <>
              <WealthResult
                key={selected}
                payload={payload}
                reduced={reduced}
                selected={selected}
              />
              <div className="view-caption">
                <span>
                  {number(payload.config.replicates, 0)} runs ·{' '}
                  {number(payload.config.agents, 0)} agents / run
                </span>
                <DataDialog
                  key={`final-${selected}`}
                  payload={payload}
                  frame={payload.metrics.length - 1}
                  selected={selected}
                />
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="infographic" className="view-panel">
          {activeTab === 'infographic' && payload && (
            <div className="analysis-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Ensemble distribution</h2>
                  <DataDialog
                    key={`distribution-${selected}`}
                    payload={payload}
                    frame={index}
                    selected={selected}
                  />
                </div>
                <p className="chart-description">
                  Money / T · mean probability per bin · shaded 95% confidence interval
                </p>
                <Suspense fallback={<Loading />}>
                  <Charts
                    payload={payload}
                    frame={index}
                    mode="distribution"
                    reduced={reduced}
                    normalized
                  />
                </Suspense>
              </section>
              <Information
                mode="infographic"
                payload={payload}
                metric={metric!}
                selected={selected}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="scientific" className="view-panel">
          {activeTab === 'scientific' && payload && (
            <div className="analysis-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Convergence diagnostics</h2>
                  <DataDialog
                    key={`science-${selected}`}
                    payload={payload}
                    frame={index}
                    selected={selected}
                  />
                </div>
                <p className="chart-description">
                  Means and 95% confidence bands · marker = selected observation
                </p>
                <Suspense fallback={<Loading />}>
                  <Charts
                    payload={payload}
                    frame={index}
                    mode="diagnostics"
                    reduced={reduced}
                  />
                </Suspense>
              </section>
              <Information
                mode="scientific"
                payload={payload}
                metric={metric!}
                selected={selected}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="compare" className="view-panel compare-view">
          {activeTab === 'compare' && (
            <>
              {payload && metric && (
                <AnalysisReading
                  key={selected}
                  payload={payload}
                  metric={metric}
                  selected={selected}
                  mode="compare"
                />
              )}
              <div className="comparison-summary">
                <table>
                  <caption>At {number(attempts)} attempts per agent</caption>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">Gini</th>
                      <th scope="col">KS</th>
                      <th scope="col">Entropy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experimentKeys.map((key) => {
                      const item = datasets[key];
                      const row =
                        item?.status === 'ready'
                          ? item.payload.metrics[
                              frameAtTime(item.payload, attempts)
                            ]
                          : undefined;
                      return (
                        <tr key={key} data-selected={key === selected}>
                          <th scope="row">{experiments[key].label}</th>
                          <td>{number(row?.gini)}</td>
                          <td>{number(row?.ks_distance_to_exponential)}</td>
                          <td>{number(row?.entropy)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="compare-grid">
                {experimentKeys.map((key) => {
                  const item = datasets[key];
                  if (item?.status !== 'ready')
                    return (
                      <section
                        className="panel compare-card"
                        data-selected={key === selected}
                        key={key}
                      >
                        <h2>{experiments[key].label}</h2>
                        <LoadMessage state={item} retry={() => retry(key)} />
                      </section>
                    );
                  const observed = frameAtTime(item.payload, attempts),
                    row = item.payload.metrics[observed];
                  return (
                    <section
                      className="panel compare-card"
                      data-selected={key === selected}
                      key={key}
                    >
                      <div className="panel-heading">
                        <h2>{experiments[key].label}</h2>
                        <DataDialog
                          payload={item.payload}
                          frame={observed}
                          selected={key}
                        />
                      </div>
                      <p className="chart-description">
                        Observed at{' '}
                        {number(row.step / item.payload.config.agents)} attempts
                        / agent
                      </p>
                      <Suspense fallback={<Loading />}>
                        <Charts
                          payload={item.payload}
                          frame={observed}
                          mode="distribution"
                          reduced={reduced}
                          normalized
                          compact
                        />
                      </Suspense>
                      <dl className="compare-metrics">
                        <div>
                          <dt>Gini</dt>
                          <dd>{number(row.gini)}</dd>
                        </div>
                        <div>
                          <dt>KS distance</dt>
                          <dd>{number(row.ks_distance_to_exponential)}</dd>
                        </div>
                        <div>
                          <dt>Entropy</dt>
                          <dd>{number(row.entropy)}</dd>
                        </div>
                      </dl>
                    </section>
                  );
                })}
              </div>
              <p className="view-caption">
                Money / T on x · probability per bin on y · aqua = mean · lime =
                reference. No interpolation.
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
      <footer className="lab-footer">
        Finite-duration observations · final state does not establish
        equilibrium
      </footer>
    </main>
  );
}

function Information({
  mode,
  payload,
  metric,
  selected,
}: {
  mode: 'infographic' | 'scientific';
  payload: Payload;
  metric: MetricRow;
  selected: ExperimentKey;
}) {
  const [view, setView] = useState<'analysis' | 'metrics' | 'protocol'>(
    'analysis',
  );
  const c = payload.config;
  return (
    <aside className="panel information">
      <div className="panel-heading">
        <h2>{experiments[selected].label}</h2>
      </div>
      <div className="info-switch" aria-label="Model information">
        <button
          type="button"
          aria-pressed={view === 'analysis'}
          onClick={() => setView('analysis')}
        >
          Analysis
        </button>
        <button
          type="button"
          aria-pressed={view === 'metrics'}
          onClick={() => setView('metrics')}
        >
          Metrics
        </button>
        <button
          type="button"
          aria-pressed={view === 'protocol'}
          onClick={() => setView('protocol')}
        >
          Protocol
        </button>
      </div>
      {view === 'analysis' ? (
        <AnalysisReading
          key={`${selected}-${mode}`}
          payload={payload}
          metric={metric}
          selected={selected}
          mode={mode}
        />
      ) : view === 'metrics' ? (
        <>
          <dl className="info-metrics">
            {(['gini', 'ks_distance_to_exponential', 'entropy'] as const).map(
              (key, i) => (
                <div key={key}>
                  <dt>
                    {
                      [
                        'Gini coefficient',
                        'Distance to exponential',
                        'Histogram entropy',
                      ][i]
                    }
                  </dt>
                  <dd>{number(metric[key])}</dd>
                  <small>
                    95% CI{' '}
                    {interval(
                      metric[`${key}_ci_low`],
                      metric[`${key}_ci_high`],
                    )}
                  </small>
                </div>
              ),
            )}
          </dl>
          <p className="info-note">{experiments[selected].explanation}</p>
        </>
      ) : (
        <>
          <dl className="protocol-list">
            {[
              ['Runs', c.replicates],
              ['Agents / run', c.agents],
              ['Sample / run', c.sample_agents_per_replicate],
              ['Attempts / agent', c.transactions / c.agents],
              ['Temperature', c.temperature],
              ['Bins', c.bins],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{number(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="info-note">
            Final window: <b>{stability(payload)}</b>. A descriptive check, not
            proof of equilibrium.
          </p>
        </>
      )}
    </aside>
  );
}

function DataDialog({
  payload,
  frame,
  selected,
}: {
  payload: Payload;
  frame: number;
  selected: ExperimentKey;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sectionId = useId();
  const [view, setView] = useState<'notes' | 'metrics' | 'histogram'>('notes');
  const [page, setPage] = useState(0);
  const rows = rowsAt(payload, frame);
  const count = view === 'metrics' ? payload.metrics.length : rows.length;
  const position = Math.min(page, count - 1);
  const metric = payload.metrics[view === 'metrics' ? position : frame];
  const bin = rows[position];
  return (
    <>
      <Button
        className="details-button"
        variant="outline"
        aria-label="Open data and notes"
        onClick={() => dialog.current?.showModal()}
      >
        <span className="details-label-wide">Data & notes</span>
        <span className="details-label-short" aria-hidden="true">
          Data
        </span>
      </Button>
      <dialog
        ref={dialog}
        className="data-dialog"
        aria-label={`${experiments[selected].label} data and notes`}
      >
        <header>
          <h2>{experiments[selected].label}</h2>
          <Button
            variant="outline"
            aria-label="Close data and notes"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </Button>
        </header>
        <label className="dialog-selector" htmlFor={sectionId}>
          Explore
          <NativeSelect
            id={sectionId}
            value={view}
            onChange={(event) => {
              setView(event.target.value as typeof view);
              setPage(0);
            }}
            aria-label="Data section"
          >
            <NativeSelectOption value="notes">Methodology</NativeSelectOption>
            <NativeSelectOption value="metrics">
              Observation data
            </NativeSelectOption>
            <NativeSelectOption value="histogram">
              Histogram data
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <div className="dialog-content">
          {view === 'notes' ? (
            <>
              <p>{experiments[selected].explanation}</p>
              <p>
                Metrics use{' '}
                {number(payload.config.sample_agents_per_replicate, 0)} sampled
                agents per run. Minima and maxima describe samples, not
                population extremes. Confidence intervals describe ensemble
                means.
              </p>
              <p>
                Wealth shares are approximated from 160 histogram
                representatives. They do not resolve the far tail or recover
                individual balances.
              </p>
              <p>
                Final-window diagnostic: <b>{stability(payload)}</b>. The
                heuristic requires 20 attempts per agent, four observations and
                normalized metric ranges ≤ 0.01. Stability does not prove
                equilibrium or agreement with Gibbs.
              </p>
              <p>
                Full-state mean absolute conservation error:{' '}
                {number(payload.summary.conservation_error, 10)} units.
              </p>
              <a
                className="download-link"
                href={experiments[selected].file}
                download={`${selected}.json`}
              >
                Download the full JSON
              </a>
            </>
          ) : view === 'metrics' ? (
            <>
              <h3>
                Observation {position + 1} ·{' '}
                {number(metric.step / payload.config.agents)} attempts / agent
              </h3>
              <table>
                <caption>
                  Ensemble mean and approximate 95% confidence interval
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Mean</th>
                    <th scope="col">95% CI</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    ['gini', 'ks_distance_to_exponential', 'entropy'] as const
                  ).map((key, i) => (
                    <tr key={key}>
                      <th scope="row">{['Gini', 'KS', 'Entropy'][i]}</th>
                      <td>{number(metric[key])}</td>
                      <td>
                        {interval(
                          metric[`${key}_ci_low`],
                          metric[`${key}_ci_high`],
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Mean of sample maxima: {number(metric.maximum)} units.</p>
            </>
          ) : (
            <>
              <h3>
                Histogram bin {position + 1} of {rows.length}
              </h3>
              <table>
                <caption>
                  At {number(metric.step / payload.config.agents)} attempts /
                  agent
                </caption>
                <tbody>
                  {[
                    [
                      'Money interval',
                      `[${number(bin.bin_left, 1)}, ${position === rows.length - 1 ? '∞' : number(bin.bin_right, 1)})`,
                    ],
                    ['Mean probability', number(bin.probability, 6)],
                    [
                      '95% CI',
                      `${number(bin.probability_ci_low, 6)}–${number(bin.probability_ci_high, 6)}`,
                    ],
                    [
                      'Exponential reference',
                      number(bin.theoretical_probability, 6),
                    ],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Probability per bin, not density. The last bin contains the
                entire right tail.
              </p>
            </>
          )}
        </div>
        {view !== 'notes' && (
          <nav className="data-pagination" aria-label="Data pages">
            <Button
              variant="outline"
              disabled={position === 0}
              onClick={() => setPage(position - 1)}
            >
              Previous
            </Button>
            <span>
              {position + 1} / {count}
            </span>
            <Button
              variant="outline"
              disabled={position === count - 1}
              onClick={() => setPage(position + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </dialog>
    </>
  );
}

function LoadMessage({
  state,
  retry,
}: {
  state?: LoadState;
  retry: () => void;
}) {
  return state?.status === 'error' ? (
    <section role="alert" className="load-message">
      <p>{state.message}</p>
      <Button variant="outline" onClick={retry}>
        Retry this model
      </Button>
    </section>
  ) : (
    <Loading />
  );
}
function Loading() {
  return <output className="load-message">Loading experiment…</output>;
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
