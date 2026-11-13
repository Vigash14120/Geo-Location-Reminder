import { EngineSettings } from '../types';
import { evaluateReminder } from './phase2';
import { normalizeLocation } from './phase1';
import { applyDecisions } from './phase4';
import { rankEligibleEvaluations } from './phase3';
import { EngineInput, EngineOutput } from './types';
import { ENGINE_CONFIG } from './config';
import { isReminderEligibleByChain } from './chain';

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  enabled: true,
  minimumScore: ENGINE_CONFIG.minimumScore,
  cooldownMs: ENGINE_CONFIG.cooldownMs,
  maxTriggersPerRun: ENGINE_CONFIG.maxTriggersPerRun,
  locationAccuracyMeters: ENGINE_CONFIG.maxAccuracyMeters,
  exitFactor: ENGINE_CONFIG.exitFactor,
  requiredConsecutiveReadings: ENGINE_CONFIG.requiredConsecutiveReadings,
};

export function runDecisionEngine(input: EngineInput): EngineOutput {
  const settings = { ...DEFAULT_ENGINE_SETTINGS, ...input.settings };
  const location = normalizeLocation(input.location, input.now);
  if (!settings.enabled || !location) {
    return {
      actions: [],
      evaluations: [],
      runtime: input.runtime,
      stats: { ...input.stats, lastRunAt: input.now },
    };
  }

  const eligibleReminders = input.reminders.filter((reminder) =>
    isReminderEligibleByChain(reminder, input.reminders));
  const evaluations = eligibleReminders.map((reminder) =>
    evaluateReminder(reminder, location, settings.locationAccuracyMeters, input.now));
  if (!Number.isFinite(location.accuracy) || location.accuracy > settings.locationAccuracyMeters) {
    return {
      actions: [],
      evaluations,
      runtime: input.runtime,
      stats: {
        ...input.stats,
        rejectedSamples: input.stats.rejectedSamples + 1,
        lastRunAt: input.now,
      },
    };
  }
  const ranked = rankEligibleEvaluations(evaluations, settings);
  const rankedIds = new Set(ranked.map((evaluation) => evaluation.reminder.id));
  const ordered = [...ranked, ...evaluations.filter((evaluation) => !rankedIds.has(evaluation.reminder.id))];
  const decision = applyDecisions(ordered, input.runtime, input.stats, settings, input.now);
  return { ...decision, evaluations };
}

export * from './types';
export * from './phase1';
export * from './phase2';
export * from './phase3';
export * from './phase4';
export * from './adaptiveSampling';
export * from './chain';
