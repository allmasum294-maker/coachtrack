import { supabase } from './supabaseClient';

/**
 * Fetch all enrolled students for a given batch.
 * Enrolled students have status === 'enrolled' in the student_batches table.
 */
export async function getEnrolledStudents(batchId) {
  const { data, error } = await supabase
    .from('student_batches')
    .select(`
      student_id,
      students (*)
    `)
    .eq('batch_id', batchId)
    .eq('status', 'enrolled');

  if (error) throw error;
  // Flatten the result to match expected format
  return data.map(item => ({
    id: item.students.id,
    ...item.students
  }));
}

/**
 * Fetch all unenrolled students for a given batch.
 */
export async function getUnenrolledStudents(batchId) {
  const { data, error } = await supabase
    .from('student_batches')
    .select(`
      student_id,
      students (*)
    `)
    .eq('batch_id', batchId)
    .eq('status', 'unenrolled');

  if (error) throw error;
  return data.map(item => ({
    id: item.students.id,
    ...item.students
  }));
}

/**
 * Set a student's enrollment status for a specific batch.
 * status must be 'enrolled' or 'unenrolled'.
 */
export async function setStudentStatus(studentId, batchId, status) {
  if (!['enrolled', 'unenrolled'].includes(status)) {
    throw new Error('Invalid status value');
  }
  
  const { error } = await supabase
    .from('student_batches')
    .upsert({
      student_id: studentId,
      batch_id: batchId,
      status: status
    });

  if (error) throw error;
}

/**
 * Filter students by school within a batch.
 */
export async function getStudentsBySchool(batchId, schoolName) {
  const { data, error } = await supabase
    .from('student_batches')
    .select(`
      student_id,
      students (*)
    `)
    .eq('batch_id', batchId)
    .eq('status', 'enrolled')
    .filter('students.school', 'eq', schoolName);

  if (error) throw error;
  return data.map(item => ({
    id: item.students.id,
    ...item.students,
    batchIds: item.students.student_batches?.map(sb => sb.batch_id) || []
  }));
}

/**
 * Fetch all students for a teacher with their batch associations.
 */
export async function getStudentsByTeacher(teacherId) {
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      student_batches (
        batch_id
      )
    `)
    .eq('teacher_id', teacherId);

  if (error) throw error;
  
  // Transform to match the UI expectation (batchIds array)
  return data.map(s => ({
    ...s,
    batchIds: s.student_batches?.map(sb => sb.batch_id) || []
  }));
}

/**
 * Enroll a student in a batch.
 */
export async function enrollStudentInBatch(studentId, batchId) {
  const { error } = await supabase
    .from('student_batches')
    .upsert({
      student_id: studentId,
      batch_id: batchId
    });
  if (error) throw error;
}

/**
 * Remove a student from a batch.
 */
export async function unenrollStudentFromBatch(studentId, batchId) {
  const { error } = await supabase
    .from('student_batches')
    .delete()
    .eq('student_id', studentId)
    .eq('batch_id', batchId);
  if (error) throw error;
}

export const studentService = {
  getEnrolledStudents,
  getUnenrolledStudents,
  setStudentStatus,
  getStudentsBySchool,
  getStudentsByTeacher,
  enrollStudentInBatch,
  unenrollStudentFromBatch
};

export default studentService;
