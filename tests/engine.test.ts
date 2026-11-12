import assert from 'node:assert/strict';
import { runDecisionEngine, DEFAULT_ENGINE_SETTINGS } from '../src/engine';
import { Reminder } from '../src/types';

const reminder: Reminder = {
  id: 'nearby',
  title: 'Nearby',
  notes: '',
  location: { latitude: 0, longitude: 0 },
  radius: 100,
  isEnabled: true,
  isTriggered: false,
  createdAt: 1,
};

const baseInput = {
  reminders: [reminder],
  runtime: {},
  stats: { evaluations: 0, eligibleEvaluations: 0, triggered: 0, skipped: 0 },
  settings: DEFAULT_ENGINE_SETTINGS,
};

const triggered = runDecisionEngine({
  ...baseInput,
  location: { latitude: 0, longitude: 0, accuracy: 5 },
  now: 1000,
});
assert.equal(triggered.actions.length, 1);
assert.equal(triggered.stats.triggered, 1);
assert.equal(triggered.runtime.nearby.lastDecision, 'triggered');

const outside = runDecisionEngine({
  ...baseInput,
  location: { latitude: 1, longitude: 1, accuracy: 5 },
  now: 2000,
});
assert.equal(outside.actions.length, 0);
assert.ok(outside.evaluations[0].reasons.includes('outside-radius'));

const cooldown = runDecisionEngine({
  ...baseInput,
  runtime: triggered.runtime,
  location: { latitude: 0, longitude: 0, accuracy: 5 },
  now: 1001,
});
assert.equal(cooldown.actions.length, 0);
assert.equal(cooldown.runtime.nearby.lastDecision, 'skipped');

console.log('engine tests passed');
