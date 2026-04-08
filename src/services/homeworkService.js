import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fetch homeworks for a batch.
 */
export async function getBatchHomeworks(batchId) {
  const q = query(
    collection(db, 'homeworks'),
    where('batchId', '==', batchId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Toggle homework completion for a student.
 */
export async function toggleHomeworkCompletion(homeworkId, studentId, isCompleted) {
  const hwRef = doc(db, 'homeworks', homeworkId);
  const snap = await getDocs(query(collection(db, 'homeworks'), where('__name__', '==', homeworkId)));
  if (snap.empty) return;
  
  const data = snap.docs[0].data();
  let completedBy = data.completedBy || [];
  
  if (isCompleted) {
    if (!completedBy.includes(studentId)) completedBy.push(studentId);
  } else {
    completedBy = completedBy.filter(id => id !== studentId);
  }
  
  await updateDoc(hwRef, { completedBy });
}

export const homeworkService = {
  getBatchHomeworks,
  toggleHomeworkCompletion
};

export default homeworkService;
