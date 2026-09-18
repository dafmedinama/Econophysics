import { rowsAt } from '@/lib/experiment';
import type { Payload } from '@/lib/experiment';

export type PyramidBand = {
  index: number;
  low: number;
  high: number;
  representative: number;
  people: number;
  money: number;
  peopleUnits: number;
  moneyUnits: number;
  peopleDots: number;
  moneyDots: number;
};

export type LadderRung = {
  multiple: number;
  money: number;
  people: number;
  peopleShare: number;
  moneyShare: number;
};

export type Pyramid = {
  bands: PyramidBand[];
  average: number;
  topEdge: number;
  unitPeople: number;
  totalDots: number;
  maxUnits: number;
  ladder: LadderRung[];
  belowPeople: number;
  belowPeopleShare: number;
  belowMoneyShare: number;
  aboveMoneyShare: number;
  base: PyramidBand;
  apex: PyramidBand;
  widest: PyramidBand;
  gini: number;
  attempts: number;
  reconstructionError: number;
};

// One dot stands for this many agents, chosen on a 1-2-5 ladder so the poster
// carries a few hundred dots whatever the ensemble size.
function dotUnit(agents: number, target = 520) {
  const steps = [1, 2, 5];
  let unit = 1;
  for (let power = 0; power < 12; power++) {
    for (const step of steps) {
      unit = step * 10 ** power;
      if (agents / unit <= target) return unit;
    }
  }
  return unit;
}

// Largest-remainder allocation: the dots sum to the announced total exactly, so
// "one dot = N agents" stays literally true instead of approximately true.
function allocate(values: number[]) {
  const total = Math.round(values.reduce((sum, value) => sum + value, 0));
  const counts = values.map(Math.floor);
  const order = values
    .map((value, index) => ({ rest: value - Math.floor(value), index }))
    .sort((a, b) => b.rest - a.rest);
  let left = total - counts.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < order.length && left > 0; i++, left--)
    counts[order[i].index]++;
  return counts;
}

export function buildPyramid(payload: Payload): Pyramid {
  const frame = payload.metrics.length - 1;
  const metric = payload.metrics[frame];
  const rows = rowsAt(payload, frame);
  const agents = payload.config.agents;
  const average = payload.config.temperature;
  const unitPeople = dotUnit(agents);

  const all = rows.map((row, index) => {
    // The final bin collects the whole right tail, so its left edge is the only
    // representative the histogram actually supports.
    const representative =
      index === rows.length - 1 ? row.bin_left : row.midpoint;
    const people = row.probability * agents;
    return {
      index,
      low: row.bin_left,
      high: row.bin_right,
      representative,
      people,
      money: representative * people,
    };
  });
  const money = all.reduce((sum, band) => sum + band.money, 0);
  // Both wings carry the same number of dots, so a perfectly equal ending would
  // draw as a perfect mirror. The money unit rides the reconstructed total, not
  // the conserved one, because the bands are what the histogram can support.
  const unitMoney = money / (agents / unitPeople);

  // Keep every band up to the highest one a whole agent reaches; above that the
  // histogram is empty, not sparse.
  let last = all.length - 1;
  while (last > 0 && all[last].people < 1) last--;
  const kept = all.slice(0, last + 1);

  const peopleDots = allocate(kept.map((band) => band.people / unitPeople));
  const moneyDots = allocate(kept.map((band) => band.money / unitMoney));
  const bands: PyramidBand[] = kept.map((band, i) => ({
    ...band,
    peopleUnits: band.people / unitPeople,
    moneyUnits: band.money / unitMoney,
    peopleDots: peopleDots[i],
    moneyDots: moneyDots[i],
  }));

  const atOrAbove = (limit: number) => {
    let people = 0,
      held = 0;
    for (const band of bands)
      if (band.representative >= limit) {
        people += band.people;
        held += band.money;
      }
    return { people, money: held };
  };

  const topEdge = bands[bands.length - 1].high;
  const ladder: LadderRung[] = [];
  for (let multiple = 1; multiple * average < topEdge; multiple++) {
    const reach = atOrAbove(multiple * average);
    if (reach.people < 1) break;
    ladder.push({
      multiple,
      money: multiple * average,
      people: reach.people,
      peopleShare: reach.people / agents,
      moneyShare: reach.money / money,
    });
  }

  const above = atOrAbove(average);
  const widest = bands.reduce((best, band) =>
    band.people > best.people ? band : best,
  );
  return {
    bands,
    average,
    topEdge,
    unitPeople,
    totalDots: peopleDots.reduce((sum, value) => sum + value, 0),
    maxUnits: bands.reduce(
      (best, band) => Math.max(best, band.peopleUnits, band.moneyUnits),
      0,
    ),
    ladder,
    belowPeople: agents - above.people,
    belowPeopleShare: (agents - above.people) / agents,
    belowMoneyShare: (money - above.money) / money,
    aboveMoneyShare: above.money / money,
    base: bands[0],
    apex: bands[bands.length - 1],
    widest,
    gini: metric.gini,
    attempts: metric.step / agents,
    reconstructionError: money / payload.config.total_money - 1,
  };
}
