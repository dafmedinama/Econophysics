'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { buildStrip, experiments, number } from '@/lib/experiment';
import { buildPyramid } from '@/lib/pyramid';
import { WealthPyramid } from '@/components/wealth-pyramid';
import type { ExperimentKey, Payload } from '@/lib/experiment';

type WealthReading = {
  curvePath: string;
  gapPath: string;
  poorestShare: number;
  richestShare: number;
  poorPoint: { x: number; y: number };
  richPoint: { x: number; y: number };
};

const plot = { left: 54, right: 736, top: 26, bottom: 356 };
const plotWidth = plot.right - plot.left;
const plotHeight = plot.bottom - plot.top;
const sx = (share: number) => plot.left + share * plotWidth;
const sy = (share: number) => plot.bottom - share * plotHeight;
const poster = { width: 3000, height: 1640 };

export function WealthResult({
  payload,
  reduced,
  selected,
}: {
  payload: Payload;
  reduced: boolean;
  selected: ExperimentKey;
}) {
  const figure = useRef<SVGSVGElement>(null);
  const reading = useMemo(() => buildReading(payload), [payload]);
  const model = useMemo(() => buildPyramid(payload), [payload]);
  const below = useCountUp(model.belowPeopleShare * 100, reduced);

  const download = () => {
    if (!figure.current) return;
    const copy = figure.current.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', String(poster.width));
    copy.setAttribute('height', String(poster.height));
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], {
        type: 'image/svg+xml',
      }),
    );
    const picture = new Image();
    picture.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = poster.width;
      canvas.height = poster.height;
      canvas
        .getContext('2d')!
        .drawImage(picture, 0, 0, poster.width, poster.height);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `wealth-pyramid-${payload.config.rule}.png`;
      link.click();
    };
    picture.onerror = () => URL.revokeObjectURL(url);
    picture.src = url;
  };

  return (
    <article
      className="wealth-edition"
      data-reduced={reduced}
      aria-label="Wealth pyramid plate"
    >
      <header className="wealth-masthead">
        <p>
          <span>THE MONEY EXPERIMENT</span> / FIELD NOTE 01
        </p>
        <p>FINAL RECORDED OBSERVATION</p>
        <p>{experiments[selected].label}</p>
      </header>

      <div className="wealth-spread">
        <section className="wealth-story" aria-labelledby="wealth-title">
          <p className="wealth-folio">DISTRIBUTION / RANDOM EXCHANGE</p>
          <h2 id="wealth-title">
            {number(below, 0)}%
            <em>end up below average.</em>
          </h2>
          <p className="wealth-deck">
            {number(payload.config.agents, 0)} agents opened with exactly the
            same balance. None of them was assigned more merit, effort or
            ability than another. After {number(model.attempts, 2)} exchange
            attempts each, the crowd had sorted itself into a pyramid — and{' '}
            {number(model.aboveMoneyShare * 100, 1)}% of the money had settled
            above the line they all started on.
          </p>

          <figure className="wealth-lorenz">
            <figcaption>
              <span>FIG. 01 / LORENZ CURVE</span>
              For the record: the poorest half holds{' '}
              {number(reading.poorestShare * 100, 1)}% of the money, the richest
              tenth {number(reading.richestShare * 100, 1)}%.
            </figcaption>
            <LorenzGraphic reading={reading} />
          </figure>

          <dl className="wealth-imprint">
            <div>
              <dt>Gini</dt>
              <dd>{number(model.gini)}</dd>
            </div>
            <div>
              <dt>Agents / run</dt>
              <dd>{number(payload.config.agents, 0)}</dd>
            </div>
            <div>
              <dt>Runs</dt>
              <dd>{number(payload.config.replicates, 0)}</dd>
            </div>
          </dl>
        </section>

        <div className="wealth-plate">
          <WealthPyramid ref={figure} payload={payload} selected={selected} />
        </div>
      </div>

      <footer className="wealth-colophon">
        <ol>
          <li>
            Bands are the {payload.config.bins}-bin ensemble histogram; the
            reconstructed total overshoots the conserved one by{' '}
            {number(Math.abs(model.reconstructionError) * 100, 2)}%.
          </li>
          <li>
            Money here is a conserved model quantity—not real-world wealth,
            welfare or merit.
          </li>
          <li>
            This finite observation does not establish equilibrium or
            inevitability.
          </li>
        </ol>
        <button onClick={download}>
          <Download aria-hidden="true" />
          Download poster
        </button>
      </footer>
    </article>
  );
}

