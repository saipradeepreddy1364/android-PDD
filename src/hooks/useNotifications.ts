import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '@/lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';

export const useNotifications = () => {
  useEffect(() => {
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!profile) return;

      let lastPendingIds = new Set<string>();

      // If org, get initial pending doctors list
      if (profile.role === 'organization') {
        const { data: initialPending } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', user.id)
          .eq('role', 'doctor')
          .eq('status', 'pending');
        if (initialPending) {
          lastPendingIds = new Set(initialPending.map(d => d.id));
        }
      }

      const checkPendingApprovals = async () => {
        if (profile.role !== 'organization') return;

        const { data: pendingDoctors } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('org_id', user.id)
          .eq('role', 'doctor')
          .eq('status', 'pending');

        if (pendingDoctors) {
          const currentIds = new Set(pendingDoctors.map(d => d.id));
          
          for (const doc of pendingDoctors) {
            if (!lastPendingIds.has(doc.id)) {
              showNativeNotification(`👨‍⚕️ New Doctor Access Request`, {
                body: `${doc.full_name || 'A doctor'} has requested approval to join your organization.`,
              });
              DeviceEventEmitter.emit('refreshPendingCount');
            }
          }
          lastPendingIds = currentIds;
        }
      };

      // Poll every 100ms for near-continuous background changes
      let pollInterval: any;
      if (profile.role === 'organization') {
        pollInterval = setInterval(checkPendingApprovals, 100);
      }

      // Realtime fallback
      let channel: any;
      if (profile.role === 'organization') {
        channel = supabase
          .channel('org-approval-notifications-' + Date.now())
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'profiles',
              filter: `org_id=eq.${user.id}`,
            },
            () => {
              checkPendingApprovals();
            }
          )
          .subscribe();
      } else {
        channel = supabase
          .channel('doctor-case-notifications-' + Date.now())
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'cases',
              filter: `doctor_id=eq.${user.id}`,
            },
            (payload) => {
              const newCase = payload.new as any;
              const oldCase = payload.old as any;

              if (payload.eventType === 'INSERT' && (newCase.is_urgent || newCase.status === 'in-progress' || newCase.status === 'pending')) {
                showNativeNotification(`New Case Alert: ${newCase.patient_name}`, {
                  body: `Tooth ${newCase.tooth_number}: ${newCase.diagnosis}`,
                });
              } else if (payload.eventType === 'UPDATE' && newCase.status !== oldCase.status) {
                showNativeNotification(`Case Update: ${newCase.patient_name}`, {
                  body: `Status changed to ${newCase.status}`,
                });
              }
            }
          )
          .subscribe();
      }

      return () => {
        if (channel) supabase.removeChannel(channel);
        if (pollInterval) clearInterval(pollInterval);
      };
    };

    let cleanupFn: () => void;
    setupRealtime().then(cleanup => {
      if (cleanup) cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, []);

  const showNativeNotification = async (title: string, options?: { body: string }) => {
    try {
      await sendLocalNotification(title, options?.body || '');
    } catch (e) {
      console.error("Error sending native notification:", e);
    }
    console.log("Push Notification:", title, options?.body);
  };

  return { showNativeNotification };
};
