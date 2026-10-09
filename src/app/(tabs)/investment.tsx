import { CombinedSections } from '@/components/CombinedSections';
import GoalsPanel from '@/features/goals/GoalsPanel';
import SpendingPausePanel from '@/features/spending/SpendingPausePanel';

const sections = [
  { id: 'goals', label: 'Goals', component: GoalsPanel },
  { id: 'pause', label: 'Spending pause', component: SpendingPausePanel },
] as const;

export default function GoalsScreen() {
  return <CombinedSections sections={sections} />;
}
