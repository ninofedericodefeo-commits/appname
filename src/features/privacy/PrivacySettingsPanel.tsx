import { useAmountVisibility } from '@/features/preferences/amountVisibility';
import { useThemeRevision } from '@/theme';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useDevicePrivacy, usePrivacySession } from './deviceStore';
import { authenticateDevice } from './authenticate';
import { dataStyles as s } from '@/features/data/styles';
export default function PrivacySettingsPanel() {
  useThemeRevision();
  const { enabled, hidePreview, hideAmounts, relockSeconds, configure } = useDevicePrivacy();
  const warning = usePrivacySession(state => state.warning);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function toggleLock() {
    setBusy(true); setError('');
    try { await authenticateDevice(); configure({ enabled: !enabled }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change the app lock.'); }
    finally { setBusy(false); }
  }
  return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Device protection</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: hideAmounts }} aria-checked={hideAmounts} style={s.choice} onPress={() => { useAmountVisibility.setState({ revealed: false }); configure({ hideAmounts: !hideAmounts }); }}><Text style={s.choiceText}>{hideAmounts ? '✓ Hide financial amounts on open' : 'Hide financial amounts on open'}</Text></Pressable><Text style={s.note}>Tap Show amounts to reveal financial screens for this session. Amounts hide again when you leave the app. This is display privacy; exports, saved records and widget visibility use their own controls.</Text><Text style={s.note}>The optional lock uses your phone’s authentication. It does not encrypt the local ledger; encrypted backup files have their own password. Widget amounts are controlled separately.</Text>
    {Platform.OS === 'web' ? <Text style={s.note}>Device authentication and app-switcher protection need the native phone app. This browser’s data can be accessed by other users of the same browser profile.</Text> : <>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} aria-checked={enabled} style={s.choice} disabled={busy} onPress={() => void toggleLock()}><Text style={s.choiceText}>{enabled ? '✓ App lock on' : 'Enable app lock'}</Text></Pressable>
      {enabled && <View style={s.row}>{[0, 60, 300].map(seconds => <Pressable accessibilityRole="button" accessibilityState={{ selected: relockSeconds === seconds }} key={seconds} style={[s.choice, relockSeconds === seconds && s.selected]} onPress={() => configure({ relockSeconds: seconds })}><Text style={s.choiceText}>{seconds === 0 ? 'Lock immediately' : `${seconds / 60} min away`}</Text></Pressable>)}</View>}
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: hidePreview }} aria-checked={hidePreview} style={s.choice} onPress={() => configure({ hidePreview: !hidePreview })}><Text style={s.choiceText}>{hidePreview ? '✓ Hide app-switcher preview' : 'Hide app-switcher preview'}</Text></Pressable>
      {Platform.OS === 'android' && <Text style={s.note}>Android preview protection also disables screenshots and screen recording while enabled.</Text>}
    </>}{!!error && <Text accessibilityRole="alert" style={s.danger}>{error}</Text>}{!!warning && <Text style={s.danger}>{warning}</Text>}
  </View>;
}
