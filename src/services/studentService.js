import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Fetch all enrolled students for a given batch.
 * Enrolled students have status === 'enrolled'.
 */
export async function getEnrolledStudents(batchId) {
  const q = query(
    collection(db, 'students'),
    where('batchIds', 'array-contains', batchId),
    where('status', '==', 'enrolled')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch all unenrolled students for a given batch.
 */
export async function getUnenrolledStudents(batchId) {
  const q = query(
    collection(db, 'students'),
    where('batchIds', 'array-contains', batchId),
    where('status', '==', 'unenrolled')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Set a student's enrollment status.
 * status must be 'enrolled' or 'unenrolled'.
 */
export async function setStudentStatus(studentId, status) {
  if (!['enrolled', 'unenrolled'].includes(status)) {
    throw new Error('Invalid status value');
  }
  const studentRef = doc(db, 'students', studentId);
  await updateDoc(studentRef, { status });
}

/**
 * Filter students by school within a batch.
 */
export async function getStudentsBySchool(batchId, schoolName) {
  const q = query(
    collection(db, 'students'),
    where('batchIds', 'array-contains', batchId),
    where('school', '==', schoolName),
    where('status', '==', 'enrolled')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export const studentService = {
  getEnrolledStudents,
  getUnenrolledStudents,
  setStudentStatus,
  getStudentsBySchool
};

export default studentService;
