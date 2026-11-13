import { isWithinTimeRange, getHaversineDistance } from '../utils/geo';
import { Reminder } from '../types';
import { Evaluation, NormalizedLocation } from './types';

export function evaluateReminder(
  reminder: Reminder,
  location: NormalizedLocation,
  accuracyLimit: number,
  now: number,
): Evaluation {
  const distanceMeters = getHaversineDistance(location, reminder.location);
  const reasons: string[] = [];
  const timeEligible = !reminder.timeConditions ||
    isWithinTimeRange(reminder.timeConditions.startTime, reminder.timeConditions.endTime, now);
  const hasAltitudeConstraint = reminder.location.altitude !== undefined;
  const altitudeDistanceMeters = hasAltitudeConstraint && location.altitude !== undefined
    ? Math.abs(location.altitude - (reminder.location.altitude as number))
    : undefined;
  const altitudeEligible = !hasAltitudeConstraint ||
    (altitudeDistanceMeters !== undefined &&
      altitudeDistanceMeters <= (reminder.altitudeThreshold ?? 10));

  if (!Number.isFinite(location.accuracy)) reasons.push('location-accuracy-unknown');
  else if (location.accuracy > accuracyLimit) reasons.push('location-inaccurate');
  if (distanceMeters > reminder.radius) reasons.push('outside-radius');
  if (!timeEligible) reasons.push('outside-time-window');
  if (!altitudeEligible) reasons.push('outside-altitude');
  if (!reminder.isEnabled) reasons.push('disabled');
  if (reminder.isTriggered) reasons.push('already-triggered');

  const eligible = reasons.length === 0;
  const radiusScore = Math.max(0, 1 - distanceMeters / Math.max(reminder.radius, 1));
  const altitudeScore = altitudeDistanceMeters === undefined
    ? 1
    : Math.max(0, 1 - altitudeDistanceMeters / Math.max(reminder.altitudeThreshold ?? 10, 1));

  return {
    reminder,
    distanceMeters,
    altitudeDistanceMeters,
    timeEligible,
    altitudeEligible,
    eligible,
    reasons,
    score: (radiusScore * 0.7) + (altitudeScore * 0.3),
  };
}
