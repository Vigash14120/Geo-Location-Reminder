import { EngineSettings, EngineStats, GeoPoint, Reminder, ReminderRuntimeStateMap } from '../types';

export interface EngineLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  timestamp?: number;
}

export interface NormalizedLocation extends GeoPoint {
  accuracy: number;
  timestamp: number;
}

export interface Evaluation {
  reminder: Reminder;
  distanceMeters: number;
  altitudeDistanceMeters?: number;
  timeEligible: boolean;
  altitudeEligible: boolean;
  eligible: boolean;
  reasons: string[];
  score: number;
}

export interface EngineAction {
  type: 'trigger';
  reminder: Reminder;
  evaluation: Evaluation;
}

export interface EngineInput {
  reminders: Reminder[];
  location: EngineLocation;
  runtime: ReminderRuntimeStateMap;
  settings: EngineSettings;
  stats: EngineStats;
  now: number;
}

export interface EngineOutput {
  actions: EngineAction[];
  evaluations: Evaluation[];
  runtime: ReminderRuntimeStateMap;
  stats: EngineStats;
}
