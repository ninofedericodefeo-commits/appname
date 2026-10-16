import { useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
export const lightColors = {
  paper: '#F4F0E7', surface: '#FFFEF9', ink: '#173A35', inkSoft: '#38574F',
  muted: '#52675D', line: '#B9C8BA', lineStrong: '#7A8C7D', primary: '#245A4B',
  accent: '#B64420', accentDark: '#A63F21', paleGreen: '#E8EFDD', paleOrange: '#FCEDDE',
  lime: '#D7E7A7', danger: '#A33124', dangerPale: '#FBE8E2',
};
export const darkColors: typeof lightColors = {
  paper: '#101C19', surface: '#192A25', ink: '#F2F6ED', inkSoft: '#D3E3D8',
  muted: '#B1C4B7', line: '#52685B', lineStrong: '#809A89', primary: '#A5D3B6',
  accent: '#F0A27B', accentDark: '#FFB38C', paleGreen: '#253F31', paleOrange: '#443025',
  lime: '#324529', danger: '#FFAD9B', dangerPale: '#482C27',
};
// Existing semantic tokens are shared by inline styles and deferred StyleSheets.
// Components subscribe to a revision; switching appearance never remounts forms.
export const colors = { ...lightColors };
let revision = 0, current = 'light';
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
    get: (_, key) => { if (at !== revision) { cache = StyleSheet.create(factory()); at = revision; } return cache[key as keyof T]; },
    ownKeys: () => Object.keys(factory()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}
