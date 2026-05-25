import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '@/lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';

export const useNotifications = () => {
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    const setupRealtime = async () => {
      // Use getSession() — no auth lock contention unlike getUser()
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profile) return;

      // Track known pending IDs to only notify on NEW entries
      let lastPendingIds = new Set<string>();

      if (profile.role === 'organization') {
        const { data: initialPending } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', userId)
          .eq('role', 'doctor')
          .eq('status', 'pending');
        if (initialPending) {
          lastPendingIds = new Set(initialPending.map((d: any) => d.id));
        }
      }

      // Cached query — no getUser() inside, uses session userId directly
      const checkPendingApprovals = async () => {
        if (profile.role !== 'organization') return;

        const { data: pendingDoctors } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('org_id', userId)
          .eq('role', 'doctor')
          .eq('status', 'pending');

        if (pendingDoctors) {
          const currentIds = new Set(pendingDoctors.map((d: any) => d.id));
          for (const doc of pendingDoctors) {
            if (!lastPendingIds.has(doc.id)) {
              try {
                await sendLocalNotification(
                  '👨‍⚕️ New Doctor Access Request',
                  `${doc.full_name || 'A doctor'} has requested approval to join your organization.`
                );
              } catch (e) {
                console.log('Push Notification: New Doctor Access Request', doc.full_name);
              }
              DeviceEventEmitter.emit('refreshPendingCount');
            }
          }
          lastPendingIds = currentIds;
        }
      };

      let pollInterval: ReturnType<typeof setInterval> | undefined;
      let channel: any;

      if (profile.role === 'organization') {
        // Poll every 1 second as reliable fallback — realtime handles instant
        pollInterval = setInterval(checkPendingApprovals, 1000);

        channel = supabase
          .channel('org-approval-notifications-' + Date.now())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `org_id=eq.${userId}`,
          }, () => {
            checkPendingApprovals();
          })
          .subscribe();
      } else {
        // Doctors: subscribe to case updates
        channel = supabase
          .channel('doctor-case-notifications-' + Date.now())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cases',
            filter: `doctor_id=eq.${userId}`,
          }, (payload) => {
            const newCase = payload.new as any;
            const oldCase = payload.old as any;
            if (payload.eventType === 'INSERT') {
              console.log('Push Notification: New Case Alert', newCase.patient_name);
            } else if (payload.eventType === 'UPDATE' && newCase.status !== oldCase?.status) {
              console.log('Push Notification: Case Update', newCase.patient_name, '->', newCase.status);
            }
          })
          .subscribe();
      }

      cleanupFn = () => {
        if (channel) supabase.removeChannel(channel);
        if (pollInterval) clearInterval(pollInterval);
      };
    };

    setupRealtime();

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return {};
};
