import { StyleSheet, Text, View } from 'react-native';

import type { FuelType, GasStation } from '@/types/stations';
import { priceDescription } from '@/features/stations/data';

export function GasStationCard({
  station,
  fuelType,
  isCheapest,
  isDemo,
  now,
}: {
  station: GasStation;
  fuelType: FuelType;
  isCheapest?: boolean;
  isDemo: boolean;
  now: number;
}) {
  const price = station.prices.find((item) => item.fuelType === fuelType);

  return (
    <View style={[styles.card, isCheapest && styles.cheapestCard]}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.name}>{station.name}</Text>
          <Text style={styles.address}>{station.address}</Text>
          <Text style={styles.meta}>{station.distanceMiles?.toFixed(1) ?? '?'} mi · {priceDescription(price, isDemo, now)}</Text>
        </View>

        <View style={styles.priceCol}>
          <Text style={styles.price}>{price ? `$${price.price.toFixed(2)}` : '—'}</Text>
          <Text style={styles.priceLabel}>/gal</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8ebef',
    marginBottom: 12,
  },
  cheapestCard: {
    borderColor: '#4f8cff',
    backgroundColor: '#eef4ff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1f',
  },
  address: {
    marginTop: 4,
    fontSize: 13,
    color: '#5f6470',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: '#7a7f89',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  priceLabel: {
    fontSize: 12,
    color: '#7b8190',
  },
});
