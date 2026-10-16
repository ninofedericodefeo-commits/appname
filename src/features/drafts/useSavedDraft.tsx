import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { draftStorage } from './storage';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import { dataStyles as s } from '@/features/data/styles';
import { saveDraft } from './persistence';
export function useSavedDraft<T>(key: string, value: T, changed: boolean, resume: (value: T) => boolean | void, enabled = true) {
  const [existing, setExisting] = useState<{ value: T; savedAt: string } | null>(null), [loaded, setLoaded] = useState(false), [status,setStatus] = useState(''), [savedSnapshot,setSavedSnapshot] = useState('');
  useEffect(() => { let active = true; void draftStorage.read(key).then(raw => { if (!active) return; const saved = raw as { version: number; value: T; savedAt: string } | null; if (saved?.version === 1) setExisting(saved); setLoaded(true); }).catch(() => { if (active) { setLoaded(true); setStatus('Saved draft could not be read. Your committed records are safe.'); } }); return () => { active = false; }; }, [key]);
  const serialized = JSON.stringify(value);
  const latest = useRef({ serialized, changed, enabled, loaded, pending: !!existing });
  const cleared = useRef(false), clearedValue = useRef('');
  useEffect(() => { latest.current = { serialized, changed, enabled, loaded, pending: !!existing }; if (serialized !== clearedValue.current) cleared.current = false; }, [serialized, changed, enabled, loaded, existing]);
  useEffect(() => {
    const flush = () => { const draft = latest.current; if (!cleared.current && draft.changed && draft.enabled && draft.loaded && !draft.pending) void saveDraft(key,JSON.parse(draft.serialized)).catch(() => undefined); };
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    return () => { listener.remove(); flush(); };
  }, [key]);
  useEffect(() => { if (!enabled || !loaded || existing || !changed) return; const timeout = setTimeout(() => { if (cleared.current) return; void saveDraft(key,JSON.parse(serialized)).then(() => { setSavedSnapshot(serialized); setStatus('Draft saved on this device. Resume here after interruption.'); }).catch(() => setStatus('Draft could not be saved. Keep this screen open; retain your original files.')); },key === 'bank-import' ? 0 : 500); return () => clearTimeout(timeout); }, [key, serialized, changed, loaded, existing, enabled]);
  const clear = async () => { cleared.current = true; clearedValue.current = serialized; setExisting(null); setStatus(''); await saveDraft(key,null); };
  const panel = existing && enabled ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Saved unfinished draft</Text><Text style={s.note}>{new Date(existing.savedAt).toLocaleString()} · local to this device; not included in backups.</Text><SubscriptionButton label="Resume draft" onPress={() => { if (resume(existing.value) !== false) setExisting(null); }} /><SubscriptionButton label="Discard saved draft" onPress={() => { void clear().catch(() => setStatus('Could not discard this draft. Try again.')); }} /></View> : enabled && changed && serialized !== savedSnapshot && !status.startsWith('Draft could not') ? <Text style={s.note}>Saving draft on this device…</Text> : status ? <Text accessibilityLiveRegion="polite" style={s.note}>{status}</Text> : null;
  return { clear, panel, pending: !!existing };
}
