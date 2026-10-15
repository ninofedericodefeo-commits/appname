import { useEffect, useState } from 'react';
import { Image, Platform, Text } from 'react-native';
import { resolveReceiptPhoto } from './photoStorage';
import { dataStyles as s } from '@/features/data/styles';
export default function ReceiptPhoto({ uri, label }: { uri: string; label: string }) {
  const [resolved, setResolved] = useState(''), [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true, local = '';
    void resolveReceiptPhoto(uri).then(value => { local = value; if (active) { setResolved(value); setMissing(false); } else if (Platform.OS === 'web' && value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(() => { if (active) setMissing(true); });
    return () => { active = false; if (Platform.OS === 'web' && local.startsWith('blob:')) URL.revokeObjectURL(local); };
  }, [uri]);
  if (missing) return <Text style={s.note}>Receipt photo is unavailable. You can attach it again.</Text>;
  return resolved ? <Image source={{ uri: resolved }} accessibilityLabel={label} resizeMode="contain" style={{ height: 220, width: '100%' }} onError={() => setMissing(true)} /> : null;
}
