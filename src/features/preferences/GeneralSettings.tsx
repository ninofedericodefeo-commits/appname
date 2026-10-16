import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';
export default function GeneralSettings() {
  useThemeRevision();
  const { appearance, strongerContrast, startScreen, configure } = useSettingsStore();
  return <><Text style={s.note}>Changes save immediately. Text size follows your phone’s accessibility settings.</Text><View style={s.card}><Text accessibilityRole="header" style={s.heading}>Appearance</Text><View style={s.row}>{(['system','light','dark'] as const).map(value => <SubscriptionButton key={value} label={value[0].toUpperCase()+value.slice(1)} tone={appearance === value ? 'primary' : 'secondary'} accessibilityState={{ selected: appearance === value }} onPress={() => configure({ appearance: value })} />)}</View><SubscriptionButton label={strongerContrast ? '✓ Stronger contrast' : 'Stronger contrast'} accessibilityState={{ selected: strongerContrast }} onPress={() => configure({ strongerContrast: !strongerContrast })} /></View><View style={s.card}><Text accessibilityRole="header" style={s.heading}>Start screen</Text><View style={s.row}>{([['index','Gas'],['investment','Goals'],['pocket','Account'],['subscriptions','Subscriptions']] as const).map(([value,label]) => <SubscriptionButton key={value} label={label} tone={startScreen === value ? 'primary' : 'secondary'} accessibilityState={{ selected: startScreen === value }} onPress={() => configure({ startScreen: value })} />)}</View><Text style={s.note}>Used on a fresh normal launch. Shared files, notifications and links open their requested screen.</Text></View><Link href="/setup" asChild><SubscriptionButton label="Quick setup & help" onPress={() => {}} /></Link></>;
}
