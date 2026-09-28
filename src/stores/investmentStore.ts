import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  InvestmentDestination,
  InvestmentSettings,
  ContributionOption,
  PaymentMethod,
  RoundingIncrement,
  ReviewIntervalDays,
  SimulatedWithdrawal,
  SimulatedPayment,
} from '@/types/investing';

type InvestmentState = {
  feePercent: number;
  maxExtraPayment: number;
  reviewIntervalDays: ReviewIntervalDays;
  lastReviewAt: number;
  demoAccountConnected: boolean;
  destination: InvestmentDestination;
  payments: SimulatedPayment[];
  withdrawals: SimulatedWithdrawal[];
  cashBalance: number;
  investedBalance: number;
  withdrawnTotal: number;
  setInvestmentSettings: (settings: InvestmentSettings) => void;
  connectDemoAccount: () => void;
  setDestination: (destination: InvestmentDestination) => void;
  applyDetectedTransaction: (
    amount: number,
    method: PaymentMethod,
    contribution: number,
    contributionOption: ContributionOption,
    roundingIncrement?: RoundingIncrement,
  ) => void;
  withdrawBalance: () => void;
};

function migratedWithdrawalTotal(amount: number, destination: InvestmentDestination): SimulatedWithdrawal[] {
  if (amount <= 0) return [];
  return [
    {
      id: 'previous-demo-withdrawals',
      amount,
      destination,
      legacy: true,
    },
  ];
}

function migrateWithdrawals(
  state: Pick<InvestmentState, 'withdrawnTotal' | 'destination'> & {
    withdrawals?: SimulatedWithdrawal[];
  },
): SimulatedWithdrawal[] {
  return state.withdrawals?.length
    ? state.withdrawals
    : migratedWithdrawalTotal(state.withdrawnTotal, state.destination);
}

export const useInvestmentStore = create<InvestmentState>()(
  persist(
    (set) => ({
      feePercent: 0.5,
      maxExtraPayment: 5,
      reviewIntervalDays: 30,
      lastReviewAt: Date.now(),
      demoAccountConnected: false,
      destination: 'stocks',
      payments: [],
      withdrawals: [],
      cashBalance: 0,
      investedBalance: 0,
      withdrawnTotal: 0,
      setInvestmentSettings: (settings) => set(settings),
      connectDemoAccount: () => set({ demoAccountConnected: true }),
      setDestination: (destination) => set({ destination }),
      applyDetectedTransaction: (amount, method, contribution, contributionOption, roundingIncrement) =>
        set((state) => {
          const surcharge = Math.min(
            Math.max(0, Math.round(contribution * 100) / 100),
            state.maxExtraPayment,
          );
          const payment: SimulatedPayment = {
            id: `${Date.now()}-${Math.random()}`,
            amount,
            surcharge,
            method,
            createdAt: new Date().toISOString(),
            destination: state.destination,
            contributionOption,
            roundingIncrement,
          };

          return {
            payments: [payment, ...state.payments],
            cashBalance:
              state.destination === 'cash'
                ? Math.round((state.cashBalance + surcharge) * 100) / 100
                : state.cashBalance,
            investedBalance:
              state.destination === 'stocks'
                ? Math.round((state.investedBalance + surcharge) * 100) / 100
                : state.investedBalance,
          };
        }),
      withdrawBalance: () =>
        set((state) => {
          const amount = state.destination === 'cash' ? state.cashBalance : state.investedBalance;
          if (amount <= 0) return state;
          const withdrawal: SimulatedWithdrawal = {
            id: `${Date.now()}-${Math.random()}`,
            amount,
            destination: state.destination,
            createdAt: new Date().toISOString(),
          };
          return {
            cashBalance: state.destination === 'cash' ? 0 : state.cashBalance,
            investedBalance: state.destination === 'stocks' ? 0 : state.investedBalance,
            withdrawnTotal: Math.round((state.withdrawnTotal + amount) * 100) / 100,
            withdrawals: [withdrawal, ...state.withdrawals],
          };
        }),
    }),
    {
      name: 'gasfinder-investment-demo',
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persistedState, version) => {
        if (version === 1) {
          const previousState = persistedState as Omit<
            InvestmentState,
            'demoAccountConnected' | 'destination' | 'cashBalance' | 'withdrawals'
          >;
          return {
            ...previousState,
            demoAccountConnected: false,
            destination: 'stocks',
            cashBalance: 0,
            withdrawals: migratedWithdrawalTotal(previousState.withdrawnTotal, 'stocks'),
            payments: previousState.payments.map((payment) => ({
              ...payment,
              destination: 'stocks',
              contributionOption: 'fee',
            })),
          };
        }
        if (version === 2) {
          const previousState = persistedState as Omit<InvestmentState, 'payments'> & {
            payments: Omit<SimulatedPayment, 'contributionOption'>[];
          };
          const destination = previousState.destination ?? 'stocks';
          return {
            ...previousState,
            withdrawals: migratedWithdrawalTotal(previousState.withdrawnTotal, destination),
            payments: previousState.payments.map((payment) => ({ ...payment, contributionOption: 'fee' })),
          };
        }
        if (version === 3) {
          const previousState = persistedState as InvestmentState;
          return {
            ...previousState,
            withdrawals: migrateWithdrawals(previousState),
            payments: previousState.payments.map((payment) => ({
              ...payment,
              contributionOption:
                payment.contributionOption === 'round-dollar' || payment.contributionOption === 'round-ten'
                  ? 'round-up'
                  : payment.contributionOption,
              roundingIncrement:
                payment.roundingIncrement ??
                (payment.contributionOption === 'round-dollar' ? 1 : payment.contributionOption === 'round-ten' ? 10 : undefined),
            })),
          };
        }
        if (version === 4) {
          const previousState = persistedState as InvestmentState;
          return {
            ...previousState,
            withdrawals: migrateWithdrawals(previousState),
          };
        }
        return persistedState as InvestmentState;
      },
    },
  ),
);
