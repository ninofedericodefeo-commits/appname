import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';

const disclosures = [
  ['Money records', 'Your statements, receipts, balances, goals and bills are stored and processed on this device. There is no automatic bank connection or financial-record sync.'],
  ['Gas, maps and routes', 'Online services receive the area you search, map tiles you view, and route coordinates. They also receive network information such as your IP address.'],
  ['Amazon links', 'On phones, lookup opens the listing with Amazon. On the web, the lookup server also receives the link. It does not send your financial ledger.'],
  ['Wallet automation', 'Only if you set it up: Shortcuts queues purchase details on this phone for you to review. Unsaved drafts expire after 30 days.'],
  ['Checkout pause', 'The optional browser companion keeps its settings in the browser and applies blocking rules there. It does not upload browsing history to the developer.'],
  ['Your choices', 'Permissions are optional. You control exports, reminders, widgets and app lock. Erase app data in Settings → Data & backups; delete exported files and device backups separately.'],
] as const;

export default function PrivacyDisclosuresScreen() {
  useThemeRevision();
  return <SettingsPage title="How your data is used">
    <Text style={s.note}>Draft for the current private app. Online services have their own logging and retention practices.</Text>
    {disclosures.map(([title, body]) => <View key={title} style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{title}</Text>
      <Text selectable style={s.body}>{body}</Text>
    </View>)}
    <Link href="/privacy-policy" asChild><Pressable accessibilityRole="link" style={s.choice}><Text style={s.choiceText}>Read the draft privacy policy ›</Text></Pressable></Link>
  </SettingsPage>;
}
