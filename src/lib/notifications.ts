import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

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

// ── Step 5: Send an immediate remote push notification via Expo Push API ──────
export async function sendPushNotification(targetToken: string, title: string, body: string, data?: any) {
  if (!targetToken || !targetToken.startsWith('ExponentPushToken')) {
    console.log('[Notifications] Invalid or missing push token:', targetToken);
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: targetToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        priority: 'high',
        channelId: 'clinlab-alerts',
      }),
    });
    const result = await response.json();
    console.log('[Notifications] Remote push notification response:', result);
  } catch (error) {
    console.error('[Notifications] Error sending remote push notification:', error);
  }
}

// ── Step 6: Notify Organization and its Labs about a new case ─────────────────
export async function notifyOrgAndLabsOfNewCase(orgId: string, patientName: string, toothNumber: string) {
  if (!orgId) return;

  try {
    // Fetch push tokens of the organization itself and all its approved lab users
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('push_token')
      .or(`id.eq.${orgId},org_id.eq.${orgId}`)
      .not('push_token', 'is', null);

    if (error) throw error;
    if (!profiles || profiles.length === 0) return;

    // Extract unique push tokens
    const tokens = Array.from(new Set(profiles.map(p => p.push_token).filter(Boolean)));
    if (tokens.length === 0) return;

    // Send push notification to all matched devices
    for (const token of tokens) {
      await sendPushNotification(
        token,
        '🔬 New Lab Requisition',
        `${patientName} · Tooth #${toothNumber} — lab work requested.`
      );
    }
  } catch (err) {
    console.error('[Notifications] Error triggering org/lab notification:', err);
  }
}

// ── Step 7: Notify Organization about a pending approval request ──────────────
export async function notifyOrgOfPendingApproval(orgId: string, applicantName: string, isLab: boolean) {
  if (!orgId) return;

  try {
    // Fetch the push token of the organization
    const { data: orgProfile, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', orgId)
      .single();

    if (error) throw error;
    if (!orgProfile || !orgProfile.push_token) return;

    const title = isLab ? '🔬 New Lab Access Request' : '👨‍⚕️ New Doctor Access Request';
    const message = isLab
      ? `${applicantName} has requested approval to join your organization.`
      : `${applicantName} has requested approval to join your organization.`;

    await sendPushNotification(orgProfile.push_token, title, message);
  } catch (err) {
    console.error('[Notifications] Error triggering pending approval notification:', err);
  }
}
