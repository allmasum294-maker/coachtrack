import { supabase } from './supabaseClient';

export const schoolService = {
  async getSchools(teacherId) {
    const { data, error } = await supabase
      .from('schools')
      .select(`
        *,
        students:students(count)
      `)
      .eq('teacher_id', teacherId)
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    // Transform count object to simple number
    return data.map(s => ({
      ...s,
      studentCount: s.students?.[0]?.count || 0
    }));
  },

  async saveSchool(schoolData) {
    const { id, ...data } = schoolData;
    if (id) {
      const { error } = await supabase
        .from('schools')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      return id;
    } else {
      const { data: newSchool, error } = await supabase
        .from('schools')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return newSchool.id;
    }
  },

  async deleteSchool(id) {
    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export default schoolService;
