import { EngineLocation, NormalizedLocation } from './types';

export function normalizeLocation(location: EngineLocation, now = Date.now()): NormalizedLocation | null {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return null;
  }

  const altitude = Number.isFinite(location.altitude) ? location.altitude as number : undefined;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    ...(altitude !== undefined ? { altitude } : {}),
    accuracy: Number.isFinite(location.accuracy) && (location.accuracy as number) >= 0
      ? (location.accuracy as number)
      : Number.POSITIVE_INFINITY,
    timestamp: Number.isFinite(location.timestamp) ? (location.timestamp as number) : now,
  };
}
