import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CalendarDateField, localDateKey } from '@/components/CalendarDateField';
import { confirmAmazonProduct, parseAmazonLink } from '@/features/goals/amazonLink';
import type { AmazonProductDraft } from '@/features/goals/amazonLink';
import { DEFAULT_SET_ASIDE_RULE, validDeadline } from '@/features/goals/logic';
import type { Goal, GoalInput, GoalKind, SetAsideRule } from '@/features/goals/logic';
import { parseDollars } from '@/features/pocket/logic';
import { formatAmount, formatMoney as money } from '@/lib/money';
import { colors } from '@/theme';

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

export default function GoalEditor({ goal, draft, reservedCents, onSave, onCancel, onLowerPocket, children, disabled = false }: {
  children?: ReactNode;
  goal: Goal | null;
  draft?: AmazonProductDraft;
  disabled?: boolean;
  reservedCents: number;
  onSave: (input: GoalInput, assignAll: boolean) => boolean;
  onCancel?: () => void;
  onLowerPocket?: (cents: number) => boolean;
}) {
  const product = goal?.product ?? draft;
  const [title, setTitle] = useState(goal?.title ?? product?.title ?? '');
  const kind: GoalKind = goal?.kind ?? (product ? 'item' : 'money');
  const [target, setTarget] = useState(goal ? formatAmount(goal.targetCents) : product?.priceCents ? formatAmount(product.priceCents) : '');
  const [variant, setVariant] = useState(product?.variant ?? '');
  const [timed, setTimed] = useState(!!goal?.deadline);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [assignAll, setAssignAll] = useState(false);
  const currentRule = goal?.setAsideRule ?? DEFAULT_SET_ASIDE_RULE;
  const [ruleMode, setRuleMode] = useState<SetAsideRule['mode']>(currentRule.mode);
  const [fixedAmount, setFixedAmount] = useState(currentRule.mode === 'fixed' ? formatAmount(currentRule.cents) : '1.00');
  const [percentAmount, setPercentAmount] = useState(currentRule.mode === 'percent' ? String(currentRule.percent) : '5');
  const [roundIncrement, setRoundIncrement] = useState(currentRule.mode === 'round' ? currentRule.incrementCents : 100);
  const [lowerAmount, setLowerAmount] = useState('');
  const [error, setError] = useState('');
  const previewCents = parseDollars(target);

  function save() {
    if (disabled) return;
    const targetCents = parseDollars(target);
    if (!title.trim() || title.trim().length > 80) { setError('Enter a title up to 80 characters.'); return; }
    if (targetCents === null || targetCents <= 0) { setError('Enter a target greater than $0.'); return; }
    if (timed && deadline !== goal?.deadline && !validDeadline(deadline)) { setError('Choose a future date from the calendar.'); return; }
    const fixedCents = parseDollars(fixedAmount);
    const percent = Number(percentAmount);
    if (ruleMode === 'fixed' && (fixedCents === null || fixedCents <= 0)) { setError('Enter a fixed amount greater than $0.'); return; }
    if (ruleMode === 'percent' && (!percentAmount.trim() || !Number.isFinite(percent) || percent <= 0 || percent > 100)) { setError('Enter a percent above 0 and no greater than 100.'); return; }
    const setAsideRule: SetAsideRule = ruleMode === 'fixed' ? { mode: 'fixed', cents: fixedCents! } : ruleMode === 'percent' ? { mode: 'percent', percent } : { mode: 'round', incrementCents: roundIncrement };
    const confirmedProduct = product ? confirmAmazonProduct(product, title, targetCents, variant) : null;
    if (product && !confirmedProduct) { setError('Check the Amazon link, title, variant and USD price.'); return; }
    if (!onSave({ title, kind, targetCents, deadline: timed ? deadline : null, setAsideRule, ...(confirmedProduct ? { product: confirmedProduct } : {}) }, assignAll)) {
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
    <Text style={styles.section}>{goal ? 'Edit goal' : product ? 'Review your product goal' : 'Set your goal'}</Text>
    {product && <View style={styles.productPreview}>
      <Text style={styles.label}>AMAZON · USD · {product.priceSource === 'amazon-page' && previewCents === product.priceCents && variant.trim() === product.variant ? 'PRICE FROM AMAZON' : 'ENTERED BY YOU'}</Text>
      <Text style={styles.productTitle}>{title.trim() || 'Add the product name below'}</Text>
      {variant.trim() ? <Text style={styles.hint}>{variant.trim()}</Text> : null}
      <Text style={styles.productPrice}>{previewCents ? money(previewCents) : 'Enter the price you see on Amazon'}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Open product on Amazon" onPress={() => {
        const link = parseAmazonLink(product.sourceUrl).value;
        if (link) void Linking.openURL(link.sourceUrl).catch(() => setError('Could not open Amazon. Copy the source link and open it in your browser.'));
      }}><Text style={styles.linkText}>Open product on Amazon ↗</Text></Pressable>
      <Text selectable style={styles.sourceUrl}>{product.sourceUrl}</Text>
      {product.priceReadAt && <Text style={styles.hint}>{product.priceSource === 'amazon-page' ? 'Price read' : 'Target entered'} {new Date(product.priceReadAt).toLocaleDateString()}. Check Amazon for the current price.</Text>}
    </View>}
    <Text style={styles.label}>Title</Text>
    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What are you saving for?" maxLength={80} accessibilityLabel="Goal title" />
    {product && <><Text style={styles.label}>Variant (optional)</Text><TextInput style={styles.input} value={variant} onChangeText={setVariant} placeholder="Size, color or model" maxLength={120} accessibilityLabel="Product variant" /></>}
    <Text style={styles.label}>{product ? 'Price / savings target (USD)' : 'Target amount'}</Text>
    <TextInput style={styles.input} value={target} onChangeText={setTarget} placeholder={product ? 'Enter the full USD price' : '500.00'} keyboardType="decimal-pad" accessibilityLabel="Goal target amount" />
    {product && <Text style={styles.hint}>Check the full price for your selected option. Tax and shipping are not included in the imported price; add them to your target if needed.</Text>}
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
    <View style={styles.row}><Action label={goal ? 'Save goal' : 'Create goal'} onPress={save} disabled={disabled} />{onCancel && <Action label="Cancel" secondary onPress={onCancel} />}</View>
    {children}
  </View>;
}


const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 19, gap: 10 },
  section: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  label: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  shortInput: { minWidth: 100, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  action: { backgroundColor: colors.accentDark, borderRadius: 6, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  actionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  actionText: { color: colors.surface, fontWeight: '800', fontSize: 13 },
  actionSecondaryText: { color: colors.ink },
  disabled: { opacity: 0.45 },
  choice: { borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { color: colors.inkSoft, fontWeight: '700' },
  choiceTextSelected: { color: colors.surface },
  linkText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  warning: { backgroundColor: colors.paleOrange, borderRadius: 8, padding: 12, gap: 8 },
  productPreview: { backgroundColor: colors.paleGreen, padding: 15, borderRadius: 8, gap: 8 },
  productTitle: { color: colors.ink, fontSize: 19, lineHeight: 26, fontWeight: '800' },
  productPrice: { color: colors.ink, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sourceUrl: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
