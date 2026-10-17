export type AccessibilityPreferences = {
  boldText: boolean;
  largerControls: boolean;
  reduceMotion: 'system' | 'reduce';
  preferStationList: boolean;
};
export const accessibilityDefaults: AccessibilityPreferences = {
  boldText: false, largerControls: false, reduceMotion: 'system', preferStationList: false,
};
export function validAccessibilityPreferences(value: Partial<AccessibilityPreferences>) {
  return ['boldText','largerControls','preferStationList'].every(key => value[key as keyof AccessibilityPreferences] === undefined || typeof value[key as keyof AccessibilityPreferences] === 'boolean') &&
    (value.reduceMotion === undefined || ['system','reduce'].includes(value.reduceMotion));
}
export function accessibleStyle<T extends Record<string, unknown>>(style: T, bold: boolean, larger: boolean): T {
  const result: Record<string, unknown> = { ...style };
  if (bold && ('color' in style || 'fontSize' in style)) {
    const weight = Number(style.fontWeight ?? 400);
    if (style.fontWeight === 'normal' || Number.isFinite(weight) && weight < 600) result.fontWeight = '600';
  }
  if (larger) {
    if (typeof style.minHeight === 'number' && style.minHeight >= 44 && style.minHeight < 56) result.minHeight = 56;
    if (typeof style.minWidth === 'number' && style.minWidth >= 44 && style.minWidth < 56) result.minWidth = 56;
    // Fixed square icon controls grow together; decorative avatars are smaller.
    if (typeof style.height === 'number' && style.height >= 44 && style.height <= 52 && style.width === style.height) {
      result.height = result.width = 56;
      if (style.borderRadius === style.height / 2) result.borderRadius = 28;
    }
  }
  return result as T;
}
