import { MoneyPage } from '@/components/MoneyPage';
import SpendingPausePanel from '@/features/spending/SpendingPausePanel';
import SubscriptionsPanel from '@/features/subscriptions/SubscriptionsPanel';

export default function SubscriptionsScreen() {
  return <MoneyPage><SubscriptionsPanel /><SpendingPausePanel /></MoneyPage>;
}
