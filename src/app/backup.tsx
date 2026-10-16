import DataHealth from '@/features/data/DataHealth';
import { useThemeRevision } from '@/theme';
import EraseDataPanel from '@/features/data/EraseDataPanel';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { makeBackup, inspectBackup, restoreBackup, backupSummary, hasRestoreRollback, undoRestore } from '@/features/data/backupService';
import { pickBackupText } from '@/features/data/fileIO';
import type { ExportLink } from '@/features/data/fileIO';
import type { BackupPayload } from '@/features/data/backupFormat';
import { useDataStatus } from '@/features/data/operationStatus';
import { dataStyles as s } from '@/features/data/styles';
import { formatMoney } from '@/lib/money';

export default function BackupScreen() {
  useThemeRevision();
  const { notice } = useDataStatus();
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [files, setFiles] = useState<boolean | 'available'>(true);
  const [restorePassword, setRestorePassword] = useState(''), [file, setFile] = useState<string | null>(null), [preview, setPreview] = useState<BackupPayload | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(notice), [error, setError] = useState('');
  const [download, setDownload] = useState<ExportLink | null>(null), [canUndo, setCanUndo] = useState(false), [undoConfirm, setUndoConfirm] = useState(false);
  useEffect(() => { void hasRestoreRollback().then(setCanUndo).catch(() => undefined); }, []);
  useEffect(() => () => { if (download && Platform.OS === 'web') URL.revokeObjectURL(download.url); }, [download]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this data action.'); }
    finally { setBusy(false); }
  }
  const summary = preview ? backupSummary(preview.stores) : null;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={s.safe}><Stack.Screen options={{ title: 'Backup & restore' }} /><FormScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>Backup & restore</Text>
    <Text style={s.note}>Save an encrypted copy in Files or iCloud Drive. Keep the password separately: GasFinder cannot recover it. Backups contain private financial records.</Text>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Create a backup</Text>
      <Text style={s.note}>Includes transactions, duplicate protection, balances, goals, subscriptions, cars, preferences and import metadata.</Text>
      <TextInput accessibilityLabel="Backup password" placeholder="Password · at least 12 characters" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} editable={!busy} />
      <TextInput accessibilityLabel="Confirm backup password" placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} editable={!busy} />
      <DataHealth /><View style={s.row}>{([{ value: true, label: 'All originals & photos' }, { value: 'available', label: 'Available files only' }, { value: false, label: 'Records only' }] as const).map(option => <Pressable key={String(option.value)} accessibilityRole="button" accessibilityState={{ selected: files === option.value }} disabled={busy} style={[s.choice, files === option.value && s.selected]} onPress={() => setFiles(option.value)}><Text style={s.choiceText}>{option.label}</Text></Pressable>)}</View>
      <Text style={s.note}>{files === 'available' ? 'Includes readable files up to 30 MB. Missing originals/photos are marked; your source records remain. Check the counts before exporting.' : files ? 'Requires every original and photo. If a file is missing, choose Available files only or Records only.' : 'Records only. Originals/photos must be reselected after restoring.'}</Text>
      <Pressable accessibilityRole="button" disabled={busy || password.length < 12 || password !== confirm} style={[s.button, (busy || password.length < 12 || password !== confirm) && s.disabled]} onPress={() => void run(async () => { const result = await makeBackup(password, files); setPassword(''); setConfirm(''); if (result) setDownload(result); setMessage(result ? 'Encrypted backup ready. Save it using the download below.' : 'Backup created. Finish saving it in the share sheet.'); })}><Text style={s.buttonText}>Create encrypted backup</Text></Pressable>
      {Platform.OS === 'web' && download && <a href={download.url} download={download.name} style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>Save encrypted backup</a>}
    </View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Restore a backup</Text><Text style={s.note}>Choose a .gasbackup file. You can inspect it before replacing this installation’s records. Close other GasFinder browser tabs first.</Text>
      <Pressable accessibilityRole="button" disabled={busy} style={s.choice} onPress={() => void run(async () => { const text = await pickBackupText(); if (text) { setFile(text); setPreview(null); setRestorePassword(''); } })}><Text style={s.choiceText}>{file ? 'Choose a different backup' : 'Choose backup file'}</Text></Pressable>
      {file && !preview && <><TextInput accessibilityLabel="Restore password" placeholder="Backup password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={restorePassword} onChangeText={setRestorePassword} style={s.input} editable={!busy} /><Pressable accessibilityRole="button" disabled={busy || !restorePassword} style={s.button} onPress={() => void run(async () => { setPreview(await inspectBackup(file, restorePassword)); setRestorePassword(''); setFile(null); })}><Text style={s.buttonText}>Inspect backup</Text></Pressable></>}
      {preview && summary && <><Text style={s.body}>Saved {new Date(preview.createdAt).toLocaleString()}{'\n'}{summary.transactions} bank transactions · {summary.purchases} purchases{'\n'}{summary.subscriptions} subscriptions · {formatMoney(summary.reservedCents)} set aside{'\n'}{preview.archives.length} imports · {preview.attachments.length} attached files · {preview.attachmentScope ?? (preview.includesFiles ? 'all' : 'none')} attachment scope</Text><Text style={s.danger}>Restore replaces your current records and preferences and discards unfinished local drafts. A local recovery copy will allow you to undo this restore. Keep a separate encrypted backup too.</Text><Text style={s.note}>Phone permissions stay controlled by this device. Reminders will be checked again. Device lock preferences are kept on this installation.</Text><Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={() => void run(async () => { await restoreBackup(preview); setPreview(null); setCanUndo(true); setMessage('Restore complete. Review Account and reminder status in Settings.'); })}><Text style={s.buttonText}>Replace data with this backup</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} style={s.choice} onPress={() => setPreview(null)}><Text style={s.choiceText}>Cancel restore</Text></Pressable></>}
    </View>
    {canUndo && <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Recovery copy</Text><Text style={s.note}>Undo returns to the records saved immediately before your last restore or account reset. Changes since that replacement will be replaced.</Text>{undoConfirm ? <><Text style={s.danger}>Return to the previous records?</Text><Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={() => void run(async () => { await undoRestore(); setCanUndo(false); setUndoConfirm(false); setMessage('Previous records recovered.'); })}><Text style={s.buttonText}>Confirm Undo</Text></Pressable><Pressable accessibilityRole="button" style={s.choice} onPress={() => setUndoConfirm(false)}><Text style={s.choiceText}>Keep current records</Text></Pressable></> : <Pressable accessibilityRole="button" style={s.choice} onPress={() => setUndoConfirm(true)}><Text style={s.choiceText}>Undo last data replacement</Text></Pressable>}</View>}
    <EraseDataPanel disabled={busy} />
    {busy && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
  </FormScrollView></SafeAreaView>;
}
