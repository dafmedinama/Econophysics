import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildStrip,
  experimentKeys,
  frameAtTime,
  parsePayload,
  stability,
} from '../lib/experiment.ts';

const read = (key) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/data/${key}.json`, import.meta.url),
      'utf8',
    ),
  );

test('all published payloads are complete, finite and correctly identified', () => {
  for (const key of experimentKeys) {
    const payload = parsePayload(read(key), key.replaceAll('-', '_'));
    assert.equal(stability(payload), 'Insufficient horizon');
    assert.equal(payload.metrics.at(-1).step / payload.config.agents, 2.5);
    assert.ok(
      buildStrip(payload, 0).every(
        (value) => value === payload.config.temperature,
      ),
    );
  }
});

test('invalid schemas, mismatched rules, missing bins and invalid probabilities are rejected', () => {
  const payload = read('system-average');
  assert.throws(
    () => parsePayload({ ...payload, schemaVersion: 1 }),
    /schema 2/,
  );
  assert.throws(() => parsePayload(payload, 'fixed'), /different exchange/);
  assert.throws(
    () =>
      parsePayload({
        ...payload,
        distributions: payload.distributions.slice(1),
      }),
    /incomplete/,
  );
  payload.distributions[0].probability = NaN;
  assert.throws(() => parsePayload(payload), /numeric/);
});

test('comparison never uses an observation later than the requested time', () => {
  const payload = parsePayload(read('pair-average'));
  assert.equal(frameAtTime(payload, 0.49), 1);
  assert.equal(frameAtTime(payload, 0), 0);
  assert.equal(frameAtTime(payload, 100), payload.metrics.length - 1);
});

test('fixed-exchange representatives stay on the balance lattice', () => {
  const payload = parsePayload(read('fixed'));
  const values = buildStrip(payload, payload.metrics.length - 1);
  assert.equal(values.length, 160);
  assert.ok(values.every((value) => value % payload.config.fixed_amount === 0));
  assert.deepEqual(
    values,
    [...values].sort((a, b) => a - b),
  );
});

test('confidence intervals must contain their estimate', () => {
  const payload = read('system-average');
  payload.metrics[1].gini_ci_low = 1;
  assert.throws(() => parsePayload(payload), /confidence interval/);
});
