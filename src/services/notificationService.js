import {
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  setNotificationHandler,
  setBadgeCountAsync,
} from 'expo-notifications';

import Constants from 'expo-constants';

import {
  Platform,
} from 'react-native';


// ============================================================
// FOREGROUND NOTIFICATION BEHAVIOR
// ============================================================

setNotificationHandler({
  handleNotification:
    async () => ({
      shouldShowBanner:
        true,

      shouldShowList:
        true,

      shouldPlaySound:
        true,

      shouldSetBadge:
        true,
    }),
});


// ============================================================
// ASK FOR NOTIFICATION PERMISSION
// ============================================================

export async function requestNotificationPermission() {
  const current =
    await getPermissionsAsync();

  if (
    current.granted
  ) {
    return true;
  }

  const result = await requestPermissionsAsync({
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
});

  return result.granted;
}


// ============================================================
// REGISTER DEVICE FOR EXPO PUSH NOTIFICATIONS
// ============================================================

export async function registerForPushNotificationsAsync() {
  const permissionGranted =
    await requestNotificationPermission();

  if (!permissionGranted) {
    return null;
  }

  /*
   * Expo's push service uses an ExpoPushToken.
   *
   * The EAS project ID is required when requesting
   * the token.
   */

  const projectId =
    Constants.expoConfig
      ?.extra
      ?.eas
      ?.projectId ||
    Constants.easConfig
      ?.projectId;

  if (!projectId) {
    console.log(
      'No EAS project ID is available yet. Push token registration skipped.'
    );

    return null;
  }

  try {
    const tokenResponse =
      await getExpoPushTokenAsync({
        projectId,
      });

    const token =
      tokenResponse.data;

    // Android needs a notification channel.
    if (
      Platform.OS ===
      'android'
    ) {
      const Notifications =
        await import(
          'expo-notifications'
        );

      await Notifications
        .setNotificationChannelAsync(
          'default',
          {
            name:
              'Default',

            importance:
              Notifications
                .AndroidImportance
                .HIGH,

            vibrationPattern: [
              0,
              250,
              250,
              250,
            ],
          }
        );
    }

    return token;
  } catch (error) {
    console.log(
      'PUSH TOKEN ERROR:',
      error
    );

    return null;
  }
}

export async function setAppBadgeCount(count) {
  try {
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) return;
    await setBadgeCountAsync(Math.max(0, Number(count) || 0));
  } catch (error) {
    console.log('BADGE UPDATE ERROR:', error?.message || error);
  }
}


// ============================================================
// LOCAL CHORE REMINDER
// ============================================================

export async function scheduleChoreReminder(
  chore
) {
  const permissionGranted =
    await requestNotificationPermission();

  if (
    !permissionGranted
  ) {
    throw new Error(
      'Notifications are disabled. Enable them in device settings.'
    );
  }

  const reminderDate =
    new Date(
      chore.reminderAt
    );

  if (
    Number.isNaN(
      reminderDate.getTime()
    )
  ) {
    throw new Error(
      'Choose a valid reminder time.'
    );
  }

  const now =
    new Date();

  if (
    reminderDate <=
    now
  ) {
    throw new Error(
      'Choose a reminder time later today.'
    );
  }

  if (
    reminderDate.toDateString() !==
    now.toDateString()
  ) {
    throw new Error(
      'Reminders must be scheduled for today.'
    );
  }

  const notificationId =
    await scheduleNotificationAsync({
      content: {
        title:
          'Coop',

        body:
          `Don't forget: ${chore.title}`,

        sound:
          true,
      },

      trigger: {
        type:
          'date',

        date:
          reminderDate,
      },
    });

  return notificationId;
}


// ============================================================
// CANCEL CHORE REMINDER
// ============================================================

export async function cancelChoreReminder(
  notificationId
) {
  if (
    !notificationId
  ) {
    return;
  }

  await cancelScheduledNotificationAsync(
    notificationId
  );
}
