export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number; // Optional altitude for 3D geofencing
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  location: GeoPoint;
  radius: number; // in meters
  isEnabled: boolean;
  isTriggered: boolean;
  timeConditions?: {
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  };
  altitudeThreshold?: number; // Altitude match threshold in meters
  dwellSeconds?: number;
  dependsOnId?: string;
  createdAt: number;
}

export interface EngineSettings {
  enabled: boolean;
  minimumScore: number;
  cooldownMs: number;
  maxTriggersPerRun: number;
  locationAccuracyMeters: number;
  exitFactor: number;
  requiredConsecutiveReadings: number;
}

export interface ReminderRuntimeState {
  inside: boolean;
  enteredAt?: number;
  consecutiveInside: number;
  lastEvaluatedAt?: number;
  lastTriggeredAt?: number;
  lastDistanceMeters?: number;
  lastDecision?: 'triggered' | 'skipped' | 'ineligible';
}

export type ReminderRuntimeStateMap = Record<string, ReminderRuntimeState>;

export interface EngineStats {
  evaluations: number;
  eligibleEvaluations: number;
  triggered: number;
  skipped: number;
  rejectedSamples: number;
  samplesProcessed: number;
  modeChanges: number;
  currentMode?: SamplingMode;
  modeChangedAt?: number;
  timeByMode: Record<SamplingModeName, number>;
  lastRunAt?: number;
}

export type SamplingModeName = 'idle' | 'far' | 'mid' | 'near';

export interface SamplingMode {
  name: SamplingModeName;
  accuracy: 'low' | 'balanced' | 'high';
  timeIntervalMs?: number;
  distanceIntervalM?: number;
}
