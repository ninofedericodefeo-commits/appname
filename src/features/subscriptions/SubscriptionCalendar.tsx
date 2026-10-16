import { useThemeRevision , colors } from '@/theme';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addCalendarDays, localDateKey, upcomingCharges } from './logic';
import type { Subscription } from './logic';
import { dataStyles as s } from '@/features/data/styles';
import { formatMoney } from '@/lib/money';
export default function SubscriptionCalendar({ subscriptions, today, includeSamples, onEdit }: { subscriptions: Subscription[]; today: Date; includeSamples: boolean; onEdit: (subscription: Subscription) => void }) {
  useThemeRevision();
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState('');
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12), days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const charges = upcomingCharges(subscriptions, start, days, includeSamples), groups = new Map<string, typeof charges>();
  for (const charge of charges) groups.set(charge.dateKey, [...groups.get(charge.dateKey) ?? [], charge]);
  const shown = selected ? groups.get(selected) ?? [] : charges;
  return <View style={s.card}><View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}><Pressable accessibilityRole="button" accessibilityLabel="Previous renewal month" disabled={offset <= 0} style={s.choice} onPress={() => { setOffset(offset - 1); setSelected(''); }}><Text style={s.choiceText}>‹</Text></Pressable><Text style={s.body}>{start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next renewal month" disabled={offset >= 11} style={s.choice} onPress={() => { setOffset(offset + 1); setSelected(''); }}><Text style={s.choiceText}>›</Text></Pressable></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((name, index) => <Text key={index} style={{ width: '14.2857%', textAlign: 'center', color: colors.muted, paddingVertical: 7 }}>{name}</Text>)}{Array.from({ length: Math.ceil((start.getDay() + days) / 7) * 7 }, (_, index) => {
      const day = index - start.getDay(); if (day < 0 || day >= days) return <View key={index} style={{ width: '14.2857%', minHeight: 48 }} />;
      const date = addCalendarDays(start, day), key = localDateKey(date), items = groups.get(key) ?? [];
      return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${date.toLocaleDateString()}, ${items.length} renewals`} accessibilityState={{ selected: selected === key }} onPress={() => setSelected(selected === key ? '' : key)} style={{ width: '14.2857%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: selected === key ? colors.paleGreen : 'transparent' }}><Text style={s.body}>{day + 1}</Text><Text style={{ fontSize: 10, color: colors.primary }}>{items.length ? `${items.length} due` : ' '}</Text></Pressable>;
    })}</View><Text style={s.note}>{selected ? `Renewals on ${selected}` : 'Planned renewals from your saved schedule. Tap a day to filter.'}</Text>
    {shown.map(item => <Pressable key={`${item.subscription.id}-${item.dateKey}`} accessibilityRole="button" style={s.choice} onPress={() => onEdit(item.subscription)}><Text style={s.choiceText}>{item.dateKey.slice(5)} · {item.subscription.name} · {formatMoney(item.amountCents)}{item.subscription.isSample ? ' · sample' : ''}</Text></Pressable>)}{!shown.length && <Text style={s.note}>No expected renewals in this selection.</Text>}
  </View>;
}
