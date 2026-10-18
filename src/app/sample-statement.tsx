import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { MoneyPage } from '@/components/MoneyPage';
import SubscriptionButton from '@/features/subscriptions/SubscriptionButton';
import SampleAccountPreview from '@/features/samples/SampleAccountPreview';
import SampleDataControl from '@/features/samples/SampleDataControl';
import { SAMPLE_CITIZENS_STATEMENT, sampleStatementBytes } from '@/features/samples/statement';
import { exportDataFile, type ExportLink } from '@/features/data/fileIO';
import { dataStyles as s } from '@/features/data/styles';
import { colors, useThemeRevision } from '@/theme';

export default function SampleStatementScreen() {
  useThemeRevision();
  const [download, setDownload] = useState<ExportLink | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { if (download && Platform.OS === 'web') URL.revokeObjectURL(download.url); }, [download]);
  async function share() {
    setBusy(true); setError('');
    try { const result = await exportDataFile(sampleStatementBytes(), SAMPLE_CITIZENS_STATEMENT.name, 'application/pdf'); if (result) setDownload(result); }
    catch { setError('Could not share the sample PDF. Please try again.'); }
    finally { setBusy(false); }
  }
  return <MoneyPage nativeHeader><Stack.Screen options={{ title: 'Sample Citizens statement' }} />
    <Text accessibilityRole="header" style={s.title}>Sample Citizens statement</Text>
    <Text style={s.note}>SAMPLE · NOT A REAL ACCOUNT. This synthetic September 2026 PDF has nine transactions and a closing balance of $3,280.54. The examples below match the document.</Text>
    <View style={s.card}><Text style={s.heading}>Synthetic PDF for testing</Text><Text style={s.note}>Previewing or sharing this file does not import it into your real account. If you import the downloaded PDF yourself, it will use the normal confirmation flow.</Text>
      <SubscriptionButton disabled={busy} label={busy ? 'Preparing PDF…' : Platform.OS === 'web' ? 'Prepare sample PDF download' : 'Share sample PDF'} onPress={() => void share()} />
      {download && Platform.OS === 'web' && <a href={download.url} download={download.name} style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: colors.primary }}>Download sample Citizens PDF</a>}
      {!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}
    </View>
    <SampleDataControl /><SampleAccountPreview full />
  </MoneyPage>;
}
