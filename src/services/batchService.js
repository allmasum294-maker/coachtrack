import { supabase } from './supabaseClient';

/**
 * Fetch all batches for a teacher.
 * If includeClosed is false (default), only fetches active batches.
 */
export async function getBatches(teacherId, includeClosed = false) {
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
}

export const batchService = {
  getBatches,
  closeBatch,
  reactivateBatch
};

export default batchService;
