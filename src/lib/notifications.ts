import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// ── Step 1: Configure foreground notification behaviour ───────────────────────
// This MUST run at module level (before any component mounts) so that
// notifications appear even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Step 2: Create Android notification channel at module load ────────────────
// Channels must exist before any notification is scheduled.
// Creating it here (top-level) ensures it is ready on first use.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('clinlab-alerts', {
    name: 'ClinLab Alerts',
    description: 'Real-time clinical and approval alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0EA5E9',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    sound: 'default',
  });
}

// ── Step 3: Permission registration ──────────────────────────────────────────
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;

  if (!Device.isDevice) {
    console.log('[Notifications] Must use a physical device for push notifications.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission denied — push notifications will not work.');
    return null;
  }

  // Return the Expo push token (needed for remote push via Expo servers)
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    console.log('[Notifications] Expo push token:', token.data);
    return token.data;
  } catch (err) {
    // No projectId configured — local notifications still work fine
    console.log('[Notifications] Could not get Expo push token (no projectId):', err);
    return null;
  }
}

// ── Step 4: Send an immediate local notification ──────────────────────────────
export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (Platform.OS === 'web') {
    // On web, fall back to the browser Notification API if permission granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/pwa-512x512.png' });
    }
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
      badge: 1,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      // CRITICAL for Android: must match the channel created above
      ...(Platform.OS === 'android' ? { channelId: 'clinlab-alerts' } : {}),
    },
    trigger: null, // fire immediately
  });
}
