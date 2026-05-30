export const setNotificationHandler = () => {};
export const getPermissionsAsync = async () => ({ status: 'granted' });
export const requestPermissionsAsync = async () => ({ status: 'granted' });
export const getExpoPushTokenAsync = async () => ({ data: 'mock-token' });
export const setNotificationChannelAsync = async () => {};
export const scheduleNotificationAsync = async () => {};
export const AndroidImportance = { MAX: 5 };

export const isDevice = false;

export class LegacyEventEmitter {}
export class EventEmitter {
  addListener() { return { remove: () => {} }; }
  emit() {}
}
export class UnavailabilityError extends Error {}
export const uuid = {
  v4: () => 'mock-uuid',
};
export const AndroidNotificationPriority = {
  MAX: 'max',
  HIGH: 'high',
  DEFAULT: 'default',
  LOW: 'low',
  MIN: 'min',
};
