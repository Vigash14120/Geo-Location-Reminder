import { GeoPoint } from '../types';

/**
 * Calculates the Haversine distance between two sets of coordinates in meters.
 */
export function getHaversineDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Parses a time string (e.g. "09:30" or "9:30") into total minutes from midnight.
 * Returns null if the format is invalid.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Checks if current time is within a time range (HH:mm format).
 */
export function isWithinTimeRange(startTime: string, endTime: string, timestamp: number): boolean {
  const startTotalMinutes = parseTimeToMinutes(startTime);
  const endTotalMinutes = parseTimeToMinutes(endTime);

  // If time format is invalid, default to allowing the trigger
  if (startTotalMinutes === null || endTotalMinutes === null) {
    return true;
  }

  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(timestamp);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const currentTime = hour * 60 + minute;

  if (startTotalMinutes <= endTotalMinutes) {
    return currentTime >= startTotalMinutes && currentTime <= endTotalMinutes;
  } else {
    // Overlap midnight (e.g. 21:00 to 05:00)
    return currentTime >= startTotalMinutes || currentTime <= endTotalMinutes;
  }
}
