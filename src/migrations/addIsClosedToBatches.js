import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Migration: Add 'isClosed: false' to all existing batches that lack the field.
 * This is necessary because Firestore queries with 'where("isClosed", "==", false)'
 * will ignore documents where the field is undefined.
 */
export async function migrateBatchesIsClosed() {
  console.log('Starting migration: addIsClosedToBatches...');
  const batchesRef = collection(db, 'batches');
  const querySnapshot = await getDocs(batchesRef);
  
  const batch = writeBatch(db);
  let count = 0;

  querySnapshot.forEach((d) => {
    const data = d.data();
    if (data.isClosed === undefined) {
      const docRef = doc(db, 'batches', d.id);
      batch.update(docRef, { isClosed: false });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Migration completed. Updated ${count} batches.`);
    return { success: true, count };
  } else {
    console.log('No batches found needing migration.');
    return { success: true, count: 0 };
  }
}
