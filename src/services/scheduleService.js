import { supabase } from './supabaseClient';

export const scheduleService = {
  /**
   * Fetch all schedules for a teacher.
   */
  async getSchedules(teacherId) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('teacher_id', teacherId);

    if (error) throw error;

    return data.map(s => ({
      ...s,
      batchId: s.batch_id,
      batchName: s.batch_name,
      teacherId: s.teacher_id,
      startTime: s.start_time,
      endTime: s.end_time
    }));
  },

  /**
   * Fetch schedules for a specific batch.
   */
  async getBatchSchedules(batchId) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('batch_id', batchId);

    if (error) throw error;

    return data.map(s => ({
      ...s,
      batchId: s.batch_id,
      batchName: s.batch_name,
      teacherId: s.teacher_id,
      startTime: s.start_time,
      endTime: s.end_time
    }));
  },

  /**
   * Update the status of a schedule.
   */
  async updateScheduleStatus(id, status) {
    const { data, error } = await supabase
      .from('schedules')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0];
  },

  /**
   * Fetch schedules starting within a time window for notifications.
   */
  async getUpcomingClasses(teacherId, bufferMinutes = 60) {
    const now = new Date();
    const future = new Date(now.getTime() + bufferMinutes * 60000);
    
    const nowDate = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().split(' ')[0].substring(0, 5);
    const futureTime = future.toTimeString().split(' ')[0].substring(0, 5);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('status', 'scheduled')
      .eq('date', nowDate)
      .gte('start_time', nowTime)
      .lte('start_time', futureTime);

    if (error) throw error;
    return data;
  }
};

export default scheduleService;
