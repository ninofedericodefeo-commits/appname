import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseDollars } from './logic';
import { usePocketStore } from '@/stores/pocketStore';
import { colors } from '@/theme';

export function LogPurchase() {
  const addPurchase = usePocketStore((state) => state.addPurchase);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  function save() {
    const cents = parseDollars(amount);
    if (!title.trim() || cents === null || cents <= 0) { setError('Enter a name and an amount greater than $0.'); return; }
    if (!addPurchase(`${Date.now()}-${Math.random().toString(36).slice(2)}`, title, cents)) { setError('Could not log this purchase. Check its details.'); return; }
    setTitle(''); setAmount(''); setError(''); setOpen(false); Keyboard.dismiss();
  }
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.toggle} onPress={() => { Keyboard.dismiss(); setOpen(!open); }}><Text style={styles.link}>{open ? 'Close purchase form' : '+ Log a purchase'}</Text></Pressable>
    {open && <View style={styles.form}>
      <TextInput accessibilityLabel="Purchase name" value={title} onChangeText={setTitle} maxLength={80} placeholder="What did you buy?" style={styles.input} />
      <TextInput accessibilityLabel="Purchase amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" style={styles.input} />
      <Text style={styles.hint}>Your goal’s rule applies when this is logged. Your saved bank balance stays unchanged.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" style={styles.save} onPress={save}><Text style={styles.saveText}>Save purchase</Text></Pressable>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  toggle: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  form: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 12, marginBottom: 12 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, padding: 12, color: colors.ink, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.danger, fontSize: 13 },
  save: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 7, padding: 12 }, saveText: { color: colors.surface, fontWeight: '700' },
});
