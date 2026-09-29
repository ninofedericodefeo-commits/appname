import type { ContributionOption, RoundingIncrement } from '@/types/investing';

export function calculateContribution({
  amount,
  option,
  fixedAmount,
  feePercent,
  maxExtraPayment,
  roundingIncrement,
}: {
  amount: number;
  option: ContributionOption | null;
  fixedAmount: string;
  feePercent: number;
  maxExtraPayment: number;
  roundingIncrement: RoundingIncrement;
}) {
  if (!option || option === 'none') return 0;

  const paymentCents = Math.round(amount * 100);
  let contributionCents = 0;
  if (option === 'fee') {
    contributionCents = Math.round((paymentCents * feePercent) / 100);
  } else if (option === 'round-up') {
    const incrementCents = roundingIncrement * 100;
    contributionCents = Math.ceil(paymentCents / incrementCents) * incrementCents - paymentCents;
  } else if (option === 'fixed' && fixedAmount.trim() && Number.isFinite(Number(fixedAmount))) {
    contributionCents = Math.max(0, Math.round(Number(fixedAmount) * 100));
  }

  return Math.min(contributionCents, Math.round(maxExtraPayment * 100)) / 100;
}
