import { supabase } from './supabaseClient';

export const examService = {
  async getExams(teacherId) {
    const { data, error } = await supabase
      .from('exams')
      .select('*, exam_results(*)')
      .eq('teacher_id', teacherId);
    
    if (error) throw error;
    
    // Transform to include scores array for backward compat in UI if needed
    return data.map(exam => ({
      ...exam,
      batchId: exam.batch_id,
      teacherId: exam.teacher_id,
      startTime: exam.start_time,
      endTime: exam.end_time,
      results: exam.exam_results.map(r => ({
        studentId: r.student_id,
        marksObtained: r.marks_obtained,
        topicMarks: r.topic_marks,
        remarks: r.remarks
      })),
      // Keep scores for older UI refs if any
      scores: exam.exam_results.map(r => ({
        studentId: r.student_id,
        marksObtained: r.marks_obtained,
        topicMarks: r.topic_marks,
        remarks: r.remarks
      }))
    }));
  },

  async saveExam(examData) {
    const { id, ...data } = examData;
    if (id) {
      const { error } = await supabase
        .from('exams')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      return id;
    } else {
      const { data: newExam, error } = await supabase
        .from('exams')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return newExam.id;
    }
  },

  async saveResults(examId, results) {
    // 1. Delete existing results
    const { error: deleteError } = await supabase
      .from('exam_results')
      .delete()
      .eq('exam_id', examId);
    if (deleteError) throw deleteError;

    // 2. Insert new results
    const entries = results.map(r => ({
      exam_id: examId,
      student_id: r.studentId,
      marks_obtained: r.marksObtained,
      topic_marks: r.topicMarks || {},
      remarks: r.remarks || ''
    }));

    const { error: insertError } = await supabase
      .from('exam_results')
      .insert(entries);
    if (insertError) throw insertError;
  },

  async deleteExam(id) {
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export default examService;
