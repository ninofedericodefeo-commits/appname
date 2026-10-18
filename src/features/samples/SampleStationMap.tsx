import { router } from 'expo-router';
import { View } from 'react-native';
import StationMap from '@/components/StationMap';
import { isDarkTheme, colors, themedStyles, useThemeRevision } from '@/theme';
import type { FuelType } from '@/types/stations';
import { sampleStationPins } from './stations';
import { useSampleDataStore } from './store';

export default function SampleStationMap({ fuelType = 'regular', selectedId }: { fuelType?: FuelType; selectedId?: string }) {
  useThemeRevision();
  const visible = useSampleDataStore(state => state.visible);
  if (!visible) return null;
  return <View style={styles.frame}>
    <StationMap pins={sampleStationPins(visible, fuelType)} center={null} selectedId={selectedId}
      dark={isDarkTheme()} height={280}
      onSelect={async id => { router.push({ pathname: '/sample-station', params: { id } }); }}
      dom={{ useExpoDOMWebView: false, style: { height: 280 }, scrollEnabled: false, userAgent: 'GasFinder/1.0 (com.anonymous.gasfinder)' }} />
  </View>;
}

const styles = themedStyles(() => ({
  frame: { height: 280, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
}));
