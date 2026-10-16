import { useThemeRevision } from '@/theme';
import { useDataStatus } from '@/features/data/operationStatus';
import { useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { dataStyles as s } from '@/features/data/styles';
import { resetAccountData } from '@/features/data/backupService';
export default function AccountData() {
  useThemeRevision();
  const { notice } = useDataStatus();
  const [backed, setBacked] = useState(false), [name,setName] = useState(''), [confirmation,setConfirmation] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  return <SafeAreaView edges={['left','right','bottom']} style={s.safe}><Stack.Screen options={{ title: 'Account data' }} /><FormScrollView contentContainerStyle={s.content}><Text accessibilityRole="header" style={s.title}>Start a fresh account</Text>{!!notice && <View style={s.card}><Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text><Link href="/backup" style={s.choiceText}>Recovery copy ›</Link><Link href="/pocket" style={s.choiceText}>Open Account ›</Link></View>}<Text style={s.body}>Switching accounts starts a separate empty ledger. It removes the current balance, transactions, purchase matches, goal history and set-asides from active records. It clears statement quick-import setup and moves saved imports to recoverable Trash. Fuel reports stay, with Account links cleared. Subscriptions and cars stay.</Text><Text style={s.danger}>Reimported transactions can be added again after a reset. Old savings and duplicate protection are no longer active. Your most recent local recovery copy is replaced; keep an encrypted backup for each account.</Text>
  <Link href="/backup" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Create an encrypted backup first ›</Text></Pressable></Link>
  <Pressable accessibilityRole="checkbox" aria-checked={backed} accessibilityState={{ checked: backed }} style={[s.choice, backed && s.selected]} onPress={() => setBacked(!backed)}><Text style={s.choiceText}>{backed ? '✓ ' : ''}I saved a backup I can restore</Text></Pressable>
  <TextInput accessibilityLabel="New account name" placeholder="New account name (optional)" maxLength={60} style={s.input} value={name} onChangeText={setName} /><TextInput accessibilityLabel="Confirm account reset" placeholder="Type RESET to confirm" autoCapitalize="characters" style={s.input} value={confirmation} onChangeText={setConfirmation} />
  <Pressable accessibilityRole="button" disabled={busy || !backed || confirmation !== 'RESET'} style={[s.button, (busy || !backed || confirmation !== 'RESET') && s.disabled]} onPress={() => { setBusy(true); setError(''); void resetAccountData(name).catch(cause => setError(cause.message)).finally(() => setBusy(false)); }}><Text style={s.buttonText}>Reset account with local Undo</Text></Pressable><Text style={s.note}>Undo in Backup & restore returns all records to their state before this reset. A later restore/reset replaces that recovery copy. Original files are retained for recovery; this is not permanent erasure.</Text>{!!error && <View><Text style={s.danger}>{error}</Text></View>}
  </FormScrollView></SafeAreaView>;
}
