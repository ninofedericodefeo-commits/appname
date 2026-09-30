import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { progressPercent, suggestAmounts, validDeadline } from '@/features/goals/logic';
import type { Goal, GoalKind, LoggedPurchase } from '@/features/goals/logic';
import { parseDollars } from '@/features/pocket/logic';
import { usePocketStore } from '@/stores/pocketStore';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Action({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]}>
    <Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text>
  </Pressable>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
  </Pressable>;
}

function GoalEditor({ goal, reservedCents, onSave, onCancel }: {
  goal: Goal | null;
  reservedCents: number;
  onSave: (input: { title: string; kind: GoalKind; targetCents: number; deadline: string | null }, assignAll: boolean) => boolean;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'item');
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : '');
  const [timed, setTimed] = useState(!!goal?.deadline);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [assignAll, setAssignAll] = useState(false);
  const [error, setError] = useState('');

  function save() {
    const targetCents = parseDollars(target);
    if (!title.trim() || title.trim().length > 80) { setError('Enter a title up to 80 characters.'); return; }
    if (targetCents === null || targetCents <= 0) { setError('Enter a target greater than $0.'); return; }
    if (timed && !validDeadline(deadline)) { setError('Enter a future date as YYYY-MM-DD.'); return; }
    if (!onSave({ title, kind, targetCents, deadline: timed ? deadline : null }, assignAll)) {
      setError('Could not save this goal. Please try again.');
      return;
    }
    setError('');
  }

  return <View style={styles.card}>
    <Text style={styles.section}>{goal ? 'Edit goal' : 'Set your goal'}</Text>
    <Text style={styles.label}>Title</Text>
    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What are you saving for?" maxLength={80} accessibilityLabel="Goal title" />
    <Text style={styles.label}>Goal type</Text>
    <View style={styles.row}><Choice label="An item" selected={kind === 'item'} onPress={() => setKind('item')} /><Choice label="Money" selected={kind === 'money'} onPress={() => setKind('money')} /></View>
    <Text style={styles.label}>Target amount</Text>
    <TextInput style={styles.input} value={target} onChangeText={setTarget} placeholder="500.00" keyboardType="decimal-pad" accessibilityLabel="Goal target amount" />
    <Text style={styles.label}>Timing</Text>
    <View style={styles.row}><Choice label="Untimed" selected={!timed} onPress={() => setTimed(false)} /><Choice label="Timed" selected={timed} onPress={() => setTimed(true)} /></View>
    {timed && <><Text style={styles.label}>Target date</Text><TextInput style={styles.input} value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" maxLength={10} accessibilityLabel="Goal target date, year month day" /><Text style={styles.hint}>Choose a future calendar date.</Text></>}
    {!goal && reservedCents > 0 && <><Text style={styles.label}>Existing pocket money</Text><Text style={styles.hint}>Your pocket already has {money(reservedCents)} earmarked. Assigning it changes goal progress, not the pocket total.</Text><View style={styles.row}><Choice label="Assign none" selected={!assignAll} onPress={() => setAssignAll(false)} /><Choice label="Assign all" selected={assignAll} onPress={() => setAssignAll(true)} /></View></>}
    <Text style={styles.hint}>Money stays in your existing account. This app cannot verify your balance, transfer funds, or buy stocks.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.row}><Action label={goal ? 'Save goal' : 'Create goal'} onPress={save} />{onCancel && <Action label="Cancel" secondary onPress={onCancel} />}</View>
  </View>;
}

