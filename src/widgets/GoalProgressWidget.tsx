import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type GoalWidgetProps = {
  enabled: boolean;
  title: string;
  percent: number;
  savedCents: number;
  targetCents: number;
  showAmounts: boolean;
};

const GoalProgress = (props: GoalWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  if (!props.enabled) {
    return <VStack><Text>Enable goal widget in GasFinder</Text></VStack>;
  }
  if (environment.widgetFamily === 'accessoryRectangular') {
    return <VStack>
      <Text modifiers={[font({ weight: 'bold', size: 15 })]}>{props.title}</Text>
      <Text>{props.percent}% saved · Keep going</Text>
    </VStack>;
  }
  return <VStack>
    <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#047857')]}>{props.title}</Text>
    <Text modifiers={[font({ weight: 'bold', size: 30 })]}>{props.percent}%</Text>
    <Text>{props.showAmounts ? `$${(props.savedCents / 100).toFixed(2)} of $${(props.targetCents / 100).toFixed(2)}` : 'One step closer'}</Text>
  </VStack>;
};

export default createWidget<GoalWidgetProps>('GoalProgressWidget', GoalProgress);
