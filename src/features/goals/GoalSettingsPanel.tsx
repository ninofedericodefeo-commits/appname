import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { formatAmount } from '@/lib/money';
import { parseDollars } from '@/features/pocket/logic';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';
import { goalWidgetAvailable } from './widget';

export default function GoalSettingsPanel({ section = 'all' }: { section?: 'all' | 'suggestions' | 'widget' }) {
  const { goalSettings, updateGoalSettings } = usePocketStore();
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [amount, setAmount] = useState<string | null>(null);
  const [percent, setPercent] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  function save() {
    const cents = parseDollars(amount ?? formatAmount(goalSettings.maxSuggestionCents));
    const value = percent ?? String(goalSettings.maxPurchasePercent), cap = Number(value);
    if (!ready) return;
    if (cents === null || !value.trim() || !Number.isFinite(cap) || cap < 0 || cap > 100) return setMessage('Enter a valid dollar cap and a percent from 0 to 100.');
    updateGoalSettings({ maxSuggestionCents: cents, maxPurchasePercent: cap }); setAmount(null); setPercent(null); setMessage('Suggestion limits saved.');
  }
  return <>
    {section !== 'widget' && <View style={styles.card}><Text style={styles.heading}>Savings suggestions</Text>
      <View style={styles.row}><Text style={styles.label}>Suggest amounts after purchases</Text><Switch accessibilityLabel="Savings suggestions" disabled={!ready} value={goalSettings.suggestionsEnabled} onValueChange={suggestionsEnabled => updateGoalSettings({ suggestionsEnabled })} /></View>
      <Text style={styles.note}>Limits apply to suggestions. Your goal’s automatic rule stays in Edit goal.</Text>
      <Text style={styles.label}>Maximum dollars per suggestion</Text><TextInput style={styles.input} accessibilityLabel="Maximum suggested dollars per purchase" keyboardType="decimal-pad" value={amount ?? formatAmount(goalSettings.maxSuggestionCents)} onChangeText={setAmount} />
      <Text style={styles.label}>Maximum percent of a purchase</Text><TextInput style={styles.input} accessibilityLabel="Maximum percent of a purchase" keyboardType="decimal-pad" value={percent ?? String(goalSettings.maxPurchasePercent)} onChangeText={setPercent} />
      <SubscriptionButton label="Save suggestion limits" disabled={!ready} onPress={save} />{!!message && <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>}
    </View>}
    {section !== 'suggestions' && <View style={styles.card}><Text style={styles.heading}>Goal widget</Text>{goalWidgetAvailable ? <>
      <View style={styles.row}><Text style={styles.label}>Show goal progress</Text><Switch accessibilityLabel="Goal widget" disabled={!ready} value={goalSettings.widgetEnabled} onValueChange={widgetEnabled => updateGoalSettings({ widgetEnabled })} /></View>
      <Text style={styles.note}>Add Savings goal from your iPhone widget gallery. Percent only is the default.</Text>
      {goalSettings.widgetEnabled && <View style={styles.row}><Text style={styles.label}>Show amounts and goal title</Text><Switch accessibilityLabel="Goal widget amounts and title" disabled={!ready} value={goalSettings.widgetShowAmounts} onValueChange={widgetShowAmounts => updateGoalSettings({ widgetShowAmounts })} /></View>}
    </> : <Text style={styles.note}>Requires a widget-enabled iPhone build signed by an enrolled Apple developer team. Your goal remains available inside the app.</Text>}</View>}
  </>;
}
const styles = StyleSheet.create({ card: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 12 }, heading: { color: colors.ink, fontSize: 18, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { color: colors.ink, fontSize: 14, flex: 1 }, note: { color: colors.muted, fontSize: 13, lineHeight: 19 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, color: colors.ink, paddingHorizontal: 12, fontSize: 16 } });
