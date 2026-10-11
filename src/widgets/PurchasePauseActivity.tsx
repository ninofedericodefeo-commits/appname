import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { PauseActivityProps } from '@/features/spending/widgetLogic';

const PurchasePauseActivity = (props: PauseActivityProps) => {
  'widget';
  const timer = { lower: new Date(props.createdAt), upper: new Date(props.reviewAt) };
  return {
    banner: <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
      <Text modifiers={[font({ size: 16, weight: 'bold' })]}>GasFinder · {props.name}</Text>
      <Text timerInterval={timer} countsDown modifiers={[font({ size: 24, weight: 'bold' })]} />
      <Text modifiers={[font({ size: 12 })]}>Review after {props.reviewLabel}</Text>
    </VStack>,
    compactLeading: <Image systemName="pause.circle" />,
    compactTrailing: <Text timerInterval={timer} countsDown modifiers={[font({ size: 12 })]} />,
    minimal: <Image systemName="pause.circle" />,
    expandedLeading: <Text>GasFinder</Text>, expandedTrailing: <Image systemName="pause.circle" />,
    expandedBottom: <VStack><Text>{props.name}</Text><Text timerInterval={timer} countsDown /><Text>Review after {props.reviewLabel}</Text></VStack>,
  };
};
export default createLiveActivity<PauseActivityProps>('PurchasePauseActivity', PurchasePauseActivity);
