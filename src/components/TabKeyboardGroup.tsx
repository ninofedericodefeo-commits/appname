import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
export type TabKeyboardProps = PropsWithChildren<{ onSelect: (index: number) => void }>;
export default function TabKeyboardGroup({ children }: TabKeyboardProps) { return <View>{children}</View>; }
