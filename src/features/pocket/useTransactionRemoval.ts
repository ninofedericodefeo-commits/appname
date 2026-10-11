import { useState } from 'react';

import { usePocketStore } from '@/stores/pocketStore';
import type { PocketTransaction } from './transactions';

export function useTransactionRemoval() {
  const removeFromHistory = usePocketStore((state) => state.removeTransactionFromHistory);
  const restoreToHistory = usePocketStore((state) => state.restoreTransactionsToHistory);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  function remove(transaction: PocketTransaction) {
    const ids = removeFromHistory(transaction.id);
    if (ids.length) setRemovedIds((previous) => [...new Set([...previous, ...ids])]);
  }
  function undo() {
    restoreToHistory(removedIds);
    setRemovedIds([]);
  }
  return { remove, undo, hasRemoved: removedIds.length > 0 };
}
