import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { dataHealth } from './backupService';
import { dataStyles as s } from './styles';
import Button from '@/features/subscriptions/SubscriptionButton';
import { useThemeRevision } from '@/theme';
export default function DataHealth() {
  useThemeRevision();
  const [health,setHealth] = useState<Awaited<ReturnType<typeof dataHealth>> | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  async function refresh() { setBusy(true); try { setHealth(await dataHealth()); setError(''); } catch { setError('Could not inspect local files. Your records have not changed.'); } finally { setBusy(false); } }
  useEffect(() => { let active = true; void dataHealth().then(result => { if (active) setHealth(result); }).catch(() => { if (active) setError('Could not inspect local files.'); }); return () => { active = false; }; }, []);
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Local data health</Text>{health && <><Text style={s.body}>{health.transactions} bank movements · {health.purchases} purchases · {health.subscriptions} subscriptions</Text><Text style={s.note}>Originals: {health.originalsAvailable} available, {health.originalsMissing} missing. Receipt photos: {health.photosAvailable} available, {health.photosMissing} missing.</Text><Text style={s.note}>Attachments approximately {(health.bytes/1024/1024).toFixed(1)} MB · records {(health.recordsBytes/1024).toFixed(0)} KB. Includes Trash. Backup attachment limit: 30 MB.</Text><Text style={s.note}>Last encrypted backup created: {health.lastCreatedAt ? new Date(health.lastCreatedAt).toLocaleString() : 'none recorded on this device'}. Creation does not confirm it was saved outside Tally.</Text></>}{!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}<Button label={busy ? 'Checking files…' : 'Check local files again'} disabled={busy} onPress={() => void refresh()} /></View>;
}
