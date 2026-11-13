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
  sampling: {
    farDistanceM: 5000,
    midDistanceM: 1000,
    nearDistanceM: 1000,
    nearRadiusMultiplier: 3,
    hysteresisMargin: 0.15,
    farTimeIntervalMs: 60_000,
    farDistanceIntervalM: 500,
    midTimeIntervalMs: 20_000,
    midDistanceIntervalM: 100,
    nearTimeIntervalMs: 5_000,
    nearDistanceIntervalM: 10,
  },
} as const;
