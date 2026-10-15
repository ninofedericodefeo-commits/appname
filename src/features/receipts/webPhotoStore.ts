// Shared by browser photo persistence and portable backup attachment IO.
export async function photoStore<T>(operation: (store: IDBObjectStore) => IDBRequest<T>, write = false) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('gasfinder-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Photo storage is unavailable.'));
  });
  try { return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('photos', write ? 'readwrite' : 'readonly'), request = operation(transaction.objectStore('photos'));
    transaction.oncomplete = () => resolve(request.result); transaction.onerror = transaction.onabort = () => reject(new Error('Could not read or save a photo.'));
  }); } finally { db.close(); }
}
