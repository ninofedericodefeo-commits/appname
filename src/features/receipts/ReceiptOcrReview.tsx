import { useThemeRevision } from '@/theme';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { readReceiptText, receiptReadingAvailable } from './recognition';
import { receiptTextCandidates } from './textCandidates';
import type { ReceiptCandidates } from './textCandidates';
import { dataStyles as s } from '@/features/data/styles';
import Button from '@/features/subscriptions/SubscriptionButton';
const names = { stationName: 'Station', price: 'Price per gallon', gallons: 'Gallons', total: 'Total', observedOn: 'Observation date', fuelType: 'Fuel' };
export default function ReceiptOcrReview({ uri, current, onApply }: { uri: string; current: Record<string, string>; onApply: (values: Record<string, string>) => void }) {
  useThemeRevision();
  const [job, setJob] = useState<{ uri: string; values: ReceiptCandidates; selected: string[] } | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const generation = useRef(0);
  useEffect(() => { const counter = generation; counter.current++; return () => { counter.current++; }; }, [uri]);
  async function read() {
    const request = ++generation.current; setBusy(true); setMessage('');
    try {
      const candidates = receiptTextCandidates(await readReceiptText(uri));
      if (request !== generation.current) return;
      setJob({ uri, values: candidates, selected: Object.keys(candidates).filter(key => !current[key]) });
      if (!Object.keys(candidates).length) setMessage('No clear receipt values were found. Your photo and draft are still available for manual entry.');
    } catch (cause) { if (request === generation.current) setMessage(cause instanceof Error ? cause.message : 'Could not read this photo. Enter the details manually.'); }
    finally { if (request === generation.current) setBusy(false); }
  }
  return <View style={{ gap: 10 }}><Button label={busy ? 'Reading on device…' : 'Read receipt on device'} disabled={busy || !receiptReadingAvailable} onPress={() => void read()} />{!receiptReadingAvailable && <Text style={s.note}>Receipt reading is available in a native build with the text recognition module. Manual entry works here.</Text>}
    {job?.uri === uri && !!Object.keys(job.values).length && <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Review suggested values</Text><Text style={s.note}>Select the values to use. Select a replacement explicitly to change an existing entry. Check the photo and arithmetic before saving.</Text>{Object.entries(job.values).map(([key, item]) => <Pressable key={key} accessibilityRole="checkbox" accessibilityLabel={`Use suggested ${names[key as keyof typeof names]} ${item!.value}`} accessibilityState={{ checked: job.selected.includes(key) }} aria-checked={job.selected.includes(key)} style={[s.choice, job.selected.includes(key) && s.selected]} onPress={() => setJob({ ...job, selected: job.selected.includes(key) ? job.selected.filter(value => value !== key) : [...job.selected, key] })}><Text style={s.choiceText}>{job.selected.includes(key) ? '✓ ' : ''}{names[key as keyof typeof names]}: {item!.value}{item!.uncertain ? ' · check closely' : ''}</Text>{!!current[key] && <Text style={s.note}>Current: {current[key]}</Text>}</Pressable>)}<Button label="Use selected suggestions" tone="primary" disabled={!job.selected.length} onPress={() => { onApply(Object.fromEntries(job.selected.map(key => [key, job.values[key as keyof ReceiptCandidates]!.value]))); setJob(null); setMessage('Suggestions copied to the form. Review everything before saving.'); }} /><Button label="Keep my entries" onPress={() => setJob(null)} /></View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.note}>{message}</Text>}
  </View>;
}
