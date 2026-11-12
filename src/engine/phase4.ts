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
    const previous = nextRuntime[evaluation.reminder.id];
    const inCooldown = previous?.lastTriggeredAt !== undefined &&
      now - previous.lastTriggeredAt < settings.cooldownMs;
    const shouldTrigger = evaluation.eligible && evaluation.score >= settings.minimumScore && !inCooldown;
    nextRuntime[evaluation.reminder.id] = {
      ...previous,
      lastEvaluatedAt: now,
      lastDistanceMeters: evaluation.distanceMeters,
      lastDecision: shouldTrigger ? 'triggered' : evaluation.eligible ? 'skipped' : 'ineligible',
      ...(shouldTrigger ? { lastTriggeredAt: now } : {}),
    };
    if (shouldTrigger && actions.length < settings.maxTriggersPerRun) {
      actions.push({ type: 'trigger', reminder: evaluation.reminder, evaluation });
    } else {
      nextStats.skipped += 1;
    }
  }

  nextStats.triggered += actions.length;
  return { actions, runtime: nextRuntime, stats: nextStats };
}
