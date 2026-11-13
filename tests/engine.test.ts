import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ENGINE_SETTINGS, normalizeLocation, runDecisionEngine } from '../src/engine';
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

test('triggers an eligible nearby reminder', () => {
  const result = runDecisionEngine({
    ...baseInput,
    location: { latitude: 0, longitude: 0, accuracy: 5 },
    now: 1000,
  });
  assert.equal(result.actions.length, 1);
  assert.equal(result.stats.triggered, 1);
  assert.equal(result.runtime.nearby.lastDecision, 'triggered');
});

test('does not trigger outside the radius', () => {
  const result = runDecisionEngine({
    ...baseInput,
    location: { latitude: 1, longitude: 1, accuracy: 5 },
    now: 2000,
  });
  assert.equal(result.actions.length, 0);
  assert.ok(result.evaluations[0].reasons.includes('outside-radius'));
});

test('honors the cooldown window', () => {
  const first = runDecisionEngine({
    ...baseInput,
    location: { latitude: 0, longitude: 0, accuracy: 5 },
    now: 1000,
  });
  const second = runDecisionEngine({
    ...baseInput,
    runtime: first.runtime,
    location: { latitude: 0, longitude: 0, accuracy: 5 },
    now: 1001,
  });
  assert.equal(second.actions.length, 0);
  assert.equal(second.runtime.nearby.lastDecision, 'skipped');
});

test('suppresses over-limit reminders without marking them triggered', () => {
  const reminders = [0, 1, 2, 3].map((id) => ({ ...reminder, id: String(id) }));
  const result = runDecisionEngine({
    ...baseInput,
    reminders,
    settings: { ...DEFAULT_ENGINE_SETTINGS, maxTriggersPerRun: 2 },
    location: { latitude: 0, longitude: 0, accuracy: 5 },
    now: 1000,
  });
  assert.equal(result.actions.length, 2);
  assert.equal(result.stats.triggered, 2);
  assert.equal(result.runtime['2'].lastDecision, 'skipped');
  assert.equal(result.runtime['2'].lastTriggeredAt, undefined);
});

test('reports unknown accuracy separately', () => {
  const result = runDecisionEngine({
    ...baseInput,
    location: { latitude: 0, longitude: 0 },
    now: 1000,
  });
  assert.ok(result.evaluations[0].reasons.includes('location-accuracy-unknown'));
  assert.ok(!result.evaluations[0].reasons.includes('location-inaccurate'));
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
  const raw = JSON.stringify({
    schemaVersion: 2,
    reminders: [{ ...reminder, dwellSeconds: 5 }],
  });
  assert.deepEqual(migrateReminderData(raw), migrateReminderData(JSON.stringify(migrateReminderData(raw))));
});
