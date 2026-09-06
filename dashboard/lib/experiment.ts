export type Distribution = {
  step: number;
  bin_index: number;
  bin_left: number;
  bin_right: number;
  midpoint: number;
  probability: number;
  probability_ci_low: number;
  probability_ci_high: number;
  theoretical_probability: number;
};
export type MetricKey = 'gini' | 'entropy' | 'ks_distance_to_exponential';
export type MetricRow = {
  step: number;
  mean: number;
  maximum: number;
  gini: number;
  gini_ci_low: number;
  gini_ci_high: number;
  entropy: number;
  entropy_ci_low: number;
  entropy_ci_high: number;
  ks_distance_to_exponential: number;
  ks_distance_to_exponential_ci_low: number;
  ks_distance_to_exponential_ci_high: number;
  accepted_transactions: number;
  rejected_transactions: number;
};
export type Payload = {
  schemaVersion: number;
  config: {
    agents: number;
    total_money: number;
    transactions: number;
    sample_every: number;
    bins: number;
    seed: number;
    rule: string;
    temperature: number;
    fixed_amount: number;
    replicates: number;
    sample_agents_per_replicate: number;
    observation_points: number;
  };
  method: Record<string, string>;
  summary: MetricRow & { conservation_error: number };
  metrics: MetricRow[];
  distributions: Distribution[];
};

export const experiments = {
  'system-average': {
    label: 'System average',
    formula: 'Δm = νT',
    file: '/data/system-average.json',
    explanation:
      'The proposed transfer is a random fraction of the economy-wide mean money T.',
  },
  'pair-average': {
    label: 'Pair average',
    formula: 'Δm = ν(mᵢ + mⱼ)/2',
    file: '/data/pair-average.json',
    explanation:
      'The proposed transfer is a random fraction of the selected pair’s mean money.',
  },
  fixed: {
    label: 'Fixed exchange',
    formula: 'Δm = T/2',
    file: '/data/fixed.json',
    explanation:
      'Each attempt proposes the same amount. Balances occupy discrete levels; the continuous exponential is a comparison, not an exact discrete reference.',
  },
  multiplicative: {
    label: 'Multiplicative',
    formula: 'Δm = νmᵢ',
    file: '/data/multiplicative.json',
    explanation:
      'The proposed transfer is a random fraction of the donor’s money. A stable shape need not agree with the exponential reference.',
  },
} as const;
export type ExperimentKey = keyof typeof experiments;
export const experimentKeys = Object.keys(experiments) as ExperimentKey[];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a data object.');
  return value as Record<string, unknown>;
}
function finiteFields(value: Record<string, unknown>, fields: string[]) {
  for (const field of fields)
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field]))
      throw new Error(`Invalid numeric field: ${field}.`);
}

