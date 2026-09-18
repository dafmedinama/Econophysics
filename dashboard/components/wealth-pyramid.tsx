'use client';

import { forwardRef, useMemo } from 'react';
import { experiments, number } from '@/lib/experiment';
import { buildPyramid } from '@/lib/pyramid';
import type { ExperimentKey, Payload } from '@/lib/experiment';
import type { Pyramid } from '@/lib/pyramid';

const view = { width: 1500, height: 820 };
const plot = { top: 150, bottom: 700, centre: 750, half: 468 };
const gutter = { left: 258, right: 1242 };
// Share callouts hang this far off the spine; bands wider than that push them up.
const wing = 210;

const aqua = '#46ffd9';
const acid = '#ccff33';
const muted = '#a0a0a0';
const quiet = '#6f6f6f';
const bright = '#f5f5f5';
const mono = 'var(--dm-font-instrument, monospace)';

const count = (value: number) => Math.round(value).toLocaleString('en-US');

export const WealthPyramid = forwardRef<
  SVGSVGElement,
  { payload: Payload; selected: ExperimentKey }
>(function WealthPyramid({ payload, selected }, ref) {
  const model = useMemo(() => buildPyramid(payload), [payload]);
  const g = useMemo(() => layout(model), [model]);

  return (
    <svg
      ref={ref}
      className="pyramid-graphic"
      viewBox={'0 0 ' + view.width + ' ' + view.height}
      aria-labelledby="pyramid-title pyramid-description"
      style={{ fontFamily: 'Gilroy, Arial, sans-serif' }}
    >
      <title id="pyramid-title">
        Wealth pyramid of the final money distribution
      </title>
      <desc id="pyramid-description">
        Agents are stacked by how much money they hold. The population wing on
        the right is widest at the bottom:{' '}
        {number(model.belowPeopleShare * 100, 1)} percent of agents finish below
        the average and hold {number(model.belowMoneyShare * 100, 1)} percent of
        the money. The money wing on the left is widest above the average line,
        where {number(model.aboveMoneyShare * 100, 1)} percent of the money
        sits.
      </desc>

      <rect width={view.width} height={view.height} fill="#141414" />

      <text
        className="pyramid-fine"
        x="44"
        y="50"
        fill={aqua}
        fontSize="20"
        fontWeight="650"
        letterSpacing="2.2"
      >
        THE WEALTH PYRAMID
      </text>
      <text className="pyramid-fine" x="44" y="80" fill={muted} fontSize="17">
        {experiments[selected].label} · {count(payload.config.agents)} agents ·
        final recorded observation
      </text>
      <text
        className="pyramid-fine"
        x={view.width - 44}
        y="50"
        fill={muted}
        fontSize="18"
        textAnchor="end"
        fontFamily={mono}
      >
        GINI {number(model.gini)}
      </text>
      <text
        className="pyramid-fine"
        x={view.width - 44}
        y="80"
        fill={quiet}
        fontSize="16"
        textAnchor="end"
      >
        {number(model.attempts, 2)} exchange attempts per agent
      </text>

      {/* Wing headers, colour-keyed, straddling the axis they divide. */}
      <text
        className="pyramid-fine"
        x={plot.centre - 24}
        y="112"
        fill={acid}
        fontSize="20"
        fontWeight="650"
        letterSpacing="2"
        textAnchor="end"
      >
        THE MONEY THEY HOLD
      </text>
      <text
        className="pyramid-fine"
        x={plot.centre + 24}
        y="112"
        fill={aqua}
        fontSize="20"
        fontWeight="650"
        letterSpacing="2"
      >
        THE PEOPLE
      </text>
      <text
        className="pyramid-fine"
        x={gutter.left}
        y="112"
        fill={quiet}
        fontSize="15"
        letterSpacing="1.4"
        textAnchor="end"
      >
        MONEY HELD
      </text>
      <text
        className="pyramid-fine"
        x={gutter.right}
        y="112"
        fill={quiet}
        fontSize="15"
        letterSpacing="1.4"
      >
        PEOPLE AT OR ABOVE
      </text>

      {g.rungs.map((rung) => (
        <g key={rung.multiple} aria-hidden="true">
          <line
            x1={gutter.left + 14}
            y1={rung.y}
            x2={gutter.right - 14}
            y2={rung.y}
            stroke={bright}
            strokeOpacity={rung.average ? 0 : 0.06}
          />
          <text
            className="pyramid-fine"
            x={gutter.left}
            y={rung.y + (rung.average ? -2 : 6)}
            fill={rung.average ? bright : muted}
            fontSize={rung.average ? 20 : 18}
            fontWeight={rung.average ? 600 : 400}
            textAnchor="end"
            fontFamily={mono}
          >
            {rung.average ? 'T = ' + count(rung.money) : rung.multiple + '×T'}
          </text>
          {rung.average && (
            <text
              className="pyramid-fine"
              x={gutter.left}
              y={rung.y + 20}
              fill={quiet}
              fontSize="14"
              letterSpacing="1.1"
              textAnchor="end"
            >
              EVERYONE STARTED HERE
            </text>
          )}
          <text
            className="pyramid-fine"
            x={gutter.right}
            y={rung.y + 6}
            fill={rung.average ? bright : muted}
            fontSize={rung.average ? 20 : 18}
            fontWeight={rung.average ? 600 : 400}
            fontFamily={mono}
          >
            {count(rung.people)}
          </text>
        </g>
      ))}

      {/* The spine: where one wing ends and the other begins. */}
      <line
        x1={plot.centre}
        y1={plot.top - 8}
        x2={plot.centre}
        y2={plot.bottom + 8}
        stroke={bright}
        strokeOpacity="0.22"
      />

      <g className="pyramid-bands">
        {g.bands.map((band) => (
          <g
            key={band.index}
            className="pyramid-band"
            style={{ '--rank': band.rank } as React.CSSProperties}
          >
            <rect
              x={plot.centre - band.moneyWidth}
              y={band.y}
              width={band.moneyWidth}
              height={band.height}
              fill={acid}
              fillOpacity="0.2"
            />
            <rect
              x={plot.centre - band.moneyWidth}
              y={band.y}
              width="1.4"
              height={band.height}
              fill={acid}
              fillOpacity="0.65"
            />
            <rect
              x={plot.centre}
              y={band.y}
              width={band.peopleWidth}
              height={band.height}
              fill={aqua}
              fillOpacity="0.2"
            />
            <rect
              x={plot.centre + band.peopleWidth - 1.4}
              y={band.y}
              width="1.4"
              height={band.height}
              fill={aqua}
              fillOpacity="0.65"
            />
            {band.moneyDots.map((x, i) => (
              <circle
                key={'m' + i}
                cx={x}
                cy={band.centre}
                r={band.radius}
                fill={acid}
              />
            ))}
            {band.peopleDots.map((x, i) => (
              <circle
                key={'p' + i}
                cx={x}
                cy={band.centre}
                r={band.radius}
                fill={aqua}
              />
            ))}
          </g>
        ))}
      </g>

      <g className="pyramid-average">
        <line
          x1={gutter.left + 14}
          y1={g.averageY}
          x2={gutter.right - 14}
          y2={g.averageY}
          stroke={bright}
          strokeWidth="2"
          strokeOpacity="0.9"
        />
      </g>

      {/* The two shares, parked in the sky the pyramid never reaches. */}
      <g className="pyramid-shares">
        <text
          x={plot.centre - wing}
          y={g.skyY}
          fill={acid}
          fontSize="44"
          fontWeight="600"
          textAnchor="end"
          fontFamily={mono}
        >
          {number(model.belowMoneyShare * 100, 1)}%
        </text>
        <text
          x={plot.centre - wing}
          y={g.skyY + 30}
          fill={bright}
          fontSize="19"
          textAnchor="end"
        >
          of the money is below the line
        </text>
        <text
          x={plot.centre + wing}
          y={g.skyY}
          fill={aqua}
          fontSize="44"
          fontWeight="600"
          fontFamily={mono}
        >
          {number(model.belowPeopleShare * 100, 1)}%
        </text>
        <text x={plot.centre + wing} y={g.skyY + 30} fill={bright} fontSize="19">
          of the people stand below it
        </text>
        <text x={plot.centre + wing} y={g.skyY + 55} fill={quiet} fontSize="17">
          {count(model.belowPeople)} agents
        </text>
      </g>

      {/* Apex: the thinnest tail the histogram can still vouch for. */}
      <g className="pyramid-apex">
        <line
          x1={plot.centre + 12}
          y1={g.apexY}
          x2={plot.centre + 134}
          y2={g.apexY}
          stroke={aqua}
          strokeWidth="1"
          strokeOpacity="0.55"
          strokeDasharray="3 4"
        />
        <circle cx={plot.centre + 4} cy={g.apexY} r="3.4" fill={aqua} />
        <text
          x={plot.centre + 148}
          y={g.apexY - 5}
          fill={bright}
          fontSize="26"
          fontWeight="600"
        >
          {count(model.apex.people)}{' '}
          {model.apex.people < 1.5 ? 'agent' : 'agents'}
        </text>
        <text
          x={plot.centre + 148}
          y={g.apexY + 20}
          fill={muted}
          fontSize="17"
        >
          at {number(model.apex.low / model.average, 1)}–
          {number(model.apex.high / model.average, 1)}× the average
        </text>
      </g>

      {/* Base: where the crowd actually stands. */}
      <g className="pyramid-base pyramid-fine">
        <text
          x={plot.centre}
          y={plot.bottom + 34}
          fill={muted}
          fontSize="18"
          textAnchor="middle"
        >
          <tspan fill={bright} fontWeight="600">
            {count(model.base.people)} agents
          </tspan>{' '}
          sit in the bottom band, under{' '}
          {number(model.base.high / model.average, 2)}× the average
        </text>
      </g>

      <line
        className="pyramid-fine"
        x1="44"
        y1={view.height - 62}
        x2={view.width - 44}
        y2={view.height - 62}
        stroke={bright}
        strokeOpacity="0.13"
      />
      <circle className="pyramid-fine" cx="50" cy={view.height - 35} r="4" fill={aqua} />
      <text className="pyramid-fine" x="70" y={view.height - 29} fill={muted} fontSize="17">
        one dot = {count(model.unitPeople)} agents
      </text>
      <circle className="pyramid-fine" cx="330" cy={view.height - 35} r="4" fill={acid} />
      <text className="pyramid-fine" x="350" y={view.height - 29} fill={muted} fontSize="17">
        one dot = the money {count(model.unitPeople)} average agents would hold
      </text>
      <text
        className="pyramid-fine"
        x={view.width - 44}
        y={view.height - 29}
        fill={bright}
        fontSize="17"
        fontWeight="600"
        textAnchor="end"
      >
        Both wings carry {count(model.totalDots)} dots — an equal ending would
        mirror.
      </text>
    </svg>
  );
});

