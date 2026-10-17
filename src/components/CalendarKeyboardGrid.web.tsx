import { useEffect, useRef } from 'react';
import type { CalendarKeyboardProps } from './CalendarKeyboardGrid';
import { calendarKeys } from '@/features/accessibility/calendarNavigation';
export default function CalendarKeyboardGrid({ children, prefix, open, focusDay, onNavigate, onClose }: CalendarKeyboardProps) {
  const consumedEscape = useRef(false);
  useEffect(() => { if (open && focusDay) document.getElementById(`${prefix}-day-${focusDay}`)?.focus(); }, [prefix,focusDay,open]);
  // Capture runs before React Native Web's Pressable stops click propagation.
  return <div onClickCapture={event => { const day = (event.target as HTMLElement).closest('[id*="-day-"]'); if (day && day.getAttribute('aria-disabled') !== 'true') document.getElementById(`${prefix}-trigger`)?.focus(); }} onKeyUp={event => {
    // RN Web modals close on keyup. Escape should close only the open calendar.
    if (event.key === 'Escape' && consumedEscape.current) { event.stopPropagation(); event.preventDefault(); consumedEscape.current = false; }
  }} onKeyDown={event => {
    if (!open) return;
    if (event.key === 'Escape') { consumedEscape.current = true; event.preventDefault(); event.stopPropagation(); onClose(); document.getElementById(`${prefix}-trigger`)?.focus(); return; }
    const day = (event.target as HTMLElement).id.match(/-day-(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (!day || !calendarKeys.includes(event.key as typeof calendarKeys[number])) return;
    event.preventDefault(); onNavigate(day,event.key);
  }}>{children}</div>;
}
