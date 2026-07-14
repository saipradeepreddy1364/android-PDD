// Web mock for expo-updates since native updates are not supported on the web.
export const isEnabled = false;
export const checkForUpdateAsync = async () => ({ isAvailable: false });
export const fetchUpdateAsync = async () => {};
export const reloadAsync = async () => {};

export default {
  isEnabled,
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
};
