import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FuelType, GasStation } from '@/types/stations';

function getPriceForFuel(station: GasStation, fuelType: FuelType) {
  return station.prices.find((price) => price.fuelType === fuelType)?.price ?? null;
}

function getFreshnessText(reportedAt: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(reportedAt).getTime()) / 60000));
  return `Updated ${minutes}m ago`;
}

export function GasStationCard({
  station,
  fuelType,
  isCheapest,
}: {
  station: GasStation;
  fuelType: FuelType;
  isCheapest?: boolean;
}) {
  const price = getPriceForFuel(station, fuelType);

  return (
    <Pressable style={[styles.card, isCheapest && styles.cheapestCard]}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.name}>{station.name}</Text>
          <Text style={styles.address}>{station.address}</Text>
          <Text style={styles.meta}>{station.distanceMiles?.toFixed(1) ?? '0.0'} mi • {getFreshnessText(station.prices[0]?.reportedAt ?? new Date().toISOString())}</Text>
        </View>

        <View style={styles.priceCol}>
          <Text style={styles.price}>${price?.toFixed(2) ?? 'N/A'}</Text>
          <Text style={styles.priceLabel}>/gal</Text>
        </View>
      </View>
    </Pressable>
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
