import { CombinedSections } from '@/components/CombinedSections';
import ActivityPanel from '@/features/pocket/ActivityPanel';
import SubscriptionsPanel from '@/features/subscriptions/SubscriptionsPanel';

const sections = [
  { id: 'subscriptions', label: 'Subscriptions', component: SubscriptionsPanel },
  { id: 'activity', label: 'Activity', component: ActivityPanel },
] as const;

export default function SubscriptionsScreen() {
  return <CombinedSections sections={sections} />;
}
