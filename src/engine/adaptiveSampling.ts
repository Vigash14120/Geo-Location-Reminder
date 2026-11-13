import { getHaversineDistance, isWithinTimeRange } from '../utils/geo';
import { SamplingMode, SamplingModeName, Reminder } from '../types';
import { ENGINE_CONFIG } from './config';
import { isReminderEligibleByChain } from './chain';

export interface SamplingLocation {
  latitude: number;
  longitude: number;
}

export function selectSamplingMode(
  location: SamplingLocation,
  reminders: Reminder[],
  currentMode: SamplingModeName | undefined,
  now: number,
): SamplingMode {
  const eligible = reminders.filter((reminder) =>
    reminder.isEnabled &&
    !reminder.isTriggered &&
    isReminderEligibleByChain(reminder, reminders) &&
    (!reminder.timeConditions ||
      isWithinTimeRange(reminder.timeConditions.startTime, reminder.timeConditions.endTime, now)));

  if (eligible.length === 0) return { name: 'idle', accuracy: 'balanced' };

  const nearestDistance = Math.min(
    ...eligible.map((reminder) => getHaversineDistance(location, reminder.location)),
  );
  const nearThreshold = Math.max(
    ENGINE_CONFIG.sampling.nearDistanceM,
    ...eligible.map((reminder) => reminder.radius * ENGINE_CONFIG.sampling.nearRadiusMultiplier),
  );
  const farThreshold = ENGINE_CONFIG.sampling.farDistanceM;
  const margin = ENGINE_CONFIG.sampling.hysteresisMargin;

  let name: SamplingModeName;
  if (currentMode === 'near' && nearestDistance <= nearThreshold * (1 + margin)) name = 'near';
  else if (currentMode === 'far' && nearestDistance >= farThreshold * (1 - margin)) name = 'far';
  else if (currentMode === 'mid' &&
    nearestDistance >= nearThreshold * (1 - margin) &&
    nearestDistance <= farThreshold * (1 + margin)) name = 'mid';
  else if (nearestDistance < nearThreshold) name = 'near';
  else if (nearestDistance <= farThreshold) name = 'mid';
  else name = 'far';

  if (name === 'near') {
    return {
      name,
      accuracy: 'high',
      timeIntervalMs: ENGINE_CONFIG.sampling.nearTimeIntervalMs,
      distanceIntervalM: ENGINE_CONFIG.sampling.nearDistanceIntervalM,
    };
  }
  if (name === 'mid') {
    return {
      name,
      accuracy: 'balanced',
      timeIntervalMs: ENGINE_CONFIG.sampling.midTimeIntervalMs,
      distanceIntervalM: ENGINE_CONFIG.sampling.midDistanceIntervalM,
    };
  }
  return {
    name: 'far',
    accuracy: 'low',
    timeIntervalMs: ENGINE_CONFIG.sampling.farTimeIntervalMs,
    distanceIntervalM: ENGINE_CONFIG.sampling.farDistanceIntervalM,
  };
}
