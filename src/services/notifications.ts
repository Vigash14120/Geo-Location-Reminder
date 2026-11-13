import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Reminder } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  async registerNotifications(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Geo Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted!');
        return;
      }
      console.log('Notification permissions granted and channel configured.');
    } catch (e) {
      console.error('Error during notification registration:', e);
    }
  },

  async sendReminderNotification(reminder: Reminder): Promise<boolean> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.notes || 'You have arrived at your destination!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { reminderId: reminder.id },
        },
        trigger: Platform.OS === 'android' ? { channelId: 'default' } : null,
      });
      return true;
    } catch (e) {
      console.error('Failed to schedule reminder notification:', e);
      return false;
    }
  },
};
