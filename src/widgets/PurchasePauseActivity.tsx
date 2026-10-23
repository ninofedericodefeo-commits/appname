import { Text, VStack } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

// Compatibility registration for dismissing activities created before the waiting list was removed.
// There is no start call for this activity in the app.
const RetiredPurchaseActivity = () => {
  'widget';
  return { banner: <VStack><Text modifiers={[font({ size: 16, weight: 'bold' })]}>Open Tally</Text></VStack> };
};
export default createLiveActivity('PurchasePauseActivity', RetiredPurchaseActivity);
