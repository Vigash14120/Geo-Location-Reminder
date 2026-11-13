import { EngineSettings, EngineStats, ReminderRuntimeStateMap } from '../types';
import { EngineAction, Evaluation } from './types';

export function applyDecisions(
  evaluations: Evaluation[],
  runtime: ReminderRuntimeStateMap,
  stats: EngineStats,
  settings: EngineSettings,
  now: number,
): { actions: EngineAction[]; runtime: ReminderRuntimeStateMap; stats: EngineStats } {
  const nextRuntime = { ...runtime };
  const nextStats: EngineStats = {
    ...stats,
    evaluations: stats.evaluations + evaluations.length,
    eligibleEvaluations: stats.eligibleEvaluations + evaluations.filter((item) => item.eligible).length,
    lastRunAt: now,
  };
  const actions: EngineAction[] = [];

  for (const evaluation of evaluations) {
    const previous = nextRuntime[evaluation.reminder.id] ?? {
      inside: false,
      consecutiveInside: 0,
    };
    const wasInside = previous.inside;
    const enterRadius = evaluation.reminder.radius;
    const exitRadius = enterRadius * settings.exitFactor;
    const inside = wasInside
      ? evaluation.distanceMeters <= exitRadius
      : evaluation.distanceMeters <= enterRadius;
    const consecutiveInside = inside ? previous.consecutiveInside + 1 : 0;
    const enteredAt = inside
      ? previous.enteredAt ?? (consecutiveInside >= settings.requiredConsecutiveReadings ? now : undefined)
      : undefined;
    const eligibleWithoutRadius = evaluation.reasons.every((reason) => reason !== 'outside-radius');
    const inCooldown = previous?.lastTriggeredAt !== undefined &&
      now - previous.lastTriggeredAt < settings.cooldownMs;
    const dwellSeconds = evaluation.reminder.dwellSeconds ?? 0;
    const dwellElapsed = enteredAt !== undefined && (now - enteredAt) >= dwellSeconds * 1000;
    const shouldTrigger = inside &&
      eligibleWithoutRadius &&
      consecutiveInside >= settings.requiredConsecutiveReadings &&
      dwellElapsed &&
      evaluation.score >= settings.minimumScore &&
      !inCooldown;
    const canTrigger = shouldTrigger && actions.length < settings.maxTriggersPerRun;
    nextRuntime[evaluation.reminder.id] = {
      ...previous,
      inside,
      enteredAt,
      consecutiveInside,
      lastEvaluatedAt: now,
      lastDistanceMeters: evaluation.distanceMeters,
      lastDecision: canTrigger ? 'triggered' : shouldTrigger ? 'skipped' : evaluation.eligible ? 'skipped' : 'ineligible',
      ...(canTrigger ? { lastTriggeredAt: now } : {}),
    };
    if (canTrigger) {
      actions.push({ type: 'trigger', reminder: evaluation.reminder, evaluation });
    } else {
      nextStats.skipped += 1;
    }
  }

  nextStats.triggered += actions.length;
  return { actions, runtime: nextRuntime, stats: nextStats };
}
