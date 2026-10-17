import { accessibleStyle } from '@/features/accessibility/preferences';
import { useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
export const lightColors = {
  paper: '#F2F2F7', surface: '#FFFFFF', ink: '#1C1C1E', inkSoft: '#3A3A40',
  muted: '#63636C', line: '#DEDEE4', lineStrong: '#8A8A93', primary: '#005FCC',
  accent: '#005FCC', accentDark: '#0055B8', paleGreen: '#EAF5ED', paleOrange: '#FFF4E6',
  lime: '#DDF0E2', danger: '#B42332', dangerPale: '#FDECEE',
  tint: '#E8F1FF', onPrimary: '#FFFFFF', success: '#187642', successPale: '#EAF5ED',
};
export const darkColors: typeof lightColors = {
  paper: '#000000', surface: '#1C1C1E', ink: '#F5F5F7', inkSoft: '#DEDEE5',
  muted: '#A8A8B2', line: '#38383D', lineStrong: '#8E8E98', primary: '#8ABBFF',
  accent: '#8ABBFF', accentDark: '#9CC7FF', paleGreen: '#193426', paleOrange: '#3A2A1B',
  lime: '#224530', danger: '#FF9DA8', dangerPale: '#3F1E26',
  tint: '#172A43', onPrimary: '#101C2D', success: '#7AD69B', successPale: '#193426',
};
// Existing semantic tokens are shared by inline styles and deferred StyleSheets.
// Components subscribe to a revision; switching appearance never remounts forms.
export const colors = { ...lightColors };
let revision = 0, current = 'light';
let boldText = false, largerControls = false;
export const accessibilityMetrics = { targetSize: 48 };
export function applyAccessibility(bold: boolean, larger: boolean) {
  if (bold === boldText && larger === largerControls) return;
  boldText = bold; largerControls = larger; accessibilityMetrics.targetSize = larger ? 56 : 48;
  revision++; listeners.forEach(listener => listener());
}
const listeners = new Set<() => void>();
export function applyTheme(dark: boolean, contrast: boolean) {
  const next = `${dark ? 'dark' : 'light'}-${contrast}`;
  if (current === next) return;
  current = next; Object.assign(colors, dark ? darkColors : lightColors);
  if (contrast) Object.assign(colors, { muted: colors.inkSoft, line: colors.lineStrong });
  revision++; listeners.forEach(listener => listener());
}
export function isDarkTheme() { return current.startsWith('dark'); }
export function useThemeRevision() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => revision, () => 0); }
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): T {
  let at = -1, cache: T;
  return new Proxy({} as T, {
    get: (_, key) => { if (at !== revision) { const styles = factory(); cache = StyleSheet.create(Object.fromEntries(Object.entries(styles).map(([name, style]) => [name, accessibleStyle(style as Record<string, unknown>,boldText,largerControls)])) as unknown as T); at = revision; } return cache[key as keyof T]; },
    ownKeys: () => Object.keys(factory()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}