function layout(model: Pyramid) {
  const height = plot.bottom - plot.top;
  const y = (money: number) => plot.bottom - (money / model.topEdge) * height;
  const pitch = plot.half / model.maxUnits;
  // Bloom outward from the average line, because that is where they all began.
  const centreBand = model.bands.reduce(
    (best, band, index) =>
      Math.abs(band.representative - model.average) <
      Math.abs(model.bands[best].representative - model.average)
        ? index
        : best,
    0,
  );

  const bands = model.bands.map((band, index) => {
    const top = y(band.high);
    const bottom = y(band.low);
    const dots = (total: number, direction: number) =>
      Array.from(
        { length: total },
        (_, i) => plot.centre + direction * pitch * (i + 0.5),
      );
    return {
      index: band.index,
      rank: Math.abs(index - centreBand),
      y: top,
      height: Math.max(bottom - top - 1, 1),
      centre: (top + bottom) / 2,
      radius: Math.max(0.85, Math.min(3.2, pitch * 0.34, (bottom - top) * 0.34)),
      peopleWidth: band.peopleUnits * pitch,
      moneyWidth: band.moneyUnits * pitch,
      peopleDots: dots(band.peopleDots, 1),
      moneyDots: dots(band.moneyDots, -1),
    };
  });

  // Park the headline shares in the highest stretch both wings leave empty.
  const crowded = bands.findLast(
    (band) => band.peopleWidth > wing - 10 || band.moneyWidth > wing - 10,
  );
  const skyY = Math.max(
    plot.top + 130,
    Math.min((crowded?.y ?? plot.top) - 76, y(model.average) - 112),
  );

  return {
    bands,
    pitch,
    skyY,
    averageY: y(model.average),
    apexY: (y(model.apex.low) + y(model.apex.high)) / 2,
    rungs: model.ladder.map((rung) => ({
      ...rung,
      y: y(rung.money),
      average: rung.multiple === 1,
    })),
  };
}
