import { View } from 'react-native';
import type { PropsWithChildren } from 'react';
export type CalendarKeyboardProps = PropsWithChildren<{ prefix: string; open: boolean; focusDay: string; onNavigate: (day: string, command: string) => void; onClose: () => void }>;
export default function CalendarKeyboardGrid({ children }: CalendarKeyboardProps) { return <View>{children}</View>; }
