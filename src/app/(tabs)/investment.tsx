import { MoneyPage } from '@/components/MoneyPage';
import GoalsPanel from '@/features/goals/GoalsPanel';
import PastGoals from '@/features/goals/PastGoals';

export default function GoalsScreen() {
  return <MoneyPage><GoalsPanel /><PastGoals /></MoneyPage>;
}
