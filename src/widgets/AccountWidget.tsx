import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type AccountWidgetProps = { enabled: boolean; balance: string; savings: string; waiting: number; updated: string };
const AccountWidget = (props: AccountWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const color = environment.colorScheme === 'dark' ? '#D7E7A7' : '#173A35';
  return <VStack alignment="leading" spacing={8}>
    <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(color)]}>GasFinder · Account</Text>
    <Text modifiers={[font({ weight: 'bold', size: environment.widgetFamily === 'accessoryRectangular' ? 16 : 25 })]}>{props.enabled ? props.balance : 'Open GasFinder'}</Text>
    {props.enabled && <Text modifiers={[font({ size: 12 })]}>{props.savings}</Text>}
    {props.enabled && environment.widgetFamily !== 'accessoryRectangular' && <Text modifiers={[font({ size: 12 })]}>{props.waiting} purchases on your waiting list</Text>}
    {props.enabled && environment.widgetFamily === 'systemMedium' && <Text modifiers={[font({ size: 11 })]}>{props.updated}</Text>}
  </VStack>;
};
export default createWidget<AccountWidgetProps>('AccountWidget', AccountWidget);
