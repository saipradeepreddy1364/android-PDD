import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendLocalNotification, registerForPushNotificationsAsync } from './notifications';

export const useRealtimeNotifications = () => {
  useEffect(() => {
    let casesChannel: any = null;
    let profilesChannel: any = null;

    const setupNotifications = async () => {
      // 1. Register for notifications
      await registerForPushNotificationsAsync();

      // 2. Fetch current logged-in user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('id, role, org_id')
        .eq('id', user.id)
        .single();

      if (!currentUserProfile) return;

      const userRole = currentUserProfile.role;
      const userId = currentUserProfile.id;
      const userOrgId = userRole === 'organization' ? userId : currentUserProfile.org_id;

      // 3. Subscribe to Supabase Realtime for the 'cases' table (for lab users)
      if (userRole === 'lab') {
        casesChannel = supabase
          .channel('lab-case-updates-' + Date.now())
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'cases',
            },
            (payload) => {
              const newCase = payload.new;
              // Notify only if it belongs to this lab's organization and status is lab-pending
              if (newCase.org_id === userOrgId && newCase.status === 'lab-pending' && newCase.doctor_id !== userId) {
                sendLocalNotification(
                  '🔬 New Lab Requisition',
                  `Case #${newCase.id.slice(0, 8)}: ${newCase.patient_name || 'Patient'} - lab work requested.`,
                  { caseId: newCase.id }
                );
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'cases',
            },
            (payload) => {
              const updatedCase = payload.new;
              const oldCase = payload.old;
              // Notify when status changes to lab-pending
              if (
                updatedCase.org_id === userOrgId &&
                updatedCase.status === 'lab-pending' &&
                oldCase?.status !== 'lab-pending' &&
                updatedCase.doctor_id !== userId
              ) {
                sendLocalNotification(
                  '🔬 New Lab Requisition',
                  `Case #${updatedCase.id.slice(0, 8)}: ${updatedCase.patient_name || 'Patient'} - lab work requested.`,
                  { caseId: updatedCase.id }
                );
              }
            }
          )
          .subscribe();
      }

      // 4. Subscribe to Supabase Realtime for 'profiles' table (for organization users)
      if (userRole === 'organization') {
        profilesChannel = supabase
          .channel('org-approval-updates-' + Date.now())
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'profiles',
            },
            (payload) => {
              const newProfile = payload.new;
              // Notify only if applicant is in this organization and is pending approval
              if (newProfile.org_id === userId && newProfile.status === 'pending') {
                const title = newProfile.role === 'lab' ? '🔬 New Lab Access Request' : '👨‍⚕️ New Doctor Access Request';
                sendLocalNotification(
                  title,
                  `${newProfile.full_name || 'A user'} has requested approval to join your organization.`
                );
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
            },
            (payload) => {
              const updatedProfile = payload.new;
              const oldProfile = payload.old;
              // Notify if status changes to pending (resubmission/update)
              if (
                updatedProfile.org_id === userId &&
                updatedProfile.status === 'pending' &&
                oldProfile?.status !== 'pending'
              ) {
                const title = updatedProfile.role === 'lab' ? '🔬 New Lab Access Request' : '👨‍⚕️ New Doctor Access Request';
                sendLocalNotification(
                  title,
                  `${updatedProfile.full_name || 'A user'} has requested approval to join your organization.`
                );
              }
            }
          )
          .subscribe();
      }
    };

    setupNotifications();

    return () => {
      if (casesChannel) supabase.removeChannel(casesChannel);
      if (profilesChannel) supabase.removeChannel(profilesChannel);
    };
  }, []);
};