export function parsePayload(value: unknown, expectedRule?: string): Payload {
  const data = record(value),
    config = record(data.config);
  if (data.schemaVersion !== 2)
    throw new Error('This view requires an ensemble payload (schema 2).');
  finiteFields(config, [
    'agents',
    'total_money',
    'transactions',
    'sample_every',
    'bins',
    'seed',
    'temperature',
    'fixed_amount',
    'replicates',
    'sample_agents_per_replicate',
    'observation_points',
  ]);
  for (const field of [
    'agents',
    'bins',
    'replicates',
    'sample_agents_per_replicate',
    'observation_points',
  ]) {
    if (!Number.isInteger(config[field]) || (config[field] as number) < 1)
      throw new Error(`Invalid count: ${field}.`);
  }
  if (
    (config.agents as number) < 2 ||
    (config.bins as number) < 2 ||
    (config.replicates as number) < 2 ||
    (config.sample_agents_per_replicate as number) >
      (config.agents as number) ||
    (config.temperature as number) <= 0 ||
    (config.total_money as number) <= 0 ||
    !Number.isInteger(config.transactions) ||
    (config.transactions as number) < 0 ||
    Math.abs(
      (config.total_money as number) / (config.agents as number) -
        (config.temperature as number),
    ) >
      1e-8 * (config.temperature as number)
  )
    throw new Error('Inconsistent experiment configuration.');
  if (expectedRule && config.rule !== expectedRule)
    throw new Error('This file contains a different exchange model.');
  if (
    !Array.isArray(data.metrics) ||
    !data.metrics.length ||
    data.metrics.length !== config.observation_points ||
    !Array.isArray(data.distributions)
  )
    throw new Error('Missing or incomplete observations.');
  const metricFields = [
    'step',
    'mean',
    'maximum',
    'gini',
    'gini_ci_low',
    'gini_ci_high',
    'entropy',
    'entropy_ci_low',
    'entropy_ci_high',
    'ks_distance_to_exponential',
    'ks_distance_to_exponential_ci_low',
    'ks_distance_to_exponential_ci_high',
    'accepted_transactions',
    'rejected_transactions',
  ];
  let previous = -1;
  const steps = new Set<number>();
  for (const raw of data.metrics) {
    const row = record(raw);
    finiteFields(row, metricFields);
    const step = row.step as number;
    if (
      !Number.isInteger(step) ||
      step <= previous ||
      step > (config.transactions as number) ||
      Math.abs(
        (row.accepted_transactions as number) +
          (row.rejected_transactions as number) -
          step,
      ) > 1e-6
    )
      throw new Error('Invalid observation steps or counters.');
    for (const key of ['gini', 'entropy', 'ks_distance_to_exponential']) {
      if (
        (row[`${key}_ci_low`] as number) > (row[key] as number) ||
        (row[key] as number) > (row[`${key}_ci_high`] as number)
      )
        throw new Error('Invalid confidence interval.');
    }
    steps.add(step);
    previous = step;
  }
  if (!steps.has(0) || previous !== config.transactions)
    throw new Error('Initial or final observation is missing.');
  const groups = new Map<number, { indices: Set<number>; mass: number }>();
  for (const raw of data.distributions) {
    const row = record(raw);
    finiteFields(row, [
      'step',
      'bin_index',
      'bin_left',
      'bin_right',
      'midpoint',
      'probability',
      'probability_ci_low',
      'probability_ci_high',
      'theoretical_probability',
    ]);
    const step = row.step as number,
      index = row.bin_index as number,
      p = row.probability as number;
    const group = groups.get(step) ?? { indices: new Set<number>(), mass: 0 };
    if (
      !steps.has(step) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= (config.bins as number) ||
      group.indices.has(index) ||
      p < 0 ||
      p > 1 ||
      (row.probability_ci_low as number) < 0 ||
      (row.probability_ci_low as number) > p ||
      (row.probability_ci_high as number) < p ||
      (row.bin_left as number) >= (row.bin_right as number)
    )
      throw new Error('Invalid histogram or probability interval.');
    group.indices.add(index);
    group.mass += p;
    groups.set(step, group);
  }
  for (const step of steps) {
    const group = groups.get(step);
    if (
      !group ||
      group.indices.size !== config.bins ||
      Math.abs(group.mass - 1) > 1e-8
    )
      throw new Error('Histogram is incomplete or does not sum to one.');
  }
  const summary = record(data.summary);
  finiteFields(summary, [...metricFields, 'conservation_error']);
  if (summary.step !== config.transactions)
    throw new Error('Summary is not the final observation.');
  record(data.method);
  return data as unknown as Payload;
}

export function rowsAt(payload: Payload, frame: number) {
  const step =
    payload.metrics[Math.max(0, Math.min(frame, payload.metrics.length - 1))]
      .step;
  return payload.distributions
    .filter((row) => row.step === step)
    .sort((a, b) => a.bin_index - b.bin_index);
}

export function frameAtTime(payload: Payload, attempts: number): number {
  let frame = -1;
  for (let index = 0; index < payload.metrics.length; index++) {
    if (payload.metrics[index].step / payload.config.agents <= attempts + 1e-10)
      frame = index;
  }
  return frame;
}

export function stability(payload: Payload) {
  const rows = payload.metrics.slice(-4);
  const ranges = (
    ['gini', 'ks_distance_to_exponential', 'entropy'] as const
  ).map((key) => {
    const values = rows.map((row) => row[key]);
    return (
      (Math.max(...values) - Math.min(...values)) /
      (key === 'entropy' ? Math.log(payload.config.bins) : 1)
    );
  });
  if (
    rows.length < 4 ||
    payload.metrics.at(-1)!.step / payload.config.agents < 20
  )
    return 'Insufficient horizon';
  return ranges.every((value) => value <= 0.01)
    ? 'Stable recorded window'
    : 'Still changing';
}

export function buildStrip(payload: Payload, frame: number, columns = 160) {
  const metric =
    payload.metrics[Math.max(0, Math.min(frame, payload.metrics.length - 1))];
  if (metric.gini < 1e-9) return Array<number>(columns).fill(metric.mean);
  const rows = rowsAt(payload, frame);
  let sum = 0;
  const cumulative = rows.map((row) => {
    sum += row.probability;
    return sum;
  });
  return Array.from({ length: columns }, (_, column) => {
    const quantile = (column + 0.5) / columns;
    const found = cumulative.findIndex((edge) => edge >= quantile);
    const index = found < 0 ? rows.length - 1 : found;
    const row = rows[index];
    // Display bin representatives, not invented individual balances or interpolated tails.
    if (payload.config.rule === 'fixed') {
      const amount = payload.config.fixed_amount;
      const offset = payload.config.temperature % amount;
      return Math.max(
        offset,
        offset + Math.round((row.midpoint - offset) / amount) * amount,
      );
    }
    return index === rows.length - 1 ? row.bin_left : row.midpoint;
  });
}

export function number(value: number | undefined, digits = 3) {
  return value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-US', { maximumFractionDigits: digits });
}
export function interval(low: number, high: number) {
  return `${number(low, 5)}–${number(high, 5)}`;
}
