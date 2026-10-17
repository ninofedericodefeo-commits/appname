import { dateFromKey, localDateKey } from '../../lib/calendarDate.ts';
export const calendarKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'] as const;
export function moveCalendarDate(key: string, command: string, minimum?: string, maximum?: string) {
  const date = dateFromKey(key); if (!date || !calendarKeys.includes(command as typeof calendarKeys[number])) return null;
  if (command === 'PageUp' || command === 'PageDown') {
    const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth()+(command === 'PageUp' ? -1 : 1));
    date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
  } else {
    const offset = command === 'ArrowLeft' ? -1 : command === 'ArrowRight' ? 1 : command === 'ArrowUp' ? -7 : command === 'ArrowDown' ? 7 : command === 'Home' ? -date.getDay() : 6-date.getDay();
    date.setDate(date.getDate()+offset);
  }
  const result = localDateKey(date);
  if (!dateFromKey(result)) return null;
  return minimum && result < minimum ? minimum : maximum && result > maximum ? maximum : result;
}
export function moveTabIndex(index: number, count: number, command: string) {
  if (count < 1) return index;
  if (command === 'Home') return 0; if (command === 'End') return count-1;
  if (command === 'ArrowRight') return (index+1)%count; if (command === 'ArrowLeft') return (index+count-1)%count;
  return index;
}
