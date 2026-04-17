import { supabase } from './supabaseClient';
import { scheduleService } from './scheduleService';

export const notificationService = {
    /**
     * Scan schedules for upcoming classes and create notifications.
     * To be called on a "Smart Interval" (e.g. every 10-15 mins).
     */
    async generateUpcomingClassAlerts(teacherId) {
        try {
            // Buffer: check for classes starting in the next 60 minutes
            const upcoming = await scheduleService.getUpcomingClasses(teacherId, 60);
            
            if (!upcoming || upcoming.length === 0) return;

            const nowDate = new Date();

            for (const session of upcoming) {
                // Check if a notification already exists for this schedule
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('schedule_id', session.id)
                    .maybeSingle();

                if (!existing) {
                    const startTime = session.start_time.substring(0, 5);
                    const title = `Upcoming Class: ${session.title || 'Session'}`;
                    const message = `Your class with ${session.batchName || 'a batch'} starts at ${startTime}. Click to manage.`;

                    await supabase.from('notifications').insert({
                        teacher_id: teacherId,
                        schedule_id: session.id,
                        title,
                        message,
                        type: 'schedule_prompt',
                        action_data: {
                            scheduleId: session.id,
                            batchId: session.batch_id,
                            batchName: session.batch_name,
                            startTime: session.start_time
                        }
                    });
                }
            }
            
            // Cleanup: remove notifications for classes that are already over or marked completed
            await this.cleanupExpiredAlerts(teacherId);
            
        } catch (err) {
            console.error('Error in notification sync:', err);
        }
    },

    /**
     * Remove temporary notifications for classes that have passed or changed status.
     */
    async cleanupExpiredAlerts(teacherId) {
        const now = new Date();
        const nowDate = now.toISOString().split('T')[0];
        const nowTime = now.toTimeString().split(' ')[0].substring(0, 5);

        // 1. Delete notifications for schedules that aren't 'scheduled' anymore
        // (Supabase CASCADE handles most of this if schedule deleted, but we handle status change here)
        const { data: activeNotifs } = await supabase
            .from('notifications')
            .select('id, schedule_id')
            .not('schedule_id', 'is', null)
            .eq('teacher_id', teacherId);

        if (activeNotifs?.length > 0) {
            const scheduleIds = activeNotifs.map(n => n.schedule_id);
            const { data: schedules } = await supabase
                .from('schedules')
                .select('id, status, date, start_time')
                .in('id', scheduleIds);

            const staleNotifIds = activeNotifs
                .filter(n => {
                    const sch = schedules?.find(s => s.id === n.schedule_id);
                    if (!sch) return true; // Schedule gone
                    if (sch.status !== 'scheduled') return true; // No longer just scheduled
                    
                    // Time expired check
                    if (sch.date < nowDate) return true;
                    if (sch.date === nowDate && sch.start_time < nowTime) return true;
                    
                    return false;
                })
                .map(n => n.id);

            if (staleNotifIds.length > 0) {
                await supabase.from('notifications').delete().in('id', staleNotifIds);
            }
        }
    },

    async deleteNotificationBySchedule(scheduleId) {
        await supabase.from('notifications').delete().eq('schedule_id', scheduleId);
    }
};

export default notificationService;
