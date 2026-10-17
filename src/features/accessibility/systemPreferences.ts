import { create } from 'zustand';
export const useSystemAccessibility = create<{ screenReader: boolean; boldText: boolean }>(() => ({ screenReader: false, boldText: false }));
