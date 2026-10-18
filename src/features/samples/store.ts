import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appStorage } from '@/lib/appStorage';

// UI preference only; deliberately outside the financial backup registry.
export const useSampleDataStore = create<{ visible: boolean; setVisible: (visible: boolean) => void }>()(persist(
  set => ({ visible: true, setVisible: visible => set({ visible }) }),
  { name: 'gasfinder-sample-display', storage: createJSONStorage(() => appStorage),
    partialize: state => ({ visible: state.visible }),
    merge: (saved, current) => ({ ...current, visible: typeof (saved as { visible?: unknown } | null)?.visible === 'boolean'
      ? (saved as { visible: boolean }).visible : current.visible }) },
));
