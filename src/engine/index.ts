import { EngineSettings } from '../types';
import { evaluateReminder } from './phase2';
import { normalizeLocation } from './phase1';
import { applyDecisions } from './phase4';
import { rankEligibleEvaluations } from './phase3';
import { EngineInput, EngineOutput } from './types';

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  enabled: true,
  minimumScore: 0.2,
  cooldownMs: 60_000,
  maxTriggersPerRun: 3,
  locationAccuracyMeters: 100,
};

export function runDecisionEngine(input: EngineInput): EngineOutput {
  const now = input.now ?? Date.now();
  const settings = { ...DEFAULT_ENGINE_SETTINGS, ...input.settings };
  const location = normalizeLocation(input.location, now);
  if (!settings.enabled || !location) {
    return {
      actions: [],
      evaluations: [],
      runtime: input.runtime,
      stats: { ...input.stats, lastRunAt: now },
    };
  }

  const evaluations = input.reminders.map((reminder) =>
    evaluateReminder(reminder, location, settings.locationAccuracyMeters));
  const ranked = rankEligibleEvaluations(evaluations, settings);
  const rankedIds = new Set(ranked.map((evaluation) => evaluation.reminder.id));
  const ordered = [...ranked, ...evaluations.filter((evaluation) => !rankedIds.has(evaluation.reminder.id))];
  const decision = applyDecisions(ordered, input.runtime, input.stats, settings, now);
  return { ...decision, evaluations };
}

export * from './types';
export * from './phase1';
export * from './phase2';
export * from './phase3';
export * from './phase4';
