import CalendarKeyboardGrid from './CalendarKeyboardGrid';
import { moveCalendarDate } from '@/features/accessibility/calendarNavigation';
import { themedStyles, useThemeRevision , colors, accessibilityMetrics } from '@/theme';
import { dateFromKey, localDateKey } from '@/lib/calendarDate';
import { useId, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

export { localDateKey } from '@/lib/calendarDate';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarDateField({ value, onChange, label, minimumDate, maximumDate, displayValue }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  minimumDate?: string;
  maximumDate?: string;
  displayValue?: string;
}) {
  useThemeRevision();
  const prefix = useId();
  const [focusDay,setFocusDay] = useState('');
  const width = useWindowDimensions().width;
  const [measuredWidth,setMeasuredWidth] = useState(0);
  const daySize = accessibilityMetrics.targetSize;
  const narrow = (measuredWidth || width-40) < daySize*7+26;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = dateFromKey(value) ?? new Date();
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const selected = dateFromKey(value);
  const firstWeekday = visibleMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1);

  function navigate(day: string, command: string) {
    const next = moveCalendarDate(day,command,minimumDate,maximumDate), date = next && dateFromKey(next);
    if (next && date) { setVisibleMonth(new Date(date.getFullYear(),date.getMonth(),1)); setFocusDay(next); }
  }
  const firstAllowed = cells.filter(day => day > 0 && day <= daysInMonth).map(day => localDateKey(new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),day,12))).find(key => (!minimumDate || key >= minimumDate) && (!maximumDate || key <= maximumDate));
  const activeDay = [focusDay,value].find(key => firstAllowed && key.slice(0,7) === firstAllowed.slice(0,7) && (!minimumDate || key >= minimumDate) && (!maximumDate || key <= maximumDate)) ?? firstAllowed;
  function shiftMonth(delta: number) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) { setVisibleMonth(next); setFocusDay(''); }
  }

  return <CalendarKeyboardGrid prefix={prefix} open={open} focusDay={focusDay} onNavigate={navigate} onClose={() => setOpen(false)}><View onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Text style={styles.label}>{label}</Text><Pressable nativeID={`${prefix}-trigger`} accessibilityActions={[{ name: 'previousDay', label: 'Previous day' },{ name: 'nextDay', label: 'Next day' }]} onAccessibilityAction={event => { const action = event.nativeEvent.actionName; if (action !== 'previousDay' && action !== 'nextDay') return; const next = moveCalendarDate(value || localDateKey(new Date()),action === 'previousDay' ? 'ArrowLeft' : 'ArrowRight',minimumDate,maximumDate); if (next) onChange(next); }} accessibilityRole="button" accessibilityLabel={`${label}, ${selected ? selected.toLocaleDateString() : 'choose a date'}`} accessibilityState={{ expanded: open }} onPress={() => { if (!open) { const date = selected ?? new Date(); setVisibleMonth(new Date(date.getFullYear(),date.getMonth(),1)); setFocusDay(''); } setOpen(!open); }} style={styles.trigger}>
      <Text style={styles.triggerText}>{displayValue ?? (selected ? selected.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Choose a date')}</Text>
      <Text style={styles.icon}>▦</Text>
    </Pressable>
    {open && <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} style={styles.arrow}><Text style={styles.arrowText}>‹</Text></Pressable>
        <Text style={styles.monthTitle}>{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)} style={styles.arrow}><Text style={styles.arrowText}>›</Text></Pressable>
      </View>
      <View style={[styles.grid, narrow && { gap: 6 }]}>{!narrow && weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
        {cells.map((day, index) => {
          if (day < 1 || day > daysInMonth) return narrow ? null : <View key={`blank-${index}`} style={styles.day} />;
          const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day, 12);
          const key = localDateKey(date);
          const disabled = (minimumDate && key < minimumDate) || (maximumDate && key > maximumDate);
          return <Pressable key={key} nativeID={`${prefix}-day-${key}`} tabIndex={activeDay === key ? 0 : -1} aria-pressed={value === key} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: value === key, disabled: !!disabled }} disabled={!!disabled} onPress={() => { onChange(key); setOpen(false); }} style={[styles.day, narrow && { width: daySize, minWidth: daySize, minHeight: daySize }, value === key && styles.selectedDay]}><Text style={[styles.dayText, disabled && styles.disabledDay, value === key && styles.selectedDayText]}>{day}</Text></Pressable>;
        })}
      </View>
    </View>}
  </View></CalendarKeyboardGrid>;
}

const styles = themedStyles(() => ({
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 7 },
  trigger: { minHeight: 48, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 },
  triggerText: { flex: 1, flexShrink: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
  icon: { color: colors.accentDark, fontSize: 22 },
  calendar: { marginTop: 8, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 15, fontWeight: '800' },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.accentDark, fontSize: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '800', paddingVertical: 7 },
  day: { width: '14.2857%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  dayText: { color: colors.ink, fontSize: 14 },
  disabledDay: { color: colors.lineStrong },
  selectedDay: { backgroundColor: colors.ink },
  selectedDayText: { color: colors.surface, fontWeight: '800' },
}));
