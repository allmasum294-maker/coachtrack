import { supabase } from './supabaseClient';
import { withCache, invalidateCache } from '../utils/serviceCache';

/**
 * Fetch all batches for a teacher.
 * If includeClosed is false (default), only fetches active batches.
 */
export async function getBatches(teacherId, includeClosed = false) {
  // Use a cache key that accounts for the teacher and visibility filter
  const cacheKey = `batches_teacher_${teacherId}_${includeClosed}`;
  
  return withCache(cacheKey, async () => {
    let query = supabase
      .from('batches')
      .select('*')
      .eq('teacher_id', teacherId);
    
    if (!includeClosed) {
      query = query.eq('is_closed', false);
    }
    
    const { data, error } = await query;
    if (error) throw error;

    if (!data) return [];

    return data.map(batch => ({
      ...batch,
      isClosed: batch.is_closed || false,
      closedAt: batch.closed_at || null,
      targetClasses: batch.target_classes || []
    }));
  });
}

/**
 * Mark a batch as closed (completed).
 */
export async function closeBatch(batchId) {
  const { error } = await supabase
    .from('batches')
    .update({
      is_closed: true,
      closed_at: new Date().toISOString()
    })
    .eq('id', batchId);

  if (error) throw error;
  
  // Invalidate all variants of batch cache for this teacher
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (uid) {
    invalidateCache(`batches_teacher_${uid}_true`);
    invalidateCache(`batches_teacher_${uid}_false`);
  }
}

/**
 * Reactivate a closed batch.
 */
export async function reactivateBatch(batchId) {
  const { error } = await supabase
    .from('batches')
    .update({
      is_closed: false,
      closed_at: null
    })
    .eq('id', batchId);

  if (error) throw error;
  
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (uid) {
    invalidateCache(`batches_teacher_${uid}_true`);
    invalidateCache(`batches_teacher_${uid}_false`);
  }
}

/**
 * Bulk transition students from one batch to another.
 * This moves them directly in the student_batches table.
 */
export async function transitionStudentsToBatch(studentIds, fromBatchId, toBatchId) {
  if (!studentIds || studentIds.length === 0) return;
  
  // First, insert new enrollments
  const upserts = studentIds.map(id => ({ student_id: id, batch_id: toBatchId, status: 'enrolled' }));
  const { error: err1 } = await supabase.from('student_batches').upsert(upserts);
  if (err1) throw err1;
  
  // Second, remove from old batch completely
  const { error: err2 } = await supabase
    .from('student_batches')
    .delete()
    .eq('batch_id', fromBatchId)
    .in('student_id', studentIds);
  if (err2) throw err2;
  
  // Invalidate student caches as their batch links have changed
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (uid) invalidateCache(`students_teacher_${uid}`);
}

export const batchService = {
  getBatches,
  closeBatch,
  reactivateBatch,
  transitionStudentsToBatch
};

export default batchService;
