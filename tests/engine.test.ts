import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ENGINE_SETTINGS, runDecisionEngine } from '../src/engine';
import { migrateReminderData } from '../src/services/storage';
import { Reminder } from '../src/types';

const reminder: Reminder = {
  id: 'nearby',
  title: 'Nearby',
  notes: '',
  location: { latitude: 0, longitude: 0 },
  radius: 100,
  isEnabled: true,
  isTriggered: false,
  dwellSeconds: 0,
  createdAt: 1,
};

const baseInput = {
  reminders: [reminder],
  runtime: {},
  stats: { evaluations: 0, eligibleEvaluations: 0, triggered: 0, skipped: 0, rejectedSamples: 0 },
  settings: DEFAULT_ENGINE_SETTINGS,
};

function sample(now: number, overrides: Record<string, number> = {}) {
  return {
    latitude: 0,
    longitude: 0,
    accuracy: 5,
    timestamp: now,
    ...overrides,
  };
}

test('requires consecutive good readings before triggering', () => {
  const first = runDecisionEngine({ ...baseInput, location: sample(1000), now: 1000 });
  assert.equal(first.actions.length, 0);
  assert.equal(first.runtime.nearby.consecutiveInside, 1);
  const second = runDecisionEngine({ ...baseInput, runtime: first.runtime, location: sample(1001), now: 1001 });
  assert.equal(second.actions.length, 1);
  assert.equal(second.runtime.nearby.consecutiveInside, 2);
});

test('does not trigger outside the radius', () => {
  const result = runDecisionEngine({
    ...baseInput,
    location: sample(2000, { latitude: 1, longitude: 1 }),
    now: 2000,
  });
  assert.equal(result.actions.length, 0);
  assert.ok(result.evaluations[0].reasons.includes('outside-radius'));
});

test('honors the cooldown window', () => {
  const first = runDecisionEngine({ ...baseInput, location: sample(1000), now: 1000 });
  const triggered = runDecisionEngine({ ...baseInput, runtime: first.runtime, location: sample(1001), now: 1001 });
  const second = runDecisionEngine({
    ...baseInput,
    runtime: triggered.runtime,
    location: sample(1002),
    now: 1002,
  });
  assert.equal(second.actions.length, 0);
  assert.equal(second.runtime.nearby.lastDecision, 'skipped');
});

test('suppresses over-limit reminders without marking them triggered', () => {
  const reminders = [0, 1, 2, 3].map((id) => ({ ...reminder, id: String(id) }));
  const first = runDecisionEngine({
    ...baseInput,
    reminders,
    location: sample(1000),
    now: 1000,
  });
  const result = runDecisionEngine({
    ...baseInput,
    reminders,
    runtime: first.runtime,
    settings: { ...DEFAULT_ENGINE_SETTINGS, maxTriggersPerRun: 2 },
    location: sample(1001),
    now: 1001,
  });
  assert.equal(result.actions.length, 2);
  assert.equal(result.stats.triggered, 2);
  assert.equal(result.runtime['2'].lastDecision, 'skipped');
  assert.equal(result.runtime['2'].lastTriggeredAt, undefined);
});

test('reports unknown accuracy without changing runtime', () => {
  const result = runDecisionEngine({
    ...baseInput,
    location: { latitude: 0, longitude: 0 },
    now: 1000,
  });
  assert.ok(result.evaluations[0].reasons.includes('location-accuracy-unknown'));
  assert.deepEqual(result.runtime, {});
  assert.equal(result.stats.rejectedSamples, 1);
});

test('poor accuracy does not change inside state', () => {
  const first = runDecisionEngine({ ...baseInput, location: sample(1000), now: 1000 });
  const rejected = runDecisionEngine({
    ...baseInput,
    runtime: first.runtime,
    location: sample(1001, { accuracy: 1000 }),
    now: 1001,
  });
  assert.deepEqual(rejected.runtime, first.runtime);
  assert.equal(rejected.stats.rejectedSamples, 1);
});

test('hysteresis keeps a reminder inside until the exit threshold', () => {
  const first = runDecisionEngine({ ...baseInput, location: sample(1000), now: 1000 });
  const second = runDecisionEngine({ ...baseInput, runtime: first.runtime, location: sample(1001), now: 1001 });
  const nearBoundary = runDecisionEngine({
    ...baseInput,
    runtime: second.runtime,
    location: sample(1002, { latitude: 0.00095 }),
    now: 1002,
  });
  assert.equal(nearBoundary.runtime.nearby.inside, true);
  const outside = runDecisionEngine({
    ...baseInput,
    runtime: nearBoundary.runtime,
    location: sample(1003, { latitude: 0.0015 }),
    now: 1003,
  });
  assert.equal(outside.runtime.nearby.inside, false);
  assert.equal(outside.runtime.nearby.consecutiveInside, 0);
});

test('dwell timer resets after leaving the geofence', () => {
  const dwellReminder = { ...reminder, dwellSeconds: 10 };
  const first = runDecisionEngine({ ...baseInput, reminders: [dwellReminder], location: sample(1000), now: 1000 });
  const second = runDecisionEngine({ ...baseInput, reminders: [dwellReminder], runtime: first.runtime, location: sample(1001), now: 1001 });
  const left = runDecisionEngine({
    ...baseInput,
    reminders: [dwellReminder],
    runtime: second.runtime,
    location: sample(1002, { latitude: 0.002 }),
    now: 1002,
  });
  assert.equal(left.runtime.nearby.enteredAt, undefined);
  assert.equal(left.runtime.nearby.consecutiveInside, 0);
  const reentered = runDecisionEngine({
    ...baseInput,
    reminders: [dwellReminder],
    runtime: left.runtime,
    location: sample(1003),
    now: 1003,
  });
  assert.equal(reentered.actions.length, 0);
});

test('normalizes missing reminder fields during migration', () => {
  const memory = new Map<string, string>();
  memory.set('@geo_reminders', JSON.stringify([{
    id: 'legacy',
    title: 'Legacy',
    notes: '',
    location: { latitude: 1, longitude: 2 },
    radius: 50,
    createdAt: 10,
  }]));
  const migrated = migrateReminderData(memory.get('@geo_reminders') ?? null);
  memory.set('@geo_reminders_v2', JSON.stringify(migrated));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.reminders[0].isEnabled, true);
  assert.equal(migrated.reminders[0].isTriggered, false);
  assert.equal(migrated.reminders[0].dwellSeconds, 0);
  assert.deepEqual(JSON.parse(memory.get('@geo_reminders_v2') ?? ''), migrated);
});

test('migration is idempotent for versioned data', () => {
  const raw = JSON.stringify({ schemaVersion: 2, reminders: [{ ...reminder, dwellSeconds: 5 }] });
  assert.deepEqual(migrateReminderData(raw), migrateReminderData(JSON.stringify(migrateReminderData(raw))));
});
