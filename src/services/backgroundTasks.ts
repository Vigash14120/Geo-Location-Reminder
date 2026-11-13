import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storageService } from './storage';
import { notificationService } from './notifications';
import { runDecisionEngine } from '../engine';
import { selectSamplingMode } from '../engine/adaptiveSampling';
import { withSerializedWrites } from './mutex';
import { EngineStats, SamplingMode } from '../types';

export const LOCATION_TASK_NAME = 'background-location-task';

/**
 * Evaluates active reminders against a given coordinate and triggers notifications if matched.
 */
export async function evaluateRemindersAtLocation(coords: {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  timestamp?: number;
}): Promise<void> {
  await withSerializedWrites(async () => {
    const [reminders, runtime, stats, settings] = await Promise.all([
      storageService.getReminders(),
      storageService.getRuntime(),
      storageService.getStats(),
      storageService.getSettings(),
    ]);
    const now = coords.timestamp ?? Date.now();
    const result = runDecisionEngine({
      reminders,
      runtime,
      stats,
      settings,
      location: coords,
      now,
    });
    const nextMode = selectSamplingMode(coords, reminders, stats.currentMode?.name, now);
    const modeChanged = stats.currentMode?.name !== nextMode.name;
    const modeElapsed = stats.modeChangedAt === undefined ? 0 : Math.max(0, now - stats.modeChangedAt);
    const successfulIds = new Set<string>();
    for (const action of result.actions) {
      const sent = await notificationService.sendReminderNotification(action.reminder);
      if (sent) {
        successfulIds.add(action.reminder.id);
        await storageService.updateReminderUnsafe({ ...action.reminder, isTriggered: true });
      }
    }

    const nextRuntime = { ...result.runtime };
    let failedTriggers = 0;
    for (const action of result.actions) {
      if (!successfulIds.has(action.reminder.id)) {
        failedTriggers += 1;
        const state = nextRuntime[action.reminder.id];
        if (state) {
          nextRuntime[action.reminder.id] = {
            ...state,
            lastDecision: 'skipped',
            lastTriggeredAt: undefined,
          };
        }
      }
    }
    const nextStats: EngineStats = {
      ...result.stats,
      samplesProcessed: stats.samplesProcessed + 1,
      modeChanges: stats.modeChanges + (modeChanged ? 1 : 0),
      currentMode: nextMode,
      modeChangedAt: modeChanged || stats.modeChangedAt === undefined ? now : stats.modeChangedAt,
      timeByMode: {
        ...stats.timeByMode,
        ...(stats.currentMode
          ? { [stats.currentMode.name]: stats.timeByMode[stats.currentMode.name] + modeElapsed }
          : {}),
      },
    };
    await Promise.all([
      storageService.saveRuntime(nextRuntime),
      storageService.saveStats({
        ...nextStats,
        triggered: result.stats.triggered - failedTriggers,
      }),
    ]);
    if (modeChanged) await backgroundTaskService.applySamplingMode(nextMode);
  });
}

export const backgroundTaskService = {
  async refreshSamplingMode(): Promise<void> {
    await withSerializedWrites(async () => {
      const [reminders, stats] = await Promise.all([
        storageService.getReminders(),
        storageService.getStats(),
      ]);
      let location: Location.LocationObject;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        return;
      }
      const now = location.timestamp || Date.now();
      const mode = selectSamplingMode(location.coords, reminders, stats.currentMode?.name, now);
      if (stats.currentMode?.name === mode.name) return;
      await this.applySamplingMode(mode);
      await storageService.saveStats({
        ...stats,
        currentMode: mode,
        modeChanges: stats.modeChanges + 1,
        modeChangedAt: now,
      });
    });
  },

  async applySamplingMode(mode: SamplingMode): Promise<void> {
    const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (mode.name === 'idle') {
      if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      return;
    }
    if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: mode.accuracy === 'high'
        ? Location.Accuracy.High
        : mode.accuracy === 'low'
          ? Location.Accuracy.Low
          : Location.Accuracy.Balanced,
      timeInterval: mode.timeIntervalMs,
      distanceInterval: mode.distanceIntervalM,
      deferredUpdatesInterval: 30000,
      deferredUpdatesDistance: 25,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Geo-Reminder is Active',
        notificationBody: 'Monitoring your location for reminders.',
        notificationColor: '#2563eb',
      },
    });
  },

  async registerBackgroundTask(): Promise<void> {
    try {
      await this.refreshSamplingMode();
      console.log('Background location sampling mode refreshed');
    } catch (e) {
      console.error('Failed to register background location task:', e);
    }
  },

  async unregisterBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('Background location task unregistered');
      }
    } catch (e) {
      console.error('Failed to unregister background location task:', e);
    }
  },
};

// Define the background task in global scope
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background task location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations?: Location.LocationObject[] };
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return;
    }
    // Take the newest/latest location point from the batch
    const latestLocation = locations[locations.length - 1];
    if (latestLocation && latestLocation.coords) {
      await evaluateRemindersAtLocation(latestLocation.coords);
    }
  }
});
