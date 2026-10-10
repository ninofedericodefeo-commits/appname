import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/FormScrollView';
import { amazonProductDraft, parseAmazonLink } from '@/features/goals/amazonLink';
import type { AmazonProductDraft } from '@/features/goals/amazonLink';
import GoalEditor from '@/features/goals/GoalEditor';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export default function AmazonGoalScreen() {
  const { activeGoal, reservedCents, createGoal, updateGoal, endGoal } = usePocketStore();
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [link, setLink] = useState('');
  const [draft, setDraft] = useState<AmazonProductDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  function review(text: string) {
    const parsed = parseAmazonLink(text);
    if (!parsed.value) { setError(parsed.error); setDraft(null); return; }
    setDraft(amazonProductDraft(parsed.value)); setError(''); Keyboard.dismiss();
  }

  async function paste() {
    const current = ++request.current;
    setBusy(true); setError('');
    try {
      const text = await Clipboard.getStringAsync();
      if (current !== request.current) return;
      setLink(text.slice(0, 2048));
      review(text);
    } catch {
      if (current === request.current) setError('Could not read the clipboard. Paste your Amazon link into the field instead.');
    } finally {
      if (current === request.current) setBusy(false);
    }
  }

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>SAVINGS GOALS</Text>
      <Text style={styles.title}>Goal from link</Text>
      <Text style={styles.body}>Save toward something you found on Amazon.</Text>
      {!ready ? <View style={styles.row}><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Loading your goals…</Text></View> : activeGoal ? <>
        <View style={styles.card}>
          <Text style={styles.heading}>You have an active goal</Text>
          <Text style={styles.body}>{activeGoal.title} · {formatMoney(activeGoal.savedCents)} saved</Text>
          <Text style={styles.hint}>Edit it, or finish and archive it before creating a product goal.</Text>
          <View style={styles.row}>
            <Button label="Edit current goal" secondary onPress={() => { setEditingCurrent(true); setConfirmArchive(false); }} />
            <Button label="Finish and archive" onPress={() => { setConfirmArchive(true); setEditingCurrent(false); }} />
          </View>
          {confirmArchive && <View style={styles.warning}>
            <Text style={styles.heading}>Finish {activeGoal.title}?</Text>
            <Text style={styles.hint}>Its progress will stay in Activity. Its {formatMoney(activeGoal.savedCents)} stays in your pocket, ready to assign to a new goal.</Text>
            <View style={styles.row}><Button label="Confirm archive" onPress={() => { endGoal(); setConfirmArchive(false); }} /><Button label="Keep current goal" secondary onPress={() => setConfirmArchive(false)} /></View>
          </View>}
        </View>
        {editingCurrent && <GoalEditor key={activeGoal.id} goal={activeGoal} reservedCents={0} onCancel={() => setEditingCurrent(false)} onSave={(input) => {
          const saved = updateGoal(input);
          if (saved) { Keyboard.dismiss(); router.navigate('/investment'); }
          return saved;
        }} />}
      </> : <>
        {!draft ? <View style={styles.card}>
          <Text style={styles.heading}>Paste an Amazon product link</Text>
          <TextInput accessibilityLabel="Amazon product link" value={link} onChangeText={(text) => { request.current++; setBusy(false); setLink(text); setError(''); }} style={styles.input} placeholder="https://www.amazon.com/dp/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} onSubmitEditing={() => review(link)} />
          <View style={styles.row}><Button label={busy ? 'Reading clipboard…' : 'Paste link'} secondary disabled={busy} onPress={() => void paste()} /><Button label="Review link" disabled={busy} onPress={() => review(link)} /></View>
          <Text style={styles.hint}>Supports amazon.com products and a.co short links. Clipboard access happens only when you tap Paste link.</Text>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        </View> : <>
          <View style={styles.notice}>
            <Text style={styles.heading}>Add the details you see on Amazon</Text>
            <Text style={styles.hint}>{draft.asin ? 'Your product link is ready.' : 'Your short link is saved. Open it on Amazon to check the item and currency.'} Product names and prices are entered by you. USD only.</Text>
            <Button label="Change link" secondary onPress={() => { setDraft(null); setError(''); }} />
          </View>
          <GoalEditor key={draft.sourceUrl} goal={null} draft={draft} reservedCents={reservedCents} onCancel={() => { Keyboard.dismiss(); router.navigate('/investment'); }} onSave={(input, assignAll) => {
            if (!ready) return false;
            const saved = createGoal(input, assignAll);
            if (saved) { Keyboard.dismiss(); router.navigate('/investment'); }
            return saved;
          }} />
        </>}
      </>}
      <Button label="Back to Goals" secondary onPress={() => { Keyboard.dismiss(); router.navigate('/investment'); }} />
    </FormScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 16 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -1 },
  heading: { color: colors.ink, fontSize: 19, lineHeight: 26, fontWeight: '800' }, body: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 }, hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 18, gap: 12 }, notice: { backgroundColor: colors.paleGreen, borderRadius: 9, padding: 18, gap: 12 }, warning: { backgroundColor: colors.paleOrange, borderRadius: 8, padding: 14, gap: 12 },
  input: { backgroundColor: colors.surface, color: colors.ink, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, minHeight: 48, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, button: { backgroundColor: colors.accentDark, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 13, minHeight: 46, justifyContent: 'center', alignSelf: 'flex-start' }, buttonText: { color: colors.surface, fontWeight: '800', fontSize: 13 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong }, secondaryText: { color: colors.ink }, disabled: { opacity: 0.45 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
