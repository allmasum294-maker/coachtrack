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
  }
};

export default scheduleService;
