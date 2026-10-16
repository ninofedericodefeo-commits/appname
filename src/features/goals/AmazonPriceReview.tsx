import { useThemeRevision } from '@/theme';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { parseAmazonLink } from './amazonLink';
import type { AmazonProductDraft } from './amazonLink';
import AmazonProductLookup from './AmazonProductLookup';
import { usePocketStore } from '@/stores/pocketStore';
import { parseDollars } from '../pocket/logic';
import { dataStyles as s } from '../data/styles';
import { formatMoney } from '@/lib/money';
export default function AmazonPriceReview() {
  useThemeRevision();
  const goal = usePocketStore(state => state.activeGoal), [reading,setReading] = useState(false), [draft,setDraft] = useState<AmazonProductDraft | null>(null), [price,setPrice] = useState(''), [message,setMessage] = useState(''), [expected,setExpected] = useState<{id:string;target:number} | null>(null);
  if (!goal?.product) return null;
  const link = parseAmazonLink(goal.product.sourceUrl).value;
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Recheck product price</Text><Text style={s.note}>Current target {formatMoney(goal.targetCents)}. Lookup runs only when requested. Saved money stays assigned even if the new target is lower.</Text><Pressable accessibilityRole="button" disabled={reading || !link} style={s.choice} onPress={() => { setExpected({id:goal.id,target:goal.targetCents}); setDraft(null); setReading(true); setMessage('Reading the public product page…'); }}><Text style={s.choiceText}>Check current Amazon price</Text></Pressable>{reading && <Pressable accessibilityRole="button" style={s.choice} onPress={() => { setReading(false); setMessage('Lookup canceled.'); }}><Text style={s.choiceText}>Cancel lookup</Text></Pressable>}
  {draft && <><Text style={s.body}>{draft.title || goal.title}{'\n'}{draft.variant}{'\n'}Old target: {formatMoney(expected?.target ?? goal.targetCents)}</Text><Text style={s.note}>{draft.priceSource === 'amazon-page' ? 'Public page result. Verify selected variant, full USD price and any tax/shipping adjustment.' : 'Lookup incomplete. Enter the full USD price manually.'}</Text><TextInput accessibilityLabel="Reviewed new product target" style={s.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} /><Pressable accessibilityRole="button" style={s.button} onPress={() => { const cents = parseDollars(price), state = usePocketStore.getState(), current = state.activeGoal; if (!expected || !current || current.id !== expected.id || current.targetCents !== expected.target) { setMessage('Goal changed. Recheck before saving.'); return; } if (!cents) { setMessage('Enter a positive full USD price.'); return; } const title = draft.title.trim().slice(0,80) || current.title; const saved = state.updateGoal({ ...current, title, targetCents:cents, product:{...draft,title,priceCents:cents,priceSource:cents === draft.priceCents ? draft.priceSource : 'manual',priceReadAt:cents === draft.priceCents ? draft.priceReadAt ?? new Date().toISOString() : new Date().toISOString()} }); setMessage(saved ? 'Target updated after review. Saved money is unchanged.' : 'Could not save this target.'); if (saved) setDraft(null); }}><Text style={s.buttonText}>Confirm new target {parseDollars(price) ? formatMoney(parseDollars(price)!) : ''}</Text></Pressable><Pressable accessibilityRole="button" style={s.choice} onPress={() => setDraft(null)}><Text style={s.choiceText}>Keep current target</Text></Pressable></>}
  {!!message && <Text accessibilityLiveRegion="polite" style={s.note}>{message}</Text>}{reading && link && <AmazonProductLookup link={link} onResult={result => { setReading(false); setDraft(result.draft); setPrice(result.draft.priceCents ? (result.draft.priceCents/100).toFixed(2) : ''); setMessage(result.message ?? 'Review the new target before saving.'); }} />}
  </View>;
}
