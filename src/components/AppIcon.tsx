import { colors, useThemeRevision } from '@/theme';
import Svg, { Path } from 'react-native-svg';
import { Platform } from 'react-native';

export type AppIconName =
  | 'search' | 'location' | 'sliders' | 'map' | 'list'
  | 'chevron-right' | 'chevron-down' | 'plus' | 'arrow-up-right'
  | 'fuel' | 'route' | 'car' | 'receipt' | 'bookmark' | 'bookmark-filled'
  | 'chart' | 'target' | 'wallet' | 'repeat' | 'settings' | 'check' | 'close';

const paths: Record<AppIconName, string> = {
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.7-1.8L21 21',
  location: 'm20.5 3.5-6.6 17-3.1-7.3-7.3-3.1 17-6.6Z',
  sliders: 'M4 6h7m5 0h4M4 12h2m5 0h9M4 18h10m5 0h1M11 3v6M6 9v6m8 0v6',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  list: 'M8 5h12M8 12h12M8 19h12M3 5h.01M3 12h.01M3 19h.01',
  'chevron-right': 'm9 5 7 7-7 7',
  'chevron-down': 'm5 9 7 7 7-7',
  plus: 'M12 5v14M5 12h14',
  'arrow-up-right': 'M6 18 18 6M6 6h12v12',
  fuel: 'M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M3 21h12M4 10h10M7 6h4m3 7h2a2 2 0 0 1 2 2v2a1.5 1.5 0 0 0 3 0V9l-4-4m2 2v3h2',
  route: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8',
  car: 'm4 10 2-6h12l2 6M3 11a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7H3v-7Zm1 7v3m16-3v3M6 14h2m8 0h2M3 8H1m20 0h2',
  receipt: 'M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2-3-2Zm4 6h6m-6 4h6m-6 4h3',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  'bookmark-filled': 'M6 3h12v18l-6-4-6 4V3Z',
  chart: 'M4 3v17h17M8 16v-5m5 5V7m5 9V4',
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  wallet: 'M20 7V4H5a2 2 0 0 0 0 4h16v12H5a2 2 0 0 1-2-2V6m18 6h-5v4h5m-3-2h.01',
  repeat: 'M4 8h16m-4-4 4 4-4 4M20 16H4m4 4-4-4 4-4',
  settings: 'm10 3-.6 2.2-2 1.2-2.2-.6-2 3.4 1.6 1.6v2.4l-1.6 1.6 2 3.4 2.2-.6 2 1.2L10 21h4l.6-2.2 2-1.2 2.2.6 2-3.4-1.6-1.6v-2.4l1.6-1.6-2-3.4-2.2.6-2-1.2L14 3h-4Zm6 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
};

/** Decorative icons inherit meaning from their surrounding control or label. */
export function AppIcon({ name, size = 22, color = colors.ink }: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  useThemeRevision();
  return <Svg width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}>
    <Path d={paths[name]} fill={name === 'bookmark-filled' ? color : 'none'} />
  </Svg>;
}
