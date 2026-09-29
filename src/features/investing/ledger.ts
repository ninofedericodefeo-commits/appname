import type { SimulatedPayment, SimulatedWithdrawal } from '@/types/investing';

type Ledger = {
  payments: SimulatedPayment[];
  withdrawals: SimulatedWithdrawal[];
  cashBalance: number;
  investedBalance: number;
  withdrawnTotal: number;
};

const cents = (amount: number) => Math.round(amount * 100);
const dollars = (amountCents: number) => amountCents / 100;

export function removeDemoPayment(ledger: Ledger, id: string): Partial<Ledger> | null {
  const payment = ledger.payments.find((item) => item.id === id);
  if (!payment) return null;
  const balanceKey = payment.destination === 'cash' ? 'cashBalance' : 'investedBalance';
  const updatedCents = cents(ledger[balanceKey]) - cents(payment.surcharge);
  if (updatedCents < 0) return null;
  return {
    payments: ledger.payments.filter((item) => item.id !== id),
    [balanceKey]: dollars(updatedCents),
  };
}

export function removeDemoWithdrawal(ledger: Ledger, id: string): Partial<Ledger> | null {
  const withdrawal = ledger.withdrawals.find((item) => item.id === id);
  if (!withdrawal) return null;
  const balanceKey = withdrawal.destination === 'cash' ? 'cashBalance' : 'investedBalance';
  return {
    withdrawals: ledger.withdrawals.filter((item) => item.id !== id),
    withdrawnTotal: dollars(cents(ledger.withdrawnTotal) - cents(withdrawal.amount)),
    [balanceKey]: dollars(cents(ledger[balanceKey]) + cents(withdrawal.amount)),
  };
}
