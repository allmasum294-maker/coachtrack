import { supabase } from './supabaseClient';

export const homeworkService = {
  async getHomeworkByTeacher(teacherId) {
    const { data, error } = await supabase
      .from('homeworks')
      .select('*, homework_completions(student_id, status)')
      .eq('teacher_id', teacherId);
    
    if (error) throw error;

    // Transform to include submissions object for backward compatibility in UI
    return data.map(hw => {
      const submissions = {};
      (hw.homework_completions || []).forEach(c => {
        submissions[c.student_id] = { status: c.status };
      });
      return {
        ...hw,
        batchId: hw.batch_id,
        teacherId: hw.teacher_id,
        submissions,
        completedBy: (hw.homework_completions || [])
          .filter(c => c.status === 'completed')
          .map(c => c.student_id)
      };
    });
  },

  async setHomeworkStatus(homeworkId, studentId, status) {
    if (status === 'not_submitted') {
      const { error } = await supabase
        .from('homework_completions')
        .delete()
        .eq('homework_id', homeworkId)
        .eq('student_id', studentId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('homework_completions')
        .upsert({
          homework_id: homeworkId,
          student_id: studentId,
          status: status,
          completed_at: new Date().toISOString()
        }, { onConflict: 'homework_id,student_id' });
      if (error) throw error;
    }
  },

  async saveHomework(hwData) {
    const { id, ...data } = hwData;
    if (id) {
      const { error } = await supabase
        .from('homeworks')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      return id;
    } else {
      const { data: newHw, error } = await supabase
        .from('homeworks')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return newHw.id;
    }
  },

  async deleteHomework(id) {
    const { error } = await supabase
      .from('homeworks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export default homeworkService;
