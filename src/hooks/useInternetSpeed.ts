import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

// Threshold: 0.5 Mbps is the minimum required for this app to be functional.
// Anything above this should not trigger a "Slow Internet" popup.
const SLOW_SPEED_THRESHOLD_MBPS = 0.5;
const POPUP_DURATION_MS = 2000;

// A small, reliable public resource (~50KB) for real download testing.
const TEST_FILE_URL = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=200';
const TEST_FILE_SIZE_BITS = 35000 * 8; // ~35KB

export type NetworkStatus = 'offline' | 'slow' | 'normal' | 'unknown';

export const useInternetSpeed = () => {
  const [isLowSpeed, setIsLowSpeed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [speed, setSpeed] = useState<number | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<NetworkStatus>('unknown');

  const triggerPopup = useCallback((newStatus: NetworkStatus) => {
    if (newStatus === prevStatusRef.current) return;
    prevStatusRef.current = newStatus;

    if (newStatus === 'normal' || newStatus === 'unknown') {
      setShowPopup(false);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      return;
    }

    setShowPopup(true);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setShowPopup(false);
    }, POPUP_DURATION_MS);
  }, []);

  const checkSpeed = useCallback(async () => {
    // 1. Basic Offline Check
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
      setIsOffline(true);
      setIsLowSpeed(false);
      setSpeed(0);
      triggerPopup('offline');
      return;
    }

    if (Platform.OS !== 'web') return;

    try {
      // 2. Real Download Speed Test
      // We perform an actual fetch of a ~50KB file to calculate real throughput.
      const start = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max wait

      const response = await fetch(TEST_FILE_URL, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Download failed');

      // Consume the body to ensure we measure the full download time
      const blob = await response.blob();
      clearTimeout(timeoutId);
      
      const end = performance.now();
      const durationSeconds = (end - start) / 1000;
      
      // Calculate Mbps: (bits / seconds) / 1,000,000
      // We use the actual blob size if available, otherwise our estimate
      const actualBits = blob.size > 0 ? blob.size * 8 : TEST_FILE_SIZE_BITS;
      const mbps = actualBits / (durationSeconds * 1000000);
      const rounded = Math.round(mbps * 100) / 100;

      setSpeed(rounded);
      setIsOffline(false);

      if (rounded < SLOW_SPEED_THRESHOLD_MBPS) {
        setIsLowSpeed(true);
        triggerPopup('slow');
      } else {
        setIsLowSpeed(false);
        triggerPopup('normal');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Truly slow if a 50KB file takes > 8 seconds
        setIsLowSpeed(true);
        setIsOffline(false);
        triggerPopup('slow');
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
        setIsLowSpeed(false);
        triggerPopup('offline');
      }
    }
  }, [triggerPopup]);

  useEffect(() => {
    checkSpeed();

    const handleOnline = () => { setIsOffline(false); checkSpeed(); };
    const handleOffline = () => {
      setIsOffline(true);
      setIsLowSpeed(false);
      setSpeed(0);
      triggerPopup('offline');
    };

    if (Platform.OS === 'web') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Re-check every 60 seconds to avoid excessive data usage
    const interval = setInterval(checkSpeed, 60000);

    return () => {
      clearInterval(interval);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      if (Platform.OS === 'web') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [checkSpeed, triggerPopup]);

  return { isLowSpeed, isOffline, speed, showPopup };
};
