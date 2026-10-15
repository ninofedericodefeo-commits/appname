import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { recoverInterruptedRestore } from './backupService';
import { useDataStatus } from './operationStatus';
import { colors } from '@/theme';

export function DataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const { busy, recoveryError, revision } = useDataStatus();
  async function recover() {
    try { await recoverInterruptedRestore(); setReady(true); }
    catch { setError('Saved data could not be recovered. Retry recovery; keep your backup and app installed.'); }
  }
  useEffect(() => { let active = true; void recoverInterruptedRestore().then(() => { if (active) setReady(true); }).catch(() => { if (active) setError('Saved data could not be recovered. Retry recovery; keep your backup and app installed.'); }); return () => { active = false; }; }, []);
  const panel = <View style={styles.panel}><Text style={styles.title}>GasFinder</Text><Text style={styles.note}>{error || recoveryError || (ready ? 'Saving your data…' : 'Opening saved data…')}</Text>{error || recoveryError ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setError(''); void recover(); }}><Text style={styles.buttonText}>Retry recovery</Text></Pressable> : <ActivityIndicator color={colors.accentDark} />}</View>;
  if (!ready) return <View style={styles.cover}>{panel}</View>;
  return <><Fragment key={revision}>{children}</Fragment><Modal visible={busy || !!recoveryError} transparent animationType="none" onRequestClose={() => {}}><View style={styles.cover}>{panel}</View></Modal></>;
}
const styles = StyleSheet.create({ cover: { flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 28 }, panel: { gap: 18 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800' }, note: { color: colors.muted, fontSize: 15, lineHeight: 23 }, button: { minHeight: 48, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, buttonText: { color: colors.surface, fontWeight: '800' } });
