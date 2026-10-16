import { useThemeRevision } from '@/theme';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import { useShortcutSetupStore } from '@/stores/shortcutSetupStore';
const routines = [{ title: 'Search gas', url: 'gasfinder:///' }, { title: 'Log a purchase', url: 'gasfinder://account-transactions' }, { title: 'Manage goal money', url: 'gasfinder://investment' }, { title: 'Review renewals', url: 'gasfinder://subscriptions' }, { title: 'Start a backup', url: 'gasfinder://backup' }];
export default function Automations() {
  useThemeRevision();
  const { captureLog } = useShortcutSetupStore(), [message,setMessage] = useState('');
  return <SafeAreaView edges={['left','right','bottom']} style={s.safe}><Stack.Screen options={{ title: 'Optional quick actions' }} /><FormScrollView contentContainerStyle={s.content}><Text accessibilityRole="header" style={s.title}>Optional quick actions</Text>
  <Link href="/purchase-automation" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Wallet purchase setup ›</Text></Pressable></Link><Link href="/statement-automation" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Citizens statement setup ›</Text></Pressable></Link>
  <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Recent Wallet purchase captures</Text><Text style={s.note}>Last 30 attempts received by this installation. No merchant, amount, link or payload is logged here. This does not prove every card purchase was captured.</Text>{captureLog.map(item => <Text key={item.id} style={s.body}>{new Date(item.at).toLocaleString()} · {item.outcome}</Text>)}{!captureLog.length && <Text style={s.note}>No received handoffs yet. Test the automation on your iPhone.</Text>}</View>
  <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Optional quick actions</Text><Text style={s.note}>In Shortcuts, add URL → Open URLs using one of these links. Actions open a screen for review and never move bank money.</Text>{routines.map(item => <Pressable key={item.url} accessibilityRole="button" style={s.choice} onPress={() => void Clipboard.setStringAsync(item.url).then(() => setMessage(`Copied ${item.title} link.`), () => setMessage('Could not copy link.'))}><Text style={s.choiceText}>Copy: {item.title}</Text></Pressable>)}</View>{!!message && <Text style={s.note}>{message}</Text>}
  </FormScrollView></SafeAreaView>;
}
