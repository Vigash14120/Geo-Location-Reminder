/**
 * Central defaults for decision-engine thresholds and limits.
 * Keep user-facing defaults and pure-engine defaults aligned here.
 */
export const ENGINE_CONFIG = {
  maxAccuracyMeters: 100,
  cooldownMs: 60_000,
  maxTriggersPerRun: 3,
  minimumScore: 0.2,
  defaultDwellSeconds: 0,
  exitFactor: 1.2,
  requiredConsecutiveReadings: 2,
} as const;
