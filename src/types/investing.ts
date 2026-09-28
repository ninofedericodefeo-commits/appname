export type PaymentMethod = 'phone' | 'debit' | 'credit';
export type InvestmentDestination = 'cash' | 'stocks';
export type ReviewIntervalDays = 7 | 14 | 30;
export type RoundingIncrement = 1 | 10 | 100;
export type ContributionOption = 'none' | 'fee' | 'round-up' | 'round-dollar' | 'round-ten' | 'fixed';

export type InvestmentSettings = {
  feePercent: number;
  maxExtraPayment: number;
  reviewIntervalDays: ReviewIntervalDays;
};

export type SimulatedPayment = {
  id: string;
  amount: number;
  surcharge: number;
  method: PaymentMethod;
  createdAt: string;
  destination: InvestmentDestination;
  contributionOption: ContributionOption;
  roundingIncrement?: RoundingIncrement;
};

export type PurchasePauseStatus = 'waiting' | 'bought' | 'skipped';
export type PurchasePauseItem = {
  id: string;
  name: string;
  amount: number;
  createdAt: number;
  reviewAt: number;
  status: PurchasePauseStatus;
  outcomeAt?: number;
};

export type SimulatedWithdrawal = {
  id: string;
  amount: number;
  destination: InvestmentDestination;
  createdAt?: string;
  legacy?: true;
};
