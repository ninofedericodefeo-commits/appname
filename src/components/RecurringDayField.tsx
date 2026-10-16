import { useState } from 'react';
import { Text, View } from 'react-native';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { useThemeRevision } from '@/theme';
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function RecurringDayField({ day, month, yearly, onChange }: { day: number; month: number; yearly: boolean; onChange: (day: number, month: number) => void }) {
  useThemeRevision();
  const [open, setOpen] = useState(false);
  const max = yearly ? new Date(2028, month, 0).getDate() : 31;
  return <View style={{ gap: 8 }}><SubscriptionButton label={yearly ? `${months[month-1]} ${day} each year` : `Day ${day} each month`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} />{open && <><Text style={s.note}>{yearly ? 'Choose renewal month, then day.' : 'Choose the day of each month.'}</Text>{yearly && <View style={s.row}>{months.map((label,index) => <SubscriptionButton key={label} label={label} accessibilityState={{ selected: month === index+1 }} onPress={() => onChange(Math.min(day,new Date(2028,index+1,0).getDate()),index+1)} />)}</View>}<View style={s.row}>{Array.from({ length: max },(_,index) => index+1).map(value => <SubscriptionButton key={value} label={`Day ${value}`} tone={value === day ? 'primary' : 'secondary'} accessibilityState={{ selected: value === day }} onPress={() => { onChange(value,month); setOpen(false); }} />)}</View></>}<Text style={s.note}>In shorter months, renewal falls on the last day. February 29 renews February 28 in other years.</Text></View>;
}
