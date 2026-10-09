import { MoneyPage } from '@/components/MoneyPage';
import GoalsPanel from '@/features/goals/GoalsPanel';
import ActivityPanel from '@/features/pocket/ActivityPanel';
import { useRef } from 'react';
import { Keyboard, View } from 'react-native';
import type { ScrollView } from 'react-native';

export default function GoalsScreen() {
  const scroll = useRef<ScrollView>(null);
  const activityY = useRef(0);
  function viewActivity() {
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: activityY.current, animated: true });
  }
  return <MoneyPage scrollRef={scroll}>
    <GoalsPanel onViewActivity={viewActivity} />
    <View onLayout={({ nativeEvent }) => { activityY.current = nativeEvent.layout.y; }}><ActivityPanel /></View>
  </MoneyPage>;
}
