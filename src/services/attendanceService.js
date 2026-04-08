import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';

/**
 * Fetch all attendance records for a batch.
 */
export async function getBatchAttendance(batchId) {
  const q = query(
    collection(db, 'attendance'),
    where('batchId', '==', batchId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Save or update attendance for a specific date.
 */
export async function saveAttendance(teacherId, batchId, dateStr, records) {
  const snap = await getDocs(
    query(
      collection(db, 'attendance'),
      where('teacherId', '==', teacherId),
      where('batchId', '==', batchId)
    )
  );
  
  const existing = snap.docs.find(d => {
    const data = d.data();
    const dVal = data.date?.toDate ? format(data.date.toDate(), 'yyyy-MM-dd') : data.date;
    return dVal === dateStr;
  });

  const data = {
    batchId,
    teacherId,
    date: Timestamp.fromDate(new Date(dateStr)),
    records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
    updatedAt: serverTimestamp()
  };

  if (existing) {
    await updateDoc(doc(db, 'attendance', existing.id), data);
    return existing.id;
  } else {
    data.createdAt = serverTimestamp();
    const res = await addDoc(collection(db, 'attendance'), data);
    return res.id;
  }
}

export const attendanceService = {
  getBatchAttendance,
  saveAttendance
};

export default attendanceService;
