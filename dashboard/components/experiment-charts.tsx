'use client';

import { useEffect, useMemo, useState } from 'react';
import { EChart } from '@/components/e-chart';
import { number, rowsAt } from '@/lib/experiment';
import type { MetricKey, Payload } from '@/lib/experiment';
import type { EChartsCoreOption } from 'echarts/core';

type Palette = {
  ink: string;
  muted: string;
  space: string;
  aqua: string;
  acid: string;
  violet: string;
  line: string;
};

export default function ExperimentCharts({
  payload,
  frame,
  mode,
  reduced,
  normalized = false,
  compact = false,
}: {
  payload: Payload;
  frame: number;
  mode: 'distribution' | 'diagnostics';
  reduced: boolean;
  normalized?: boolean;
  compact?: boolean;
}) {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) =>
      style.getPropertyValue(`--dm-color-${name}`).trim();
    const timer = requestAnimationFrame(() =>
      setPalette({
        ink: token('ink'),
        muted: token('muted'),
        space: token('space'),
        aqua: token('aqua'),
        acid: token('acid'),
        violet: token('violet'),
        line: token('line'),
      }),
    );
    return () => cancelAnimationFrame(timer);
  }, []);
  const option = useMemo(() => {
    if (!palette) return null;
    return mode === 'distribution'
      ? distributionOption(
          payload,
          frame,
          normalized,
          compact,
          palette,
          reduced,
        )
      : diagnosticsOption(payload, frame, palette, reduced);
  }, [payload, frame, mode, normalized, compact, palette, reduced]);
  return option ? (
    <EChart
      option={option}
      className="chart-surface mt-4 w-full"
      ariaLabel={
        mode === 'distribution'
          ? 'Ensemble histogram and 95% confidence band. Numeric tables are available in this view.'
          : 'Gini, exponential distance and entropy with 95% confidence bands. Observation data follows.'
      }
    />
  ) : (
    <output className="block p-8 text-sm">Preparing chart…</output>
  );
}

function base(p: Palette, reduced: boolean): EChartsCoreOption {
  return {
    animation: !reduced,
    animationDuration: 0,
    animationDurationUpdate: reduced ? 0 : 650,
    grid: { left: 70, right: 55, top: 65, bottom: 65 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: p.space,
      borderColor: p.line,
      textStyle: { color: p.ink, fontSize: 14 },
      valueFormatter: (value: number) => number(value, 6),
    },
    legend: { top: 4, textStyle: { color: p.muted, fontSize: 12 } },
  };
}

function bands(
  id: string,
  xs: number[],
  lows: number[],
  highs: number[],
  color: string,
  yAxisIndex = 0,
) {
  return [
    {
      id: `${id}-floor`,
      type: 'line',
      stack: id,
      stackStrategy: 'all',
      yAxisIndex,
      data: xs.map((x, i) => [x, lows[i]]),
      showSymbol: false,
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
      tooltip: { show: false },
    },
    {
      id: `${id}-band`,
      type: 'line',
      stack: id,
      stackStrategy: 'all',
      yAxisIndex,
      data: xs.map((x, i) => [x, Math.max(highs[i] - lows[i], 0)]),
      showSymbol: false,
      lineStyle: { opacity: 0 },
      areaStyle: { color, opacity: 0.2 },
      silent: true,
      tooltip: { show: false },
    },
  ];
}

function distributionOption(
  payload: Payload,
  frame: number,
  normalized: boolean,
  compact: boolean,
  p: Palette,
  reduced: boolean,
): EChartsCoreOption {
  const rows = rowsAt(payload, frame),
    scale = normalized ? payload.config.temperature : 1;
  const xs = rows.map((row) => row.midpoint / scale);
  return {
    ...base(p, reduced),
    ...(compact
      ? { grid: { left: 34, right: 12, top: 12, bottom: 24 } }
      : {}),
    legend: {
      show: !compact,
      data: ['Ensemble mean', 'Exponential reference'],
      textStyle: { color: p.muted },
      top: 4,
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: normalized ? 14 : rows.at(-1)!.bin_right / scale,
      name: compact ? '' : normalized ? 'Money / T' : 'Money per agent',
      nameLocation: 'middle',
      nameGap: 38,
      nameTextStyle: { color: p.muted, fontSize: 14 },
      axisLabel: {
        color: p.muted,
        hideOverlap: true,
        showMaxLabel: false,
        formatter: (value: number) => number(value, normalized ? 1 : 0),
      },
      splitLine: { lineStyle: { color: p.line } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: compact ? 1 : undefined,
      name: compact ? '' : 'Probability / bin',
      splitNumber: compact ? 2 : 5,
      nameTextStyle: { color: p.muted },
      axisLabel: { color: p.muted },
      splitLine: { lineStyle: { color: p.line } },
    },
    series: [
      ...bands(
        'probability',
        xs,
        rows.map((row) => row.probability_ci_low),
        rows.map((row) => row.probability_ci_high),
        p.violet,
      ),
      {
        id: 'mean',
        name: 'Ensemble mean',
        type: 'bar',
        data: rows.map((row, i) => [xs[i], row.probability]),
        barMaxWidth: 18,
        itemStyle: { color: p.aqua },
      },
      {
        id: 'reference',
        name: 'Exponential reference',
        type: 'line',
        data: rows.map((row, i) => [xs[i], row.theoretical_probability]),
        showSymbol: false,
        lineStyle: { color: p.acid, width: 2 },
      },
    ],
  };
}

function diagnosticsOption(
  payload: Payload,
  frame: number,
  p: Palette,
  reduced: boolean,
): EChartsCoreOption {
  const xs = payload.metrics.map((row) => row.step / payload.config.agents);
  const specs: [MetricKey, string, string, number][] = [
    ['gini', 'Gini', p.aqua, 0],
    ['ks_distance_to_exponential', 'KS distance', p.violet, 0],
    ['entropy', 'Entropy', p.acid, 1],
  ];
  const series = specs.flatMap(([key, name, color, axis]) => [
    ...bands(
      key,
      xs,
      payload.metrics.map((row) => row[`${key}_ci_low`]),
      payload.metrics.map((row) => row[`${key}_ci_high`]),
      color,
      axis,
    ),
    {
      id: key,
      name,
      type: 'line',
      yAxisIndex: axis,
      data: payload.metrics.map((row, i) => [xs[i], row[key]]),
      showSymbol: true,
      symbolSize: 4,
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      ...(key === 'gini'
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: p.ink, type: 'dashed' },
              label: { show: false },
              data: [{ xAxis: xs[frame] }],
            },
          }
        : {}),
    },
  ]);
  return {
    ...base(p, reduced),
    legend: {
      data: specs.map((spec) => spec[1]),
      textStyle: { color: p.muted },
      top: 4,
    },
    xAxis: {
      type: 'value',
      min: 0,
      name: 'Attempts per agent',
      nameLocation: 'middle',
      nameGap: 38,
      nameTextStyle: { color: p.muted, fontSize: 14 },
      axisLabel: { color: p.muted },
      splitLine: { lineStyle: { color: p.line } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Gini / KS',
        min: 0,
        max: 1,
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.line } },
      },
      {
        type: 'value',
        name: 'Entropy',
        nameTextStyle: { color: p.muted },
        axisLabel: { color: p.muted },
        splitLine: { show: false },
      },
    ],
    series,
  };
}
