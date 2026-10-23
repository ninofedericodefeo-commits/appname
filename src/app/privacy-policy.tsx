import { Text, View } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import policy from '@/features/privacy/policy.json';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';

export default function PrivacyPolicyScreen() {
  useThemeRevision();
  return <SettingsPage title="Privacy policy">
    <Text style={s.heading}>{policy.appName} · {policy.status}</Text>
    <Text style={s.note}>Updated {policy.updated}</Text>
    <Text selectable style={s.body}>{policy.intro}</Text>
    {policy.sections.map(section => <View key={section.title} style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={s.heading}>{section.title}</Text>
      {section.paragraphs.map(paragraph => <Text selectable key={paragraph} style={s.body}>{paragraph}</Text>)}
    </View>)}
  </SettingsPage>;
}
