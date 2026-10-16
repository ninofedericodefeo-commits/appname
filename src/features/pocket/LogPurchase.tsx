import { useValidationAnnouncement } from '@/components/useValidationAnnouncement';
import { CalendarDateField, localDateKey } from '@/components/CalendarDateField';
import { useDraftGuard } from '@/components/useDraftGuard';
import { manualMovementDate } from './manualMovement';
import { themedStyles, useThemeRevision , colors } from '@/theme';
import { useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { parseDollars } from './logic';
import { usePocketStore } from '@/stores/pocketStore';

export function LogPurchase() {
  useThemeRevision();
  const addPurchase = usePocketStore((state) => state.addPurchase);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [day,setDay] = useState(() => localDateKey(new Date())), [details,setDetails] = useState(false), [kind,setKind] = useState<'purchase' | 'deposit' | 'refund'>('purchase'), [applyRule,setApplyRule] = useState(true);
  const guard = useDraftGuard({ title, amount, day, kind, applyRule }, false, open);
  const [error, setError] = useState('');
  useValidationAnnouncement(error);
  function save() {
    const cents = parseDollars(amount);
    if (!title.trim() || cents === null || cents <= 0) { setError('Enter a name and an amount greater than $0.'); return; }
    try {
      const date = manualMovementDate(day);
      const saved = kind === 'purchase' ? addPurchase(`${Date.now()}-${Math.random().toString(36).slice(2)}`, title, cents, undefined, 'manual', date, applyRule)
        : usePocketStore.getState().addManualCredit(`account-${Date.now().toString(16).padStart(12,'0')}${Math.floor(Math.random()*65536).toString(16).padStart(4,'0')}`,title,cents,day,kind);
      if (!saved) { setError('This movement could not be saved. Check its details.'); return; }
    } catch (cause) { setError((cause as Error).message); return; }
    guard.accept();
    setTitle(''); setAmount(''); setError(''); setOpen(false); Keyboard.dismiss();
  }
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.toggle} onPress={() => { Keyboard.dismiss(); if (open) guard.confirm(() => { setTitle(''); setAmount(''); setDay(localDateKey(new Date())); setKind('purchase'); setApplyRule(true); setOpen(false); }); else setOpen(true); }}><Text style={styles.link}>{open ? 'Close movement form' : '+ Log a purchase / deposit'}</Text></Pressable>
    {open && <View style={styles.form}>
      <TextInput accessibilityLabel="Movement name" value={title} onChangeText={setTitle} maxLength={80} placeholder="What did you buy?" style={styles.input} />
      <TextInput accessibilityLabel="Movement amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} style={styles.toggle} onPress={() => setDetails(!details)}><Text style={styles.link}>Date, deposit/refund & savings options</Text></Pressable>
      {details && <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(['purchase','deposit','refund'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} style={styles.toggle} onPress={() => setKind(value)}><Text style={styles.link}>{kind === value ? '✓ ' : ''}{value}</Text></Pressable>)}</View><CalendarDateField label="Movement date" value={day} maximumDate={localDateKey(new Date())} onChange={setDay} />{kind === 'purchase' && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: applyRule }} aria-checked={applyRule} style={styles.toggle} onPress={() => setApplyRule(!applyRule)}><Text style={styles.link}>{applyRule ? '✓ ' : ''}Apply goal’s savings rule</Text></Pressable>}</>}
      <Text style={styles.hint}>{kind === 'purchase' ? applyRule ? 'The goal rule applies once when saved.' : 'No goal contribution will be added.' : 'Adds money in without a savings contribution. Review any future matching statement row to avoid counting twice.'} Newer movements update the estimate. Your saved bank snapshot stays the same.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" style={styles.save} onPress={save}><Text style={styles.saveText}>Save {kind === 'purchase' ? 'purchase' : kind}</Text></Pressable>
    </View>}
  {guard.dialog}</View>;
}
const styles = themedStyles(() => ({
  toggle: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  form: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12, marginBottom: 12 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, color: colors.ink, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.danger, fontSize: 13 },
  save: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 7, padding: 12 }, saveText: { color: colors.surface, fontWeight: '700' },
}));
