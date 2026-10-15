import { Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { receiptReadingAvailable } from '../receipts/recognition';
import { dataStyles as s } from './styles';
export default function BuildCapabilities() {
  const extra = Constants.expoConfig?.extra;
  return <View style={s.card}><Text style={s.heading}>This build</Text><Text style={s.body}>{process.env.EXPO_PUBLIC_BUILD_TRACK ?? 'local development'} · {Platform.OS}</Text><Text style={s.note}>File opening: {Platform.OS === 'web' ? 'file picker in browser' : 'configured; verify with Citizens share'}{'\n'}Receipt OCR: {receiptReadingAvailable ? 'module available; review recognition results' : 'native rebuild required'}{'\n'}Safari checkout extension: {Platform.OS === 'ios' ? 'check enabled status in Spending pause setup' : 'iPhone only; desktop Chrome package available'}{'\n'}Widgets: {extra?.goalWidgetAvailable ? 'capability enabled; signing/device verification required' : 'disabled for this build'}{'\n'}Direct iOS share extension: {extra?.mapsShareAvailable ? 'capability enabled' : 'use the statement shortcut'}{'\n'}Phone reminders: {Platform.OS === 'web' ? 'unavailable here' : 'local scheduling; check notification permission'}{'\n'}Updates: bundled with each native installation; no remote update service configured.</Text><Text style={s.note}>Capability configuration is not proof of device acceptance. A release build bundles its JavaScript and assets; cold launch without Metro must still be tested.</Text></View>;
}
