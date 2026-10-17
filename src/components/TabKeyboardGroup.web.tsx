import { moveTabIndex } from '@/features/accessibility/calendarNavigation';
import type { TabKeyboardProps } from './TabKeyboardGroup';
export default function TabKeyboardGroup({ children, onSelect }: TabKeyboardProps) {
  return <div onKeyDown={event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')], at = tabs.indexOf(event.target as HTMLElement);
    if (at < 0) return;
    event.preventDefault(); const next = moveTabIndex(at,tabs.length,event.key); tabs[next]?.focus(); onSelect(next);
  }}>{children}</div>;
}
