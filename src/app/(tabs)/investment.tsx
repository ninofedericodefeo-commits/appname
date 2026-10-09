import { MoneyPage } from '@/components/MoneyPage';
import GoalsPanel from '@/features/goals/GoalsPanel';
import ActivityPanel from '@/features/pocket/ActivityPanel';

export default function GoalsScreen() {
  return <MoneyPage><GoalsPanel /><ActivityPanel /></MoneyPage>;
}
