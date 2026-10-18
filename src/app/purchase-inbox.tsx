import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dataStyles as s } from '@/features/data/styles';
import { removePendingWalletPurchase, usePendingWalletPurchases } from '@/features/goals/purchaseInboxBridge';
import { formatMoney } from '@/lib/money';
import { useThemeRevision } from '@/theme';

export default function PurchaseInboxScreen() {
  useThemeRevision();
  const { items, error: loadError, available, allowed, refresh } = usePendingWalletPurchases();
  const [error, setError] = useState(''), [removing, setRemoving] = useState<string | null>(null);
  async function skip(id: string) {
    if (removing) return;
    setRemoving(id); setError('');
    try { await removePendingWalletPurchase(id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not dismiss this purchase.'); }
    finally { setRemoving(null); }
  }
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>Wallet purchases</Text>
    <Text style={s.note}>These are drafts captured by your Shortcuts automation. Review each purchase before adding it to your account. Captures expire after 30 days.</Text>
    {available && !allowed && <Text style={s.body}>Unlock GasFinder and reveal financial amounts to review pending purchases. Wait for any account operation to finish.</Text>}
    {!available && <Text style={s.body}>Install the latest iPhone build to capture Wallet purchases while locked.</Text>}
    {available && allowed && !items.length && !loadError && <Text style={s.body}>No pending purchases. New captures will appear here after you unlock and open GasFinder.</Text>}
    {items.map(item => <View key={item.id} style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{item.merchant}</Text>
      <Text style={s.body}>{formatMoney(item.amountCents)} · {new Date(item.capturedAt).toLocaleString()}</Text>
      <Link href={{ pathname: '/import-purchase', params: { pendingWalletId: item.id } }} asChild><Pressable accessibilityRole="button" style={s.button}><Text style={s.buttonText}>Review {item.merchant} purchase</Text></Pressable></Link>
      <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${item.merchant} draft without recording it`} disabled={!!removing || !allowed} style={s.choice} onPress={() => void skip(item.id)}><Text style={s.choiceText}>{removing === item.id ? 'Dismissing…' : 'Dismiss draft'}</Text></Pressable>
    </View>)}
    {!!(error || loadError) && <Text accessibilityRole="alert" style={s.danger}>{error || loadError}</Text>}
    {available && <Pressable accessibilityRole="button" disabled={!allowed} style={s.choice} onPress={refresh}><Text style={s.choiceText}>Refresh pending purchases</Text></Pressable>}
    <Link href="/account-transactions" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Open transactions</Text></Pressable></Link>
  </ScrollView></SafeAreaView>;
}
