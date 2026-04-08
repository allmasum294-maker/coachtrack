import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fetch lesson plans for a batch.
 */
export async function getBatchLessons(batchId) {
  const q = query(
    collection(db, 'lessons'),
    where('batchId', '==', batchId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Log a new session/lesson log.
 */
export async function logSession(data) {
  const res = await addDoc(collection(db, 'sessionLogs'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return res.id;
}
