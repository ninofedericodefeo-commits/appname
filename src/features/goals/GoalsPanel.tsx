import { FormScrollView as ScrollView } from '@/components/FormScrollView';
import { colors } from '@/theme';
import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CalendarDateField, localDateKey } from '@/components/CalendarDateField';
import { DEFAULT_SET_ASIDE_RULE, progressPercent, ruleDescription, suggestAmounts, validDeadline } from '@/features/goals/logic';
import { goalWidgetAvailable } from '@/features/goals/widget';
import type { Goal, GoalKind, LoggedPurchase, SetAsideRule } from '@/features/goals/logic';
import { parseDollars } from '@/features/pocket/logic';
import { usePocketStore } from '@/stores/pocketStore';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tomorrowKey = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDateKey(date); };

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

function GoalEditor({ goal, reservedCents, onSave, onCancel, onLowerPocket }: {
  goal: Goal | null;
  reservedCents: number;
  onSave: (input: { title: string; kind: GoalKind; targetCents: number; deadline: string | null; setAsideRule: SetAsideRule }, assignAll: boolean) => boolean;
  onCancel?: () => void;
  onLowerPocket?: (cents: number) => boolean;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const kind: GoalKind = goal?.kind ?? 'money';
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : '');
  const [timed, setTimed] = useState(!!goal?.deadline);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [assignAll, setAssignAll] = useState(false);
  const currentRule = goal?.setAsideRule ?? DEFAULT_SET_ASIDE_RULE;
  const [ruleMode, setRuleMode] = useState<SetAsideRule['mode']>(currentRule.mode);
  const [fixedAmount, setFixedAmount] = useState(currentRule.mode === 'fixed' ? (currentRule.cents / 100).toFixed(2) : '1.00');
  const [percentAmount, setPercentAmount] = useState(currentRule.mode === 'percent' ? String(currentRule.percent) : '5');
  const [roundIncrement, setRoundIncrement] = useState(currentRule.mode === 'round' ? currentRule.incrementCents : 100);
  const [lowerAmount, setLowerAmount] = useState('');
  const [error, setError] = useState('');

  function save() {
    const targetCents = parseDollars(target);
    if (!title.trim() || title.trim().length > 80) { setError('Enter a title up to 80 characters.'); return; }
    if (targetCents === null || targetCents <= 0) { setError('Enter a target greater than $0.'); return; }
    if (timed && deadline !== goal?.deadline && !validDeadline(deadline)) { setError('Choose a future date from the calendar.'); return; }
    const fixedCents = parseDollars(fixedAmount);
    const percent = Number(percentAmount);
    if (ruleMode === 'fixed' && (fixedCents === null || fixedCents <= 0)) { setError('Enter a fixed amount greater than $0.'); return; }
    if (ruleMode === 'percent' && (!percentAmount.trim() || !Number.isFinite(percent) || percent <= 0 || percent > 100)) { setError('Enter a percent above 0 and no greater than 100.'); return; }
    const setAsideRule: SetAsideRule = ruleMode === 'fixed' ? { mode: 'fixed', cents: fixedCents! } : ruleMode === 'percent' ? { mode: 'percent', percent } : { mode: 'round', incrementCents: roundIncrement };
    if (!onSave({ title, kind, targetCents, deadline: timed ? deadline : null, setAsideRule }, assignAll)) {
      setError('Could not save this goal. Please try again.');
      return;
    }
    setError('');
  }

  function lowerPocket() {
    const cents = parseDollars(lowerAmount);
    if (!onLowerPocket || cents === null || cents <= 0 || !onLowerPocket(cents)) { setError('Enter an amount no greater than the money assigned to this goal.'); return; }
    setLowerAmount('');
    setError('');
  }

  return <View style={styles.card}>
    <Text style={styles.section}>{goal ? 'Edit goal' : 'Set your goal'}</Text>
    <Text style={styles.label}>Title</Text>
    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What are you saving for?" maxLength={80} accessibilityLabel="Goal title" />
    <Text style={styles.label}>Target amount</Text>
    <TextInput style={styles.input} value={target} onChangeText={setTarget} placeholder="500.00" keyboardType="decimal-pad" accessibilityLabel="Goal target amount" />
    <Text style={styles.label}>Set aside after each purchase</Text>
    <View style={styles.row}><Choice label="Fixed amount" selected={ruleMode === 'fixed'} onPress={() => setRuleMode('fixed')} /><Choice label="Percent" selected={ruleMode === 'percent'} onPress={() => setRuleMode('percent')} /><Choice label="Round up" selected={ruleMode === 'round'} onPress={() => setRuleMode('round')} /></View>
    {ruleMode === 'fixed' && <TextInput style={styles.input} value={fixedAmount} onChangeText={setFixedAmount} placeholder="1.00" keyboardType="decimal-pad" accessibilityLabel="Fixed dollars per purchase" />}
    {ruleMode === 'percent' && <TextInput style={styles.input} value={percentAmount} onChangeText={setPercentAmount} placeholder="5" keyboardType="decimal-pad" accessibilityLabel="Percent of each purchase" />}
    {ruleMode === 'round' && <View style={styles.row}>{[100, 500, 1000].map((increment) => <Choice key={increment} label={`Next $${increment / 100}`} selected={roundIncrement === increment} onPress={() => setRoundIncrement(increment)} />)}</View>}
    <Text style={styles.hint}>This rule updates your pocket estimate when a purchase is logged. You can edit it whenever you want.</Text>
    <Text style={styles.label}>Timing</Text>
    <View style={styles.row}><Choice label="Untimed" selected={!timed} onPress={() => setTimed(false)} /><Choice label="Timed" selected={timed} onPress={() => setTimed(true)} /></View>
    {timed && <><Text style={styles.label}>Target date</Text><CalendarDateField label="Goal target date" value={deadline} onChange={setDeadline} minimumDate={tomorrowKey()} /><Text style={styles.hint}>Choose a future calendar date.</Text></>}
    {!goal && reservedCents > 0 && <><Text style={styles.label}>Existing pocket money</Text><Text style={styles.hint}>Your pocket already has {money(reservedCents)} earmarked. Assigning it changes goal progress, not the pocket total.</Text><View style={styles.row}><Choice label="Assign none" selected={!assignAll} onPress={() => setAssignAll(false)} /><Choice label="Assign all" selected={assignAll} onPress={() => setAssignAll(true)} /></View></>}
    {goal && onLowerPocket && <View style={styles.warning}><Text style={styles.section}>Lower pocket for this goal</Text><Text style={styles.hint}>Currently assigned: {money(goal.savedCents)}. Lowering it also lowers goal progress. No money moves in your account.</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={lowerAmount} onChangeText={setLowerAmount} placeholder="Amount to remove" keyboardType="decimal-pad" accessibilityLabel="Lower goal pocket by" /><Action label="Lower pocket" secondary onPress={lowerPocket} disabled={goal.savedCents === 0} /></View></View>}
    <Text style={styles.hint}>Money stays in your existing account. This app cannot verify your balance, transfer funds, or buy stocks.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.row}><Action label={goal ? 'Save goal' : 'Create goal'} onPress={save} />{onCancel && <Action label="Cancel" secondary onPress={onCancel} />}</View>
  </View>;
}

