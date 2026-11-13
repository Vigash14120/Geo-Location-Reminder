import { Reminder } from '../types';

export type DerivedReminderStatus = 'locked' | 'active' | 'triggered';

export function getReminderStatus(reminder: Reminder, reminders: Reminder[]): DerivedReminderStatus {
  if (reminder.isTriggered) return 'triggered';
  if (!reminder.dependsOnId) return 'active';
  const parent = reminders.find((candidate) => candidate.id === reminder.dependsOnId);
  return parent?.isTriggered ? 'active' : 'locked';
}

export function isReminderEligibleByChain(reminder: Reminder, reminders: Reminder[]): boolean {
  return getReminderStatus(reminder, reminders) === 'active';
}

export function detectCycle(reminders: Reminder[], startId: string): boolean {
  const seen = new Set<string>();
  let currentId: string | undefined = startId;
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    currentId = reminders.find((reminder) => reminder.id === currentId)?.dependsOnId;
  }
  return false;
}

export function validateDependencies(reminders: Reminder[]): void {
  for (const reminder of reminders) {
    if (reminder.dependsOnId === reminder.id) {
      throw new Error(`Reminder ${reminder.id} cannot depend on itself`);
    }
    if (reminder.dependsOnId && !reminders.some((candidate) => candidate.id === reminder.dependsOnId)) {
      throw new Error(`Reminder ${reminder.id} depends on a missing reminder`);
    }
    if (detectCycle(reminders, reminder.id)) {
      throw new Error(`Reminder dependency cycle detected at ${reminder.id}`);
    }
  }
}
