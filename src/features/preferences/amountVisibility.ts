import { create } from 'zustand';
import { useDevicePrivacy } from '@/features/privacy/deviceStore';
export const useAmountVisibility = create<{ revealed: boolean }>(() => ({ revealed: false }));
export function useAmountsHidden() { const hidden = useDevicePrivacy(state => state.hideAmounts); const revealed = useAmountVisibility(state => state.revealed); return hidden && !revealed; }