function SettingsPanel({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { goalSettings, updateGoalSettings, updateGoal, endGoal } = usePocketStore();
  const [maxAmount, setMaxAmount] = useState((goalSettings.maxSuggestionCents / 100).toFixed(2));
  const [maxPercent, setMaxPercent] = useState(String(goalSettings.maxPurchasePercent));
  const [editingGoal, setEditingGoal] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [message, setMessage] = useState('');

  function saveCaps() {
    const cents = parseDollars(maxAmount);
    const percent = Number(maxPercent);
    if (cents === null || percent < 0 || percent > 100 || !Number.isFinite(percent) || !maxPercent.trim()) {
      setMessage('Enter a valid dollar cap and a percent from 0 to 100.');
      return;
    }
    updateGoalSettings({ maxSuggestionCents: cents, maxPurchasePercent: percent });
    setMessage('Suggestion limits saved.');
  }

  return <View style={styles.settingsGroup}>
    <View style={styles.card}>
      <View style={styles.rowBetween}><Text style={styles.section}>Goal settings</Text><Action label="Close" secondary onPress={onClose} /></View>
      {goal && <View style={styles.row}><Action label="Edit goal" secondary onPress={() => setEditingGoal(!editingGoal)} /><Action label="End goal" secondary onPress={() => setConfirmEnd(true)} /></View>}
      {confirmEnd && <View style={styles.warning}><Text style={styles.section}>End this goal?</Text><Text style={styles.hint}>Its progress will be saved in history. Money remains earmarked in the pocket and becomes available to assign to your next goal.</Text><View style={styles.row}><Action label="End goal" onPress={() => { endGoal(); setConfirmEnd(false); onClose(); }} /><Action label="Keep goal" secondary onPress={() => setConfirmEnd(false)} /></View></View>}
      <Text style={styles.label}>Savings suggestions</Text>
      <View style={styles.row}><Choice label="On" selected={goalSettings.suggestionsEnabled} onPress={() => updateGoalSettings({ suggestionsEnabled: true })} /><Choice label="Off" selected={!goalSettings.suggestionsEnabled} onPress={() => updateGoalSettings({ suggestionsEnabled: false })} /></View>
      <Text style={styles.label}>Maximum suggested per purchase ($)</Text>
      <TextInput style={styles.input} value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" accessibilityLabel="Maximum suggested dollars per purchase" />
      <Text style={styles.label}>Maximum percent of a purchase</Text>
      <TextInput style={styles.input} value={maxPercent} onChangeText={setMaxPercent} keyboardType="decimal-pad" accessibilityLabel="Maximum percent of a purchase" />
      <Action label="Save suggestion limits" onPress={saveCaps} />
      <Text style={styles.label}>iPhone goal widget</Text>
      <View style={styles.row}><Choice label="Off" selected={!goalSettings.widgetEnabled} onPress={() => updateGoalSettings({ widgetEnabled: false })} /><Choice label="On" selected={goalSettings.widgetEnabled} onPress={() => updateGoalSettings({ widgetEnabled: true })} /></View>
      <Text style={styles.hint}>Add the Savings goal widget from your iPhone widget gallery. It needs an installed development or release build.</Text>
      {goalSettings.widgetEnabled && <><Text style={styles.label}>Widget privacy</Text><View style={styles.row}><Choice label="Percent only" selected={!goalSettings.widgetShowAmounts} onPress={() => updateGoalSettings({ widgetShowAmounts: false })} /><Choice label="Show amounts and title" selected={goalSettings.widgetShowAmounts} onPress={() => updateGoalSettings({ widgetShowAmounts: true })} /></View></>}
      {message ? <Text style={styles.hint}>{message}</Text> : null}
    </View>
    {editingGoal && goal && <GoalEditor key={goal.id} goal={goal} reservedCents={0} onSave={(input) => { const saved = updateGoal(input); if (saved) setEditingGoal(false); return saved; }} onCancel={() => setEditingGoal(false)} />}
  </View>;
}

function PurchaseCard({ purchase, history, goal }: { purchase: LoggedPurchase; history: LoggedPurchase[]; goal: Goal }) {
  const { goalSettings, reserveForGoal, skipPurchase, updatePurchase, removePurchase, reportedBalanceCents, reservedCents } = usePocketStore();
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(purchase.title);
  const [editAmount, setEditAmount] = useState((purchase.amountCents / 100).toFixed(2));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const suggestion = suggestAmounts({ purchase, history, goal, settings: goalSettings });
  const available = reportedBalanceCents === null ? null : reportedBalanceCents - reservedCents;

  function save(cents: number) {
    if (cents <= 0 || !reserveForGoal(cents, purchase.id)) {
      setError('Could not set this amount aside. Check your target and estimated available balance.');
      return;
    }
    setError('');
  }

  return <View style={styles.card}>
    <View style={styles.rowBetween}><Text style={styles.section}>{purchase.title}</Text><Text style={styles.amount}>{money(purchase.amountCents)}</Text></View>
    <Text style={styles.hint}>Logged {new Date(purchase.purchasedAt).toLocaleDateString()} · {purchase.decision === 'saved' ? `${money(purchase.savedCents ?? 0)} set aside` : purchase.decision === 'skipped' ? 'No set-aside' : 'Choose a set-aside amount'}</Text>
    {purchase.decision === 'pending' && <>
      {goalSettings.suggestionsEnabled && suggestion.amounts.length > 0 && <><Text style={styles.label}>Suggested set-aside amounts</Text><View style={styles.row}>{suggestion.amounts.map((amount, index) => <Action key={amount} label={`${['Small', 'Medium', 'Faster'][index] ?? 'Save'} ${money(amount)}`} secondary onPress={() => save(amount)} />)}</View></>}
      {suggestion.sparse && goalSettings.suggestionsEnabled && <Text style={styles.hint}>Starting suggestion: 5% of this purchase. Suggestions will adapt after three logged purchases.</Text>}
      {suggestion.paceLimited && <Text style={styles.hint}>At this limit, the goal may take longer than the target date.</Text>}
      {available !== null && available < 1 && <Text style={styles.hint}>Your entered balance leaves no estimated amount available to set aside. Update it in Savings pocket.</Text>}
      <Text style={styles.label}>Or choose your own amount</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={custom} onChangeText={setCustom} placeholder="2.00" keyboardType="decimal-pad" accessibilityLabel={`Custom set-aside for ${purchase.title}`} /><Action label="Set aside" onPress={() => { const cents = parseDollars(custom); if (cents === null) setError('Enter a valid dollar amount.'); else save(cents); }} /><Action label="Skip" secondary onPress={() => skipPurchase(purchase.id)} /></View>
    </>}
    <View style={styles.row}><Action label={editing ? 'Cancel edit' : 'Edit purchase'} secondary onPress={() => setEditing(!editing)} /><Action label="Delete purchase" secondary onPress={() => setConfirmRemove(true)} /></View>
    {editing && <View><Text style={styles.label}>Purchase title</Text><TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} maxLength={80} accessibilityLabel="Edit purchase title" /><Text style={styles.label}>Actual amount</Text><TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" accessibilityLabel="Edit purchase amount" /><Action label="Save purchase" onPress={() => { const cents = parseDollars(editAmount); if (cents === null || !updatePurchase(purchase.id, editTitle, cents)) setError('Enter a title and an amount greater than $0.'); else { setEditing(false); setError(''); } }} /><Text style={styles.hint}>Editing a purchase never changes money already set aside.</Text></View>}
    {confirmRemove && <View style={styles.warning}><Text style={styles.hint}>Delete this purchase? Any confirmed set-aside stays in your pocket.</Text><View style={styles.row}><Action label="Delete" onPress={() => removePurchase(purchase.id)} /><Action label="Cancel" secondary onPress={() => setConfirmRemove(false)} /></View></View>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

export default function GoalsScreen() {
  const { activeGoal, archivedGoals, purchases, reservedCents, reportedBalanceCents, goalSettings, createGoal, addPurchase, reserveForGoal, releaseFromGoal } = usePocketStore();
  const [showSettings, setShowSettings] = useState(false);
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const purchaseId = useRef(newId());
  const [directAmount, setDirectAmount] = useState('');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [error, setError] = useState('');
  const pending = purchases.find((item) => item.decision === 'pending');
  const remaining = activeGoal ? Math.max(0, activeGoal.targetCents - activeGoal.savedCents) : 0;

  function logPurchase() {
    const cents = parseDollars(purchaseAmount);
    if (!purchaseTitle.trim() || cents === null || cents <= 0) { setError('Enter a purchase name and actual amount greater than $0.'); return; }
    if (!addPurchase(purchaseId.current, purchaseTitle, cents)) { setError('This purchase was already logged or the details are invalid.'); return; }
    purchaseId.current = newId();
    setPurchaseTitle(''); setPurchaseAmount(''); setError('');
  }

  function changeGoalMoney(kind: 'reserve' | 'release') {
    const value = kind === 'reserve' ? directAmount : releaseAmount;
    const cents = parseDollars(value);
    if (cents === null || cents <= 0 || !(kind === 'reserve' ? reserveForGoal(cents) : releaseFromGoal(cents))) {
      setError(kind === 'reserve' ? 'Enter an amount within the remaining goal and your estimated available balance.' : 'Enter an amount no greater than your goal progress.');
      return;
    }
    setDirectAmount(''); setReleaseAmount(''); setError('');
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>Savings goals</Text><Link href="/" asChild><Pressable accessibilityRole="button" style={styles.nav}><Text style={styles.navText}>Gas prices</Text></Pressable></Link></View>
    <Text style={styles.intro}>Build a goal from money you choose to set aside. Purchases and balances are entered by you on this device.</Text>
    <View style={styles.row}><Action label="Settings" secondary onPress={() => setShowSettings(!showSettings)} /><Link href="/pocket" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Savings pocket</Text></Pressable></Link><Link href="/activity" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Activity</Text></Pressable></Link></View>
    {showSettings && <SettingsPanel goal={activeGoal} onClose={() => setShowSettings(false)} />}
    {!activeGoal ? <GoalEditor goal={null} reservedCents={reservedCents} onSave={createGoal} /> : <>
      <View style={styles.hero}><Text style={styles.eyebrow}>{activeGoal.kind === 'money' ? 'MONEY GOAL' : 'ITEM GOAL'} · {activeGoal.deadline ? `BY ${activeGoal.deadline}` : 'NO DEADLINE'}</Text><Text style={styles.heroTitle}>{activeGoal.title}</Text><Text style={styles.heroPercent}>{progressPercent(activeGoal)}%</Text><View style={styles.bar}><View style={[styles.fill, { width: `${progressPercent(activeGoal)}%` }]} /></View><Text style={styles.heroDetail}>{money(activeGoal.savedCents)} set aside of {money(activeGoal.targetCents)} · {money(remaining)} remaining</Text><Text style={styles.heroNote}>{remaining === 0 ? 'You reached your target. You can end this goal in Settings.' : 'Each amount you confirm brings this goal closer.'}</Text></View>
      <View style={styles.card}><Text style={styles.section}>Set money aside</Text><Text style={styles.hint}>This updates your pocket estimate; no money moves between accounts. {reportedBalanceCents === null ? 'Enter your account balance in Savings pocket if you want an available-to-spend estimate.' : `Estimated available before this change: ${money(reportedBalanceCents - reservedCents)}.`}</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={directAmount} onChangeText={setDirectAmount} placeholder="10.00" keyboardType="decimal-pad" accessibilityLabel="Set aside for goal" /><Action label="Set aside" onPress={() => changeGoalMoney('reserve')} disabled={remaining === 0} /></View><Text style={styles.label}>Release from this goal</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={releaseAmount} onChangeText={setReleaseAmount} placeholder="5.00" keyboardType="decimal-pad" accessibilityLabel="Release from goal" /><Action label="Release" secondary onPress={() => changeGoalMoney('release')} disabled={activeGoal.savedCents === 0} /></View></View>
      <View style={styles.card}><Text style={styles.section}>Log a purchase</Text><Text style={styles.hint}>Log an actual purchase to get a savings suggestion. Gas receipts stay separate.</Text><TextInput style={styles.input} value={purchaseTitle} onChangeText={setPurchaseTitle} placeholder="What did you buy?" maxLength={80} accessibilityLabel="Purchase name" /><TextInput style={styles.input} value={purchaseAmount} onChangeText={setPurchaseAmount} placeholder="Actual amount" keyboardType="decimal-pad" accessibilityLabel="Actual purchase amount" /><Action label="Log purchase" onPress={logPurchase} /></View>
      {pending && <Text style={styles.subheading}>Your next savings decision</Text>}
      {pending && <PurchaseCard key={pending.id} purchase={pending} history={purchases} goal={activeGoal} />}
      <Text style={styles.subheading}>Recent purchases</Text>
      {purchases.length === 0 ? <Text style={styles.hint}>Your logged purchases will appear here.</Text> : purchases.filter((item) => item.id !== pending?.id).slice(0, 8).map((item) => <PurchaseCard key={item.id} purchase={item} history={purchases} goal={activeGoal} />)}
      {!goalSettings.suggestionsEnabled && <Text style={styles.hint}>Suggestions are off. You can still set aside an amount after logging a purchase.</Text>}
    </>}
    {archivedGoals.length > 0 && <View style={styles.card}><Text style={styles.section}>Past goals</Text>{archivedGoals.map((goal) => <View key={goal.id} style={styles.historyRow}><Text style={styles.historyName}>{goal.title}</Text><Text style={styles.hint}>{goal.result === 'reached' ? 'Reached' : 'Ended'} · {money(goal.savedCents)} of {money(goal.targetCents)} · {new Date(goal.endedAt).toLocaleDateString()}</Text></View>)}</View>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f5f7' }, content: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, title: { color: '#111827', fontSize: 28, fontWeight: '800', flexShrink: 1 }, intro: { color: '#475569', fontSize: 14, lineHeight: 21 },
  nav: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 11 }, navText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  settingsGroup: { gap: 12 }, section: { color: '#111827', fontSize: 18, fontWeight: '800', flexShrink: 1 }, subheading: { color: '#111827', fontSize: 17, fontWeight: '800' },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginTop: 4 }, hint: { color: '#64748b', fontSize: 12, lineHeight: 18 }, error: { color: '#b91c1c', fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#fff' }, shortInput: { minWidth: 100, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { backgroundColor: '#047857', borderRadius: 10, minHeight: 44, paddingHorizontal: 13, paddingVertical: 12, justifyContent: 'center' }, actionSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' }, actionText: { color: '#fff', fontWeight: '800', fontSize: 13 }, actionSecondaryText: { color: '#0f172a' }, disabled: { opacity: 0.45 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 13, paddingVertical: 10 }, choiceSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' }, choiceText: { color: '#334155', fontWeight: '700' }, choiceTextSelected: { color: '#fff' },
  link: { borderRadius: 10, backgroundColor: '#e2e8f0', minHeight: 44, paddingHorizontal: 13, paddingVertical: 12 }, linkText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  hero: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 20, padding: 18, gap: 8 }, eyebrow: { color: '#047857', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }, heroTitle: { color: '#064e3b', fontSize: 22, fontWeight: '800' }, heroPercent: { color: '#064e3b', fontSize: 38, fontWeight: '800' }, heroDetail: { color: '#065f46', fontSize: 14, fontWeight: '700' }, heroNote: { color: '#047857', fontSize: 12 }, bar: { height: 12, backgroundColor: '#d1fae5', borderRadius: 10, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: '#059669' },
  amount: { color: '#111827', fontSize: 16, fontWeight: '800' }, warning: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, gap: 8 }, historyRow: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 9 }, historyName: { fontSize: 14, color: '#111827', fontWeight: '700' },
});