function SettingsPanel({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { goalSettings, updateGoalSettings, endGoal } = usePocketStore();
  const [maxAmount, setMaxAmount] = useState((goalSettings.maxSuggestionCents / 100).toFixed(2));
  const [maxPercent, setMaxPercent] = useState(String(goalSettings.maxPurchasePercent));
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
      {goal && <View style={styles.row}><Action label="Finish and archive goal" secondary onPress={() => setConfirmEnd(true)} /></View>}
      {confirmEnd && <View style={styles.warning}><Text style={styles.section}>End this goal?</Text><Text style={styles.hint}>Its progress will be saved in history. Money remains earmarked in the pocket and becomes available to assign to your next goal.</Text><View style={styles.row}><Action label="End goal" onPress={() => { endGoal(); setConfirmEnd(false); onClose(); }} /><Action label="Keep goal" secondary onPress={() => setConfirmEnd(false)} /></View></View>}
      <Text style={styles.label}>Savings suggestions</Text>
      <View style={styles.row}><Choice label="On" selected={goalSettings.suggestionsEnabled} onPress={() => updateGoalSettings({ suggestionsEnabled: true })} /><Choice label="Off" selected={!goalSettings.suggestionsEnabled} onPress={() => updateGoalSettings({ suggestionsEnabled: false })} /></View>
      <Text style={styles.label}>Maximum suggested per purchase ($)</Text>
      <TextInput style={styles.input} value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" accessibilityLabel="Maximum suggested dollars per purchase" />
      <Text style={styles.label}>Maximum percent of a purchase</Text>
      <TextInput style={styles.input} value={maxPercent} onChangeText={setMaxPercent} keyboardType="decimal-pad" accessibilityLabel="Maximum percent of a purchase" />
      <Action label="Save suggestion limits" onPress={saveCaps} />
      <Text style={styles.label}>iPhone goal widget</Text>
      {goalWidgetAvailable ? <>
        <View style={styles.row}><Choice label="Off" selected={!goalSettings.widgetEnabled} onPress={() => updateGoalSettings({ widgetEnabled: false })} /><Choice label="On" selected={goalSettings.widgetEnabled} onPress={() => updateGoalSettings({ widgetEnabled: true })} /></View>
        <Text style={styles.hint}>Add the Savings goal widget from your iPhone widget gallery.</Text>
        {goalSettings.widgetEnabled && <><Text style={styles.label}>Widget privacy</Text><View style={styles.row}><Choice label="Percent only" selected={!goalSettings.widgetShowAmounts} onPress={() => updateGoalSettings({ widgetShowAmounts: false })} /><Choice label="Show amounts and title" selected={goalSettings.widgetShowAmounts} onPress={() => updateGoalSettings({ widgetShowAmounts: true })} /></View></>}
      </> : <Text style={styles.hint}>The widget needs App Groups, which this free Apple Personal Team build cannot use. Goal progress is still available in the app.</Text>}
      {message ? <Text style={styles.hint}>{message}</Text> : null}
    </View>
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
    <Text style={styles.hint}>{purchase.source === 'shortcut' ? 'Apple Pay Shortcut' : 'Logged'} · {new Date(purchase.purchasedAt).toLocaleDateString()} · {purchase.decision === 'saved' ? `${money(purchase.savedCents ?? 0)} set aside by your rule` : purchase.decision === 'skipped' ? 'No set-aside' : 'Choose a set-aside amount'}</Text>
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

export default function GoalsPanel() {
  const { activeGoal, archivedGoals, purchases, reservedCents, reportedBalanceCents, goalSettings, createGoal, updateGoal, deleteGoal, addPurchase, reserveForGoal, releaseFromGoal } = usePocketStore();
  const [showSettings, setShowSettings] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const purchaseId = useRef(newId());
  const [directAmount, setDirectAmount] = useState('');
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

  function changeGoalMoney() {
    const cents = parseDollars(directAmount);
    if (cents === null || cents <= 0 || !reserveForGoal(cents)) {
      setError('Enter an amount within the remaining goal and your estimated available balance.');
      return;
    }
    setDirectAmount(''); setError('');
  }

  return <View style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>Savings goals</Text><Action label="Settings" secondary onPress={() => setShowSettings(!showSettings)} /></View>
    <Text style={styles.intro}>Choose a rule for each purchase. Your pocket is an on-device estimate; money stays in your account.</Text>
    {showSettings && <SettingsPanel goal={activeGoal} onClose={() => setShowSettings(false)} />}
    {!activeGoal ? <GoalEditor goal={null} reservedCents={reservedCents} onSave={createGoal} /> : <>
      <View style={styles.hero}><Text style={styles.eyebrow}>{activeGoal.deadline ? `BY ${new Date(`${activeGoal.deadline}T12:00:00`).toLocaleDateString()}` : 'NO DEADLINE'}</Text><Text style={styles.heroTitle}>{activeGoal.title}</Text><Text style={styles.heroPercent}>{progressPercent(activeGoal)}%</Text><View style={styles.bar}><View style={[styles.fill, { width: `${progressPercent(activeGoal)}%` }]} /></View><Text style={styles.heroDetail}>{money(activeGoal.savedCents)} set aside of {money(activeGoal.targetCents)} · {money(remaining)} remaining</Text><Text style={styles.heroNote}>Rule: {ruleDescription(activeGoal.setAsideRule ?? DEFAULT_SET_ASIDE_RULE)}. You can edit it any time.</Text><View style={styles.row}><Action label="Edit goal" secondary onPress={() => setEditingGoal(!editingGoal)} /><Action label="Delete goal" secondary onPress={() => setConfirmDelete(true)} /></View></View>
      {editingGoal && <GoalEditor key={activeGoal.id} goal={activeGoal} reservedCents={0} onSave={(input) => { const saved = updateGoal(input); if (saved) setEditingGoal(false); return saved; }} onCancel={() => setEditingGoal(false)} onLowerPocket={releaseFromGoal} />}
      {confirmDelete && <View style={styles.warning}><Text style={styles.section}>Delete this goal?</Text><Text style={styles.hint}>The goal will be removed. Its {money(activeGoal.savedCents)} stays earmarked in your pocket as unassigned money.</Text><View style={styles.row}><Action label="Delete goal" onPress={() => { deleteGoal(); setConfirmDelete(false); setEditingGoal(false); }} /><Action label="Keep goal" secondary onPress={() => setConfirmDelete(false)} /></View></View>}
      <View style={styles.card}><Text style={styles.section}>Set money aside</Text><Text style={styles.hint}>This updates your pocket estimate; no money moves between accounts. {reportedBalanceCents === null ? 'Enter your account balance in Savings pocket if you want an available-to-spend estimate.' : `Estimated available before this change: ${money(reportedBalanceCents - reservedCents)}.`}</Text><View style={styles.row}><TextInput style={[styles.input, styles.shortInput]} value={directAmount} onChangeText={setDirectAmount} placeholder="10.00" keyboardType="decimal-pad" accessibilityLabel="Set aside for goal" /><Action label="Set aside" onPress={changeGoalMoney} disabled={remaining === 0} /></View></View>
      <View style={styles.card}><Text style={styles.section}>Log a purchase</Text><Text style={styles.hint}>Your rule automatically updates this pocket estimate. If it cannot set money aside, you can choose a suggestion. Gas receipts stay separate.</Text><TextInput style={styles.input} value={purchaseTitle} onChangeText={setPurchaseTitle} placeholder="What did you buy?" maxLength={80} accessibilityLabel="Purchase name" /><TextInput style={styles.input} value={purchaseAmount} onChangeText={setPurchaseAmount} placeholder="Actual amount" keyboardType="decimal-pad" accessibilityLabel="Actual purchase amount" /><Action label="Log purchase" onPress={logPurchase} /></View>
      <Link href="/purchase-automation" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Set up Apple Pay purchase logging ↗</Text><Text style={styles.hint}>Optional iPhone Shortcuts automation for in-person card taps.</Text></Pressable></Link>
      {pending && <Text style={styles.subheading}>Your next savings decision</Text>}
      {pending && <PurchaseCard key={pending.id} purchase={pending} history={purchases} goal={activeGoal} />}
      <Text style={styles.subheading}>Recent purchases</Text>
      {purchases.length === 0 ? <Text style={styles.hint}>Your logged purchases will appear here.</Text> : purchases.filter((item) => item.id !== pending?.id).slice(0, 8).map((item) => <PurchaseCard key={item.id} purchase={item} history={purchases} goal={activeGoal} />)}
      {!goalSettings.suggestionsEnabled && <Text style={styles.hint}>Suggestions are off. You can still set aside an amount after logging a purchase.</Text>}
    </>}
    {archivedGoals.length > 0 && <View style={styles.card}><Text style={styles.section}>Past goals</Text>{archivedGoals.map((goal) => <View key={goal.id} style={styles.historyRow}><Text style={styles.historyName}>{goal.title}</Text><Text style={styles.hint}>{goal.result === 'reached' ? 'Reached' : 'Ended'} · {money(goal.savedCents)} of {money(goal.targetCents)} · {new Date(goal.endedAt).toLocaleDateString()}</Text></View>)}</View>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, title: { color: colors.ink, fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1.2, flexShrink: 1 }, intro: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  nav: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 11, minHeight: 44, justifyContent: 'center' }, navText: { color: colors.surface, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 19, gap: 10 },
  settingsGroup: { gap: 12 }, section: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 }, subheading: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 5 },
  label: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 }, hint: { color: colors.muted, fontSize: 13, lineHeight: 19 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.surface }, shortInput: { minWidth: 100, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { backgroundColor: colors.accentDark, borderRadius: 6, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' }, actionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong }, actionText: { color: colors.surface, fontWeight: '800', fontSize: 13 }, actionSecondaryText: { color: colors.ink }, disabled: { opacity: 0.45 },
  choice: { borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: 'center' }, choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceText: { color: colors.inkSoft, fontWeight: '700' }, choiceTextSelected: { color: colors.surface },
  link: { borderRadius: 6, backgroundColor: colors.paleGreen, minHeight: 44, paddingHorizontal: 13, paddingVertical: 12 }, linkText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  hero: { backgroundColor: colors.ink, borderRadius: 13, padding: 22, gap: 10 }, eyebrow: { color: colors.lime, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, heroTitle: { color: colors.surface, fontSize: 22, fontWeight: '800' }, heroPercent: { color: colors.surface, fontSize: 54, lineHeight: 61, letterSpacing: -2, fontWeight: '800', fontVariant: ['tabular-nums'] }, heroDetail: { color: colors.lime, fontSize: 14, fontWeight: '700' }, heroNote: { color: colors.surface, fontSize: 12, lineHeight: 18 }, bar: { height: 9, backgroundColor: colors.inkSoft, borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.lime },
  amount: { color: colors.ink, fontSize: 16, fontWeight: '800' }, warning: { backgroundColor: colors.paleOrange, borderRadius: 8, padding: 12, gap: 8 }, historyRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 }, historyName: { fontSize: 14, color: colors.ink, fontWeight: '700' },
});
