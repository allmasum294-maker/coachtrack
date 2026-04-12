import { supabase } from './supabaseClient';

export const attendanceService = {
  /**
   * Fetch all attendance records for a batch.
   */
  async getBatchAttendance(batchId) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_log (
          student_id,
          status
        )
      `)
      .eq('batch_id', batchId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data.map(record => ({
      ...record,
      batchId: record.batch_id,
      teacherId: record.teacher_id,
      records: record.attendance_log?.map(log => ({
        studentId: log.student_id,
        status: log.status
      })) || []
    }));
  },

  /**
   * Save or update attendance for a specific date.
   */
  async saveAttendance(teacherId, batchId, dateStr, records) {
    // 1. Check if record exists for this date/batch/teacher
    const { data: existing, error: fetchError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('batch_id', batchId)
      .eq('date', dateStr)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let recordId;

    if (existing) {
      recordId = existing.id;
      // Update the updated_at timestamp
      await supabase
        .from('attendance_records')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', recordId);
        
      // Delete existing logs for this record to "overwrite"
      await supabase
        .from('attendance_log')
        .delete()
        .eq('attendance_record_id', recordId);
    } else {
      // Create new record
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          teacher_id: teacherId,
          batch_id: batchId,
          date: dateStr
        })
        .select()
        .single();

      if (insertError) throw insertError;
      recordId = newRecord.id;
    }

    // 2. Insert new logs
    const logs = Object.entries(records).map(([studentId, status]) => ({
      attendance_record_id: recordId,
      student_id: studentId,
      status: status
    }));

    const { error: logsError } = await supabase
      .from('attendance_log')
      .insert(logs);

    if (logsError) throw logsError;

    return recordId;
  },

  async getAttendanceByTeacher(teacherId) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, attendance_log(student_id, status)')
      .eq('teacher_id', teacherId);
    
    if (error) throw error;
    
    return data.map(record => ({
      ...record,
      records: record.attendance_log?.map(log => ({
        studentId: log.student_id,
        status: log.status
      })) || []
    }));
  }
};

export default attendanceService;
