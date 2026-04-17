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
        batch_name: data.batchName, // New field
        schedule_id: data.scheduleId,
        class_title: data.classTitle, // New field
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
    // We update this to also include the linked hierarchical items
    const { data, error } = await supabase
      .from('session_logs')
      .select(`
        *,
        linked_lessons:session_log_lessons(
          lesson:lesson_plan_items(*)
        )
      `)
      .eq('teacher_id', teacherId)
      .order('date', { ascending: false });

    if (error) throw error;
    if (!data) return [];
    return data.map(l => ({
      ...l,
      batchId: l.batch_id,
      batchName: l.batch_name,
      classTitle: l.class_title,
      teacherId: l.teacher_id,
      coveredLessons: (l.linked_lessons || []).map(link => link.lesson)
    }));
  },

  /**
   * Hierarchical Plan Management
   */
  async getFullHierarchy(teacherId, batchId = null) {
    let query = supabase
      .from('lesson_plan_items')
      .select('*')
      .eq('teacher_id', teacherId);
    
    if (batchId) {
      // For isolation, we only want items linked to this batch or children of those items
      // In a flat table with parent_id, we fetch all and then filter in UI, 
      // but to be efficient we fetch by batch_id if it's a Level 0 item.
      // However, children might not have batch_id. 
      // BEST: level 0 has batch_id, we fetch all for teacher and filter tree in UI.
      // OR: we tag all items with batch_id.
    }

    const { data, error } = await query.order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async saveHierarchyItem(item) {
    // Ensure batch_id is present for root items
    const { data, error } = await supabase
      .from('lesson_plan_items')
      .upsert({
        ...item,
        batch_id: item.batch_id || item.batchId // Support both cases
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteHierarchyItem(id) {
    const { error } = await supabase
      .from('lesson_plan_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Link lessons to a session
   */
  async linkLessonsToSession(sessionLogId, lessonItemIds) {
    // Remove existing links
    await supabase
      .from('session_log_lessons')
      .delete()
      .eq('session_log_id', sessionLogId);

    if (!lessonItemIds || lessonItemIds.length === 0) return;

    // Add new links
    const { error } = await supabase
      .from('session_log_lessons')
      .insert(lessonItemIds.map(id => ({
        session_log_id: sessionLogId,
        lesson_item_id: id
      })));

    if (error) throw error;
  }
};

export default lessonPlanService;
