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
        .select('role, org_id')
        .eq('id', userId)
        .single();

      if (!profile) return;

      const orgId: string = profile.org_id ?? userId;

      // ── Organization role ────────────────────────────────────────────────
      if (profile.role === 'organization') {
        // Track known pending IDs to only notify on NEW entries
        let lastPendingIds = new Set<string>();

        const { data: initialPending } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', userId)
          .eq('role', 'doctor')
          .eq('status', 'pending');
        if (initialPending) {
          lastPendingIds = new Set(initialPending.map((d: any) => d.id));
        }

        const checkPendingApprovals = async () => {
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
                } catch {
                  console.log('Push Notification: New Doctor Access Request', doc.full_name);
                }
                DeviceEventEmitter.emit('refreshPendingCount');
              }
            }
            lastPendingIds = currentIds;
          }
        };

        // Poll every 5s as reliable fallback — realtime handles instant updates
        const pollInterval = setInterval(checkPendingApprovals, 5000);

        const channel = supabase
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

        cleanupFn = () => {
          supabase.removeChannel(channel);
          clearInterval(pollInterval);
        };

      // ── Lab role ─────────────────────────────────────────────────────────
      } else if (profile.role === 'lab') {
        // Track known lab-pending IDs to only notify on new ones
        let lastLabPendingIds = new Set<string>();

        const { data: initialLabCases } = await supabase
          .from('cases')
          .select('id')
          .eq('org_id', orgId)
          .eq('status', 'lab-pending');
        if (initialLabCases) {
          lastLabPendingIds = new Set(initialLabCases.map((c: any) => c.id));
        }

        const checkNewLabRequests = async () => {
          const { data: labCases } = await supabase
            .from('cases')
            .select('id, patient_name, tooth_number')
            .eq('org_id', orgId)
            .eq('status', 'lab-pending');

          if (labCases) {
            const currentIds = new Set(labCases.map((c: any) => c.id));
            for (const c of labCases) {
              if (!lastLabPendingIds.has(c.id)) {
                try {
                  await sendLocalNotification(
                    '🔬 New Lab Requisition',
                    `${c.patient_name} · Tooth ${c.tooth_number} — lab work requested.`
                  );
                } catch {
                  console.log('Push Notification: New Lab Requisition', c.patient_name);
                }
                DeviceEventEmitter.emit('refreshLabCount');
              }
            }
            lastLabPendingIds = currentIds;
          }
        };

        // Poll every 5s as fallback
        const pollInterval = setInterval(checkNewLabRequests, 5000);

        const channel = supabase
          .channel('lab-case-notifications-' + Date.now())
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'cases',
            filter: `org_id=eq.${orgId}`,
          }, (payload) => {
            const newCase = payload.new as any;
            const oldCase = payload.old as any;
            // Only fire when a case transitions INTO lab-pending
            if (newCase.status === 'lab-pending' && oldCase?.status !== 'lab-pending') {
              checkNewLabRequests();
            }
          })
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cases',
            filter: `org_id=eq.${orgId}`,
          }, (payload) => {
            const newCase = payload.new as any;
            if (newCase.status === 'lab-pending') {
              checkNewLabRequests();
            }
          })
          .subscribe();

        cleanupFn = () => {
          supabase.removeChannel(channel);
          clearInterval(pollInterval);
        };

      // ── Doctor role ───────────────────────────────────────────────────────
      } else {
        const channel = supabase
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
              // Notify doctor when their lab request is accepted/completed
              if (newCase.status === 'lab-received') {
                DeviceEventEmitter.emit('caseStatusUpdate', {
                  patientName: newCase.patient_name,
                  status: 'Lab accepted your request and started work',
                });
              } else if (newCase.status === 'completed') {
                DeviceEventEmitter.emit('caseStatusUpdate', {
                  patientName: newCase.patient_name,
                  status: 'Lab work completed — ready for delivery',
                });
              }
            }
          })
          .subscribe();

        cleanupFn = () => {
          supabase.removeChannel(channel);
        };
      }
    };

    setupRealtime();

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return {};
};
