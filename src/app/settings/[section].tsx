import AccessibilitySettings from '@/features/accessibility/AccessibilitySettings';
import { useThemeRevision } from '@/theme';
import GeneralSettings from '@/features/preferences/GeneralSettings';
import DataHealth from '@/features/data/DataHealth';
import { useInvestmentStore } from '@/stores/investmentStore';
import { useDataStatus } from '@/features/data/operationStatus';
import Constants from 'expo-constants';
import { Link, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import SettingsPage from '@/features/settings/SettingsPage';
import { settingsSections } from '@/features/settings/navigation';
import GasSettings from '@/features/settings/GasSettings';
import AccountSettingsPanel from '@/features/bank/AccountSettingsPanel';
import StatementReminderSettings from '@/features/bank/StatementReminder';
import SubscriptionSettingsPanel from '@/features/subscriptions/SubscriptionSettingsPanel';
import GoalSettingsPanel from '@/features/goals/GoalSettingsPanel';
import WidgetSettingsPanel from '@/features/spending/WidgetSettingsPanel';
import PrivacySettingsPanel from '@/features/privacy/PrivacySettingsPanel';
import EraseDataPanel from '@/features/data/EraseDataPanel';
import BuildCapabilities from '@/features/data/BuildCapabilities';
import { dataStyles as s } from '@/features/data/styles';

function SettingsLink({ href, label }: { href: Href; label: string }) {
  useThemeRevision();
  return <Link href={href} asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>{label} ›</Text></Pressable></Link>;
}

export default function SettingsSectionScreen() {
  useThemeRevision();
  const { section } = useLocalSearchParams<{ section: string }>();
  const { notice } = useDataStatus();
  const legacy = useInvestmentStore();
  const category = settingsSections.find(item => item.id === section);
  return <SettingsPage title={category?.title ?? 'Settings'}>
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
    {section === 'general' && <GeneralSettings />}
    {section === 'accessibility' && <AccessibilitySettings />}
    {section === 'account' && <>
      <AccountSettingsPanel />
      <SettingsLink href="/account-review" label="Review matches & hidden history" />
      <SettingsLink href="/statement-automation" label="Set up quick statement import" />
      <Text style={s.note}>Set up the shortcut and learn how to share a PDF from Citizens.</Text>
      <StatementReminderSettings />
    </>}
    {section === 'gas' && <GasSettings />}
    {section === 'subscriptions' && <SubscriptionSettingsPanel />}
    {section === 'savings' && <GoalSettingsPanel section="suggestions" />}
    {section === 'widgets' && <><WidgetSettingsPanel /><GoalSettingsPanel section="widget" /></>}
    {section === 'privacy' && <>
      <SettingsLink href="/privacy-disclosures" label="How your data is used" />
      <SettingsLink href="/privacy-policy" label="Privacy policy (draft)" />
      <PrivacySettingsPanel />
    </>}
    {section === 'shortcuts' && <>
      <SettingsLink href="/automations" label="Quick actions & purchase capture" />
      <Text style={s.note}>Optional shortcuts for opening screens, plus Wallet purchase setup and recent capture results.</Text>
      <SettingsLink href="/spending-blocker" label="Set up checkout blocking" />
      <Text style={s.note}>Browse shops while recognized checkout pages are paused in Safari or desktop Chrome.</Text>
    </>}
    {section === 'data' && <>
      <SettingsLink href="/backup" label="Backup & restore" />
      <SettingsLink href="/insights" label="Insights & transaction export" />
      <SettingsLink href="/account-data" label="Reset or switch bank account" />
      {(legacy.payments.length > 0 || legacy.withdrawals.length > 0) && <SettingsLink href="/legacy-investment" label="Legacy demo records" />}
      <DataHealth />
      <EraseDataPanel />
    </>}
    {section === 'about' && <>
      <Text style={s.body}>Centsward {Constants.expoConfig?.version ?? '1.0'} · {Platform.OS} build {Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber ?? 'development' : Constants.expoConfig?.android?.versionCode ?? 'development'}</Text>
      <SettingsLink href="/privacy-policy" label="Privacy policy (draft)" />
      <SettingsLink href="/privacy-disclosures" label="How your data is used" />
      <BuildCapabilities />
      <Text style={s.note}>Your preferences are saved on this device.</Text>
    </>}
    {!category && <><Text style={s.note}>This settings section could not be found.</Text><SettingsLink href="/settings" label="All settings" /></>}
  </SettingsPage>;
}