// Numerals climb to the measured value; reduced motion lands on it immediately.
function useCountUp(target: number, reduced: boolean, duration = 1400) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min((now - started) / duration, 1);
      setProgress(elapsed);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, duration]);
  return reduced ? target : target * (1 - (1 - progress) ** 3);
}

function buildReading(payload: Payload): WealthReading {
  const profile = buildStrip(payload, payload.metrics.length - 1);
  const total = profile.reduce((sum, value) => sum + value, 0);
  let cumulative = 0;
  const curve = [
    { x: 0, y: 0 },
    ...profile.map((value, index) => {
      cumulative += value;
      return { x: (index + 1) / profile.length, y: cumulative / total };
    }),
  ];
  const poorestShare = curve[profile.length / 2].y;
  const ninety = curve[Math.round(profile.length * 0.9)];
  const points = curve.map(({ x, y }) => `${sx(x)},${sy(y)}`);
  const reverseCurve = [...points].reverse().join(' L ');
  return {
    curvePath: `M ${points.join(' L ')}`,
    gapPath: `M ${sx(0)},${sy(0)} L ${sx(1)},${sy(1)} L ${reverseCurve} Z`,
    poorestShare,
    richestShare: 1 - ninety.y,
    poorPoint: { x: sx(0.5), y: sy(poorestShare) },
    richPoint: { x: sx(0.9), y: sy(ninety.y) },
  };
}

const LorenzGraphic = forwardRef<SVGSVGElement, { reading: WealthReading }>(
  function LorenzGraphic({ reading }, ref) {
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    return (
      <svg
        ref={ref}
        className="wealth-lorenz-graphic"
        viewBox="0 0 760 392"
        aria-labelledby="lorenz-title lorenz-description"
        style={{ fontFamily: 'Gilroy, Arial, sans-serif' }}
      >
        <title id="lorenz-title">
          Lorenz curve of the final money distribution
        </title>
        <desc id="lorenz-description">
          The poorest half holds {number(reading.poorestShare * 100, 1)} percent
          of money and the richest tenth holds{' '}
          {number(reading.richestShare * 100, 1)} percent.
        </desc>
        <defs>
          <pattern
            id="inequality-hatch"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="9"
              stroke="#ccff33"
              strokeOpacity="0.28"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {ticks.map((tick) => (
          <g key={`grid-${tick}`} aria-hidden="true">
            <line
              x1={sx(tick)}
              y1={plot.top}
              x2={sx(tick)}
              y2={plot.bottom}
              stroke="#f3f3f3"
              strokeOpacity="0.08"
            />
            <line
              x1={plot.left}
              y1={sy(tick)}
              x2={plot.right}
              y2={sy(tick)}
              stroke="#f3f3f3"
              strokeOpacity="0.08"
            />
            <text
              x={sx(tick)}
              y={plot.bottom + 26}
              fill="#6f6f6f"
              fontSize="15"
              textAnchor="middle"
            >
              {tick * 100}
            </text>
            <text
              x={plot.left - 14}
              y={sy(tick) + 5}
              fill="#6f6f6f"
              fontSize="15"
              textAnchor="end"
            >
              {tick * 100}
            </text>
          </g>
        ))}

        <path d={reading.gapPath} fill="url(#inequality-hatch)" />
        <line
          x1={plot.left}
          y1={plot.bottom}
          x2={plot.right}
          y2={plot.top}
          stroke="#f3f3f3"
          strokeDasharray="6 7"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        <path
          className="lorenz-curve-line"
          d={reading.curvePath}
          pathLength="1"
          fill="none"
          stroke="#46ffd9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <circle
          data-point="poor"
          cx={reading.poorPoint.x}
          cy={reading.poorPoint.y}
          r="6"
          fill="#171717"
          stroke="#46ffd9"
          strokeWidth="3"
        />
        <circle
          data-point="rich"
          cx={reading.richPoint.x}
          cy={reading.richPoint.y}
          r="5"
          fill="#ccff33"
        />
      </svg>
    );
  },
);
