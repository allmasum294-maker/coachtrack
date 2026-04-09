import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Migration: Add 'isClosed: false' to all existing batches that lack the field.
 * This is necessary because Firestore queries with 'where("isClosed", "==", false)'
 * will ignore documents where the field is undefined.
 */
export async function migrateBatchesIsClosed() {
  console.log('Starting deep data repair scan...');
  const batchMap = {};
  let totalFixed = 0;

  try {
    // 1. Fix Batches and extract correct teacher IDs
    const batchSnap = await getDocs(collection(db, 'batches'));
    for (const d of batchSnap.docs) {
      const data = d.data();
      const patch = {};
      let needsUpdate = false;

      // Repair nested teacherId if trapped in studentIds map
      if (!data.teacherId && data.studentIds?.teacherId) {
        patch.teacherId = data.studentIds.teacherId;
        needsUpdate = true;
      }
      
      if (data.isClosed === undefined) {
        patch.isClosed = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(doc(db, 'batches', d.id), patch);
        totalFixed++;
      }
      batchMap[d.id] = (patch.teacherId || data.teacherId);
    }

    // 2. Fix Orphans in various collections missing teacherId
    const collections = ['exams', 'attendance', 'homeworks', 'lessons', 'schedules', 'sessionLogs'];
    for (const collName of collections) {
      const collSnap = await getDocs(collection(db, collName));
      for (const d of collSnap.docs) {
        const data = d.data();
        if (!data.teacherId && data.batchId && batchMap[data.batchId]) {
          await updateDoc(doc(db, collName, d.id), { teacherId: batchMap[data.batchId] });
          totalFixed++;
        }
      }
    }

    console.log(`Deep repair completed. Fixed ${totalFixed} structural issues.`);
    return { success: true, count: totalFixed };
  } catch (err) {
    console.error('Migration failed:', err);
    return { success: false, error: err.message };
  }
}
