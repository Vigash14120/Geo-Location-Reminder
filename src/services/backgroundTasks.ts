import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storageService } from './storage';
import { notificationService } from './notifications';
import { runDecisionEngine } from '../engine';
import { withSerializedWrites } from './mutex';

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
    const result = runDecisionEngine({
      reminders,
      runtime,
      stats,
      settings,
      location: coords,
      now: coords.timestamp ?? Date.now(),
    });
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
    await Promise.all([
      storageService.saveRuntime(nextRuntime),
      storageService.saveStats({
        ...result.stats,
        triggered: result.stats.triggered - failedTriggers,
      }),
    ]);
  });
}

export const backgroundTaskService = {
  async registerBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 10, // 10 meters
          deferredUpdatesInterval: 30000,
          deferredUpdatesDistance: 25,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Geo-Reminder is Active',
            notificationBody: 'Monitoring your location for reminders.',
            notificationColor: '#2563eb',
          },
        });
        console.log('Background location task registered successfully');
      }
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
