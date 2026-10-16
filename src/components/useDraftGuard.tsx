import { useDialogFocus } from './useDialogFocus';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Text, View } from 'react-native';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { useReducedMotion } from './useReducedMotion';
export function useDraftGuard(value: unknown, preserveOnLeave = false, enabled = true) {
  const { heading, focus } = useDialogFocus();
  const snapshot = JSON.stringify(value), [initial,setInitial] = useState(snapshot), bypass = useRef(false);
  if (!enabled && initial !== snapshot) setInitial(snapshot);
  const dirty = enabled && snapshot !== initial;
  const [preserved,setPreserved] = useState(preserveOnLeave);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const navigation = useNavigation();
  const [allowed, setAllowed] = useState<null | (() => void)>(null);
  usePreventRemove(dirty && !allowed, ({ data }) => {
    const action = () => navigation.dispatch(data.action);
    if (bypass.current) setAllowed(() => action); else { setPreserved(preserveOnLeave); setPending(() => action); }
  });
  useEffect(() => { if (allowed) { allowed(); void Promise.resolve().then(() => { setAllowed(null); bypass.current = false; }); } }, [allowed]);
  useEffect(() => { if (!dirty) bypass.current = false; }, [dirty]);
  const reduced = useReducedMotion();
  useEffect(() => { if (Platform.OS !== 'web' || !dirty) return; const listener = (event: BeforeUnloadEvent) => { if (!bypass.current) event.preventDefault(); }; window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener); }, [dirty]);
  const confirm = (action: () => void, keepDraft = preserveOnLeave, force = false) => { if (!force && (!dirty || bypass.current)) action(); else { setPreserved(keepDraft); setPending(() => action); AccessibilityInfo.announceForAccessibility('Unsaved changes. Keep editing or discard changes.'); } };
  const accept = (nextValue: unknown = value) => { setInitial(JSON.stringify(nextValue)); bypass.current = true; };
  const dialog = pending && <Modal transparent visible onShow={focus} animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setPending(null)}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' }}><View accessibilityViewIsModal style={s.card}><Text ref={heading} tabIndex={-1} accessibilityRole="header" style={s.heading}>{preserved ? 'Leave unfinished draft?' : 'Discard unsaved changes?'}</Text><Text style={s.note}>{preserved ? 'Return here to resume or discard the local draft. Check that its status says saved before leaving. Committed records stay the same.' : 'Your saved records stay the same.'}</Text><SubscriptionButton label="Keep editing" onPress={() => setPending(null)} /><SubscriptionButton label={preserved ? 'Leave draft here' : 'Discard changes'} tone="danger" onPress={() => { const action = pending; setPending(null); bypass.current = true; setAllowed(() => action); }} /></View></View></Modal>;
  return { dirty, confirm, accept, dialog };
}
