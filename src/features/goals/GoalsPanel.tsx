import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState, useSyncExternalStore } from 'react';
import { Link, router } from 'expo-router';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { IconButton } from '@/components/IconButton';
import GoalEditor from './GoalEditor';
import GoalProgressCard from './GoalProgressCard';
import SavingsAdjustmentSheet from './SavingsAdjustmentSheet';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import type { Goal } from './logic';
import { formatMoney } from '@/lib/money';
import { usePocketStore } from '@/stores/pocketStore';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { SampleGoalPreview } from '@/features/samples/SamplePreviews';
import { useSampleDataStore } from '@/features/samples/store';

function GoalActions({ goal }: { goal: Goal }) {
  useThemeRevision();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [error, setError] = useState('');
  function finish() {
    const live = usePocketStore.getState();
    if (live.activeGoal?.id !== goal.id) return setError('This goal changed. Close these actions and try again.');
    if (confirm === 'archive') live.endGoal(); else if (confirm === 'delete') live.deleteGoal();
  }
  return <View style={styles.menu}>
    <SubscriptionButton label={open ? 'Close goal actions' : 'Goal actions'} accessibilityState={{ expanded: open }} onPress={() => { Keyboard.dismiss(); setOpen(!open); setConfirm(null); }} />
    {open && <View style={styles.card}>
      {confirm ? <><Text style={styles.section}>{confirm === 'archive' ? 'Finish and archive this goal?' : 'Delete this goal?'}</Text>
        <Text style={styles.note}>{confirm === 'archive' ? 'Its progress stays in Past goals.' : 'Its details will be removed.'} {formatMoney(goal.savedCents)} stays set aside as unassigned savings.</Text>
        <View style={styles.row}><SubscriptionButton label="Keep goal" grow onPress={() => setConfirm(null)} /><SubscriptionButton label={confirm === 'archive' ? 'Archive goal' : 'Delete goal'} tone={confirm === 'archive' ? 'primary' : 'danger'} grow onPress={finish} /></View>
      </> : <><SubscriptionButton label="Finish and archive goal" onPress={() => setConfirm('archive')} /><SubscriptionButton label="Delete goal" tone="danger" onPress={() => setConfirm('delete')} /></>}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </View>}
  </View>;
}

export default function GoalsPanel() {
  useThemeRevision();
  const samplesVisible = useSampleDataStore(state => state.visible);
  const { activeGoal, reservedCents, createGoal, updateGoal } = usePocketStore();
  const ready = useSyncExternalStore(usePocketStore.persist.onFinishHydration, usePocketStore.persist.hasHydrated, () => false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<'add' | 'lower' | null>(null);
  function closeEditor() { Keyboard.dismiss(); setEditingId(null); }
  const editing = !!activeGoal && editingId === activeGoal.id;
  return <View style={styles.content}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Goals</Text><IconButton icon="activity" label="View transactions" onPress={() => router.push('/account-transactions')} /></View>
    <Text style={styles.intro}>Your savings stay in your bank account.</Text>
    <SampleDataControl compact />
    <Link href="/amazon-goal" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Goal from Amazon link ↗</Text></Pressable></Link>
    {activeGoal ? <>
      <GoalProgressCard key={activeGoal.id} goal={activeGoal} editing={editing} onEdit={() => editing ? closeEditor() : setEditingId(activeGoal.id)} />
      <View style={styles.row}><SubscriptionButton label="Add money" tone="primary" grow disabled={!ready || activeGoal.savedCents >= activeGoal.targetCents} onPress={() => { Keyboard.dismiss(); setAdjustment('add'); }} /><SubscriptionButton label="Adjust savings" grow disabled={!ready} onPress={() => { Keyboard.dismiss(); setAdjustment('lower'); }} /></View>
      {editing && <GoalEditor key={`edit-${activeGoal.id}`} goal={activeGoal} reservedCents={0} onSave={input => {
        if (usePocketStore.getState().activeGoal?.id !== activeGoal.id) return false;
        const saved = updateGoal(input); if (saved) closeEditor(); return saved;
      }} onCancel={closeEditor} />}
      <GoalActions key={`actions-${activeGoal.id}`} goal={activeGoal} />
      <Link href="/purchase-automation" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Connect Apple Pay purchases ↗</Text><Text style={styles.note}>Install the logging shortcut, then choose your card in Shortcuts.</Text></Pressable></Link>
    </> : creating ? <GoalEditor goal={null} reservedCents={reservedCents} onSave={(input, assignAll) => { const saved = createGoal(input, assignAll); if (saved) setCreating(false); return saved; }} onCancel={() => { Keyboard.dismiss(); setCreating(false); }} />
      : <View style={styles.card}><Text style={styles.section}>Start a savings goal</Text><Text style={styles.note}>Choose a target and a rule you can edit any time.</Text><SubscriptionButton label="Set a goal" tone="primary" disabled={!ready} onPress={() => setCreating(true)} /></View>}
    {samplesVisible && <SampleGoalPreview />}
    {adjustment && <SavingsAdjustmentSheet initialDestination="goal" initialAction={adjustment} onClose={() => setAdjustment(null)} />}
  </View>;
}
const styles = themedStyles(() => ({ content: { gap: 16 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, title: { color: colors.ink, fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: -0.8 }, intro: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  row: { flexWrap: 'wrap', flexDirection: 'row', gap: 8 }, card: { padding: 20, gap: 14, backgroundColor: colors.surface, borderRadius: 20 }, section: { color: colors.ink, fontSize: 22, fontWeight: '600' }, note: { color: colors.muted, fontSize: 14, lineHeight: 21 }, error: { color: colors.danger, fontSize: 13 }, menu: { gap: 10, marginTop: 2 }, link: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', gap: 5 }, linkText: { color: colors.primary, fontSize: 15, fontWeight: '600' } }));
