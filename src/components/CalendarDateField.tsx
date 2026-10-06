import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === key ? date : null;
}

export function CalendarDateField({ value, onChange, label, minimumDate, maximumDate, displayValue }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  minimumDate?: string;
  maximumDate?: string;
  displayValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = dateFromKey(value) ?? new Date();
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const selected = dateFromKey(value);
  const firstWeekday = visibleMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1);

  function shiftMonth(delta: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1));
  }

  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected ? selected.toLocaleDateString() : 'choose a date'}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.trigger}>
      <Text style={styles.triggerText}>{displayValue ?? (selected ? selected.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Choose a date')}</Text>
      <Text style={styles.icon}>▦</Text>
    </Pressable>
    {open && <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} style={styles.arrow}><Text style={styles.arrowText}>‹</Text></Pressable>
        <Text style={styles.monthTitle}>{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)} style={styles.arrow}><Text style={styles.arrowText}>›</Text></Pressable>
      </View>
      <View style={styles.grid}>{weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
        {cells.map((day, index) => {
          if (day < 1 || day > daysInMonth) return <View key={`blank-${index}`} style={styles.day} />;
          const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day, 12);
          const key = localDateKey(date);
          const disabled = (minimumDate && key < minimumDate) || (maximumDate && key > maximumDate);
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: value === key, disabled: !!disabled }} disabled={!!disabled} onPress={() => { onChange(key); setOpen(false); }} style={[styles.day, value === key && styles.selectedDay]}><Text style={[styles.dayText, disabled && styles.disabledDay, value === key && styles.selectedDayText]}>{day}</Text></Pressable>;
        })}
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 },
  triggerText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  icon: { color: colors.accentDark, fontSize: 22 },
  calendar: { marginTop: 8, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.accentDark, fontSize: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '800', paddingVertical: 7 },
  day: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  dayText: { color: colors.ink, fontSize: 14 },
  disabledDay: { color: colors.lineStrong },
  selectedDay: { backgroundColor: colors.ink },
  selectedDayText: { color: colors.surface, fontWeight: '800' },
});
