import { useThemeRevision } from '@/theme';
import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { dataStyles as s } from './styles';
import { eraseAllAppRecords } from './backupService';
import { useDataStatus } from './operationStatus';

export default function EraseDataPanel({ disabled = false }: { disabled?: boolean }) {
  useThemeRevision();
  const [open, setOpen] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState(''), [finalReview, setFinalReview] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false);
  const { busy: maintenance } = useDataStatus();
  const blocked = disabled || busy || maintenance;
  const ready = acknowledged && confirmation === 'ERASE ALL DATA';
  function cancel() {
    setOpen(false); setAcknowledged(false); setConfirmation(''); setFinalReview(false); setError('');
  }
  async function erase() {
    if (!ready || !finalReview || blocked || running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await eraseAllAppRecords(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not finish erasing app data.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <View style={s.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.choice} disabled={blocked} onPress={() => open ? cancel() : setOpen(true)}>
      <Text style={s.danger}>Wipe all app data {open ? '⌄' : '›'}</Text>
    </Pressable>
    {open && <>
      <Text style={s.danger}>This permanently deletes transactions, balances, goals, subscriptions, cars, reports, app preferences, saved PDFs and CSVs, receipt photos, and local recovery copies. Duplicate protection resets. There is no Undo.</Text>
      <Text style={s.note}>Files in your own Files/iCloud folders and exported backups are not deleted. Device privacy lock preferences remain.</Text>
      {!finalReview ? <>
        <Link href="/backup" asChild><Pressable accessibilityRole="button" disabled={blocked} style={s.choice}><Text style={s.choiceText}>Save an encrypted backup first ›</Text></Pressable></Link>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acknowledged }} aria-checked={acknowledged} disabled={blocked} style={[s.choice, acknowledged && s.selected]} onPress={() => setAcknowledged(!acknowledged)}>
          <Text style={s.choiceText}>{acknowledged ? '✓ ' : ''}I understand this is permanent and I have saved anything I want to keep.</Text>
        </Pressable>
        <Text style={s.body}>Type ERASE ALL DATA to continue.</Text>
        <TextInput accessibilityLabel="Confirm permanent data erasure" placeholder="ERASE ALL DATA" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!blocked} style={s.input} />
        <Pressable accessibilityRole="button" disabled={blocked || !ready} style={[s.button, (blocked || !ready) && s.disabled]} onPress={() => { if (ready && !blocked) setFinalReview(true); }}><Text style={s.buttonText}>Continue to final confirmation</Text></Pressable>
      </> : <>
        <Text accessibilityRole="header" style={s.heading}>Final confirmation</Text>
        <Text style={s.danger}>Permanently erase all Centsward data on this installation now? This also removes the local recovery copies.</Text>
        <Pressable accessibilityRole="button" disabled={blocked || !ready} style={[s.button, (blocked || !ready) && s.disabled]} onPress={() => void erase()}><Text style={s.buttonText}>{busy ? 'Erasing app data…' : 'Yes, permanently erase all app data'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={blocked} style={s.choice} onPress={() => setFinalReview(false)}><Text style={s.choiceText}>Go back</Text></Pressable>
      </>}
      <Pressable accessibilityRole="button" disabled={blocked} style={s.choice} onPress={cancel}><Text style={s.choiceText}>Cancel — keep my data</Text></Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}
  </View>;
}
