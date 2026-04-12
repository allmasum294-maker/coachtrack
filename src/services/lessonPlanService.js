import { supabase } from './supabaseClient';

export const lessonPlanService = {
  /**
   * Fetch lesson plans (session logs) for a batch.
   */
  async getBatchLessons(batchId) {
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('batch_id', batchId)
      .order('date', { ascending: false });

    if (error) throw error;
    if (!data) return [];
    return data.map(l => ({
      ...l,
      batchId: l.batch_id,
      teacherId: l.teacher_id
    }));
  },

  /**
   * Log a new session/lesson log.
   */
  async logSession(data) {
    const { data: res, error } = await supabase
      .from('session_logs')
      .insert({
        teacher_id: data.teacherId,
        batch_id: data.batchId,
        schedule_id: data.scheduleId,
        date: data.date || new Date().toISOString().split('T')[0],
        topics_covered: data.topicsCovered,
        homework_assigned: data.homeworkAssigned,
        notes: data.notes
      })
      .select()
      .single();

    if (error) throw error;
    return res.id;
  },

  async getLessonsByTeacher(teacherId) {
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('teacher_id', teacherId);
    if (error) throw error;
    if (!data) return [];
    return data.map(l => ({
      ...l,
      batchId: l.batch_id,
      teacherId: l.teacher_id
    }));
  }
};

export default lessonPlanService;
