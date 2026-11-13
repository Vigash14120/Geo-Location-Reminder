import AsyncStorage from '@react-native-async-storage/async-storage';
import { EngineSettings, EngineStats, Reminder, ReminderRuntimeStateMap } from '../types';
import { DEFAULT_ENGINE_SETTINGS } from '../engine';
import { withSerializedWrites } from './mutex';

const STORAGE_KEY = '@geo_reminders_v2';
const LEGACY_STORAGE_KEY = '@geo_reminders';
const RUNTIME_KEY = '@geo_reminders_runtime';
const STATS_KEY = '@geo_reminders_stats';
const SETTINGS_KEY = '@geo_reminders_settings';
const SCHEMA_VERSION = 2;

const EMPTY_STATS: EngineStats = {
  evaluations: 0,
  eligibleEvaluations: 0,
  triggered: 0,
  skipped: 0,
  rejectedSamples: 0,
};

export function normalizeReminder(
  input: Partial<Reminder> & Pick<Reminder, 'id' | 'title' | 'location' | 'radius' | 'createdAt'>,
): Reminder {
  return {
    id: input.id,
    title: input.title,
    notes: input.notes ?? '',
    location: input.location,
    radius: input.radius,
    isEnabled: input.isEnabled ?? true,
    isTriggered: input.isTriggered ?? false,
    dwellSeconds: input.dwellSeconds ?? 0,
    createdAt: input.createdAt,
    ...(input.timeConditions ? { timeConditions: input.timeConditions } : {}),
    ...(input.altitudeThreshold !== undefined ? { altitudeThreshold: input.altitudeThreshold } : {}),
    ...(input.dependsOnId ? { dependsOnId: input.dependsOnId } : {}),
  };
}

function normalizeRuntime(runtime: ReminderRuntimeStateMap): ReminderRuntimeStateMap {
  return Object.fromEntries(Object.entries(runtime).map(([id, state]) => [
    id,
    {
      ...state,
      inside: state.inside ?? false,
      consecutiveInside: state.consecutiveInside ?? 0,
    },
  ]));
}

export function migrateReminderData(raw: string | null): { schemaVersion: number; reminders: Reminder[] } {
  if (!raw) return { schemaVersion: SCHEMA_VERSION, reminders: [] };
  const parsed = JSON.parse(raw) as Reminder[] | { schemaVersion?: number; reminders?: Reminder[] };
  const reminders = Array.isArray(parsed) ? parsed : parsed.reminders ?? [];
  return {
    schemaVersion: SCHEMA_VERSION,
    reminders: reminders.map((reminder) => normalizeReminder(reminder)),
  };
}

async function migrate(): Promise<void> {
  const version = await AsyncStorage.getItem(`${STORAGE_KEY}:schema`);
  if (version === String(SCHEMA_VERSION)) return;
  const current = await AsyncStorage.getItem(STORAGE_KEY);
  if (!current) {
    const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(legacy ? migrateReminderData(legacy) : migrateReminderData(null)),
    );
  }
  await AsyncStorage.setItem(`${STORAGE_KEY}:schema`, String(SCHEMA_VERSION));
}

export const storageService = {
  async getReminders(): Promise<Reminder[]> {
    try {
      await migrate();
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = data ? JSON.parse(data) as Reminder[] | { reminders?: Reminder[] } : [];
      const reminders = Array.isArray(parsed) ? parsed : parsed.reminders ?? [];
      return reminders.map((reminder) => normalizeReminder(reminder));
    } catch (e) {
      console.error('Error fetching reminders from storage:', e);
      return [];
    }
  },

  async saveReminders(reminders: Reminder[]): Promise<void> {
    try {
      await migrate();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, reminders: reminders.map(normalizeReminder) }),
      );
    } catch (e) {
      console.error('Error saving reminders to storage:', e);
    }
  },

  async addReminder(reminder: Reminder): Promise<void> {
    const reminders = await this.getReminders();
    await this.saveReminders([reminder, ...reminders]);
  },

  async updateReminder(updatedReminder: Reminder): Promise<void> {
    await withSerializedWrites(() => this.updateReminderUnsafe(updatedReminder));
  },

  async updateReminderUnsafe(updatedReminder: Reminder): Promise<void> {
    const reminders = await this.getReminders();
    const index = reminders.findIndex((r) => r.id === updatedReminder.id);
    if (index !== -1) {
      reminders[index] = updatedReminder;
      await this.saveReminders(reminders);
    }
  },

  async deleteReminder(id: string): Promise<void> {
    const reminders = await this.getReminders();
    const updated = reminders.filter((r) => r.id !== id);
    await this.saveReminders(updated);
  },

  async clearTriggeredReminders(): Promise<void> {
    const reminders = await this.getReminders();
    const updated = reminders.filter((r) => !r.isTriggered);
    await this.saveReminders(updated);
  },

  async reactivateReminder(id: string): Promise<void> {
    const reminders = await this.getReminders();
    const index = reminders.findIndex((r) => r.id === id);
    if (index !== -1) {
      reminders[index] = {
        ...reminders[index],
        isTriggered: false,
        isEnabled: true,
      };
      await this.saveReminders(reminders);
      const runtime = await this.getRuntime();
      delete runtime[id];
      await this.saveRuntime(runtime);
    }
  },

  async getRuntime(): Promise<ReminderRuntimeStateMap> {
    try {
      const data = await AsyncStorage.getItem(RUNTIME_KEY);
      return data ? normalizeRuntime(JSON.parse(data)) : {};
    } catch (e) {
      console.error('Error fetching engine runtime:', e);
      return {};
    }
  },

  async saveRuntime(runtime: ReminderRuntimeStateMap): Promise<void> {
    await AsyncStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
  },

  async getStats(): Promise<EngineStats> {
    try {
      const data = await AsyncStorage.getItem(STATS_KEY);
      return data ? { ...EMPTY_STATS, ...JSON.parse(data) } : EMPTY_STATS;
    } catch (e) {
      console.error('Error fetching engine stats:', e);
      return EMPTY_STATS;
    }
  },

  async saveStats(stats: EngineStats): Promise<void> {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  },

  async getSettings(): Promise<EngineSettings> {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      return { ...DEFAULT_ENGINE_SETTINGS, ...(data ? JSON.parse(data) : {}) };
    } catch (e) {
      console.error('Error fetching engine settings:', e);
      return DEFAULT_ENGINE_SETTINGS;
    }
  },

  async saveSettings(settings: EngineSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};
