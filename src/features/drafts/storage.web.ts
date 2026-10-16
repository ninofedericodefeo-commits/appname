async function access(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const database = await new Promise<IDBDatabase>((resolve,reject) => { const request = indexedDB.open('gasfinder-drafts',1); request.onupgradeneeded = () => request.result.createObjectStore('drafts'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(Error('Draft storage unavailable. Keep your original files.')); });
  try { return await new Promise<unknown>((resolve,reject) => { const transaction = database.transaction('drafts',mode), request = action(transaction.objectStore('drafts')); transaction.oncomplete = () => resolve(request.result); transaction.onabort = transaction.onerror = () => reject(Error('Draft could not be saved. Keep the app open and your original file.')); }); } finally { database.close(); }
}
export const draftStorage = {
  read: (key: string) => access('readonly',store => store.get(key)),
  write: async (key: string, value: unknown) => { await access('readwrite',store => store.put(value,key)); },
  remove: async (key: string) => { await access('readwrite',store => store.delete(key)); },
  clear: async () => { await access('readwrite',store => store.clear()); },
};
