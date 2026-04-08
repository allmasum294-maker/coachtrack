import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fetch all batches for a teacher.
 * If includeClosed is false (default), only fetches active batches.
 */
export async function getBatches(teacherId, includeClosed = false) {
  let q = query(
    collection(db, 'batches'),
    where('teacherId', '==', teacherId)
  );
  
  if (!includeClosed) {
    q = query(q, where('isClosed', '==', false));
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Mark a batch as closed (completed).
 */
export async function closeBatch(batchId) {
  const batchRef = doc(db, 'batches', batchId);
  await updateDoc(batchRef, {
    isClosed: true,
    closedAt: serverTimestamp()
  });
}

/**
 * Reactivate a closed batch.
 */
export async function reactivateBatch(batchId) {
  const batchRef = doc(db, 'batches', batchId);
  await updateDoc(batchRef, {
    isClosed: false,
    closedAt: null
  });
}

export const batchService = {
  getBatches,
  closeBatch,
  reactivateBatch
};

export default batchService;
