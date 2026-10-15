import { useState } from 'react';
import { Text, View } from 'react-native';
import { useReceiptStore } from '@/stores/receiptStore';
import { usePriceReportStore } from '@/stores/priceReportStore';
import { useDriveStore } from '@/stores/driveStore';
import { usePocketStore } from '@/stores/pocketStore';
import { pocketTransactions } from '@/features/pocket/transactions';
import { fuelReports } from './logic';
import { fuelStatistics } from './statistics';
import { formatMoney } from '@/lib/money';
import { dataStyles as s } from '@/features/data/styles';
import Button from '@/features/subscriptions/SubscriptionButton';
export default function FuelStatisticsPanel() {
  const receipts = useReceiptStore(state => state.reports), prices = usePriceReportStore(state => state.reports), cars = useDriveStore(state => state.cars), pocket = usePocketStore();
  const [car, setCar] = useState<string | undefined>();
  const stats = fuelStatistics(fuelReports(receipts, prices), pocketTransactions(pocket.accountTransactions, pocket.purchases, [], [], pocket.transactionDirections), car);
  return <View style={s.card}><Text style={s.heading}>Recorded fuel costs</Text><View style={s.row}><Button label="All cars" tone={car === undefined ? 'primary' : 'secondary'} onPress={() => setCar(undefined)} />{cars.map(item => <Button key={item.id} label={item.name} tone={car === item.id ? 'primary' : 'secondary'} onPress={() => setCar(item.id)} />)}</View><Text style={s.body}>{formatMoney(stats.spentCents)} recorded · {stats.gallons.toFixed(3)} gal{'\n'}{stats.fillCount} refills{stats.weightedUnitPrice !== null ? ` · $${stats.weightedUnitPrice.toFixed(3)}/gal including adjustments` : ''}</Text><Text style={s.note}>From saved fuel reports only. Linked duplicates count once; these costs are not added again to Account spending. {stats.missingTotals} missing totals · {stats.missingGallons} missing gallons · {stats.unlinkedCount} unlinked refills.</Text>{stats.duplicateLinkedReports > 0 && <Text style={s.note}>{stats.duplicateLinkedReports} duplicate linked reports excluded from cost totals.</Text>}{car && <Text style={s.note}>{stats.measuredMpg === null ? 'For measured MPG, record two full tanks with odometers and confirm that every intervening refill is logged.' : `${stats.measuredMpg.toFixed(1)} measured MPG across ${stats.segments.length} complete recorded interval${stats.segments.length === 1 ? '' : 's'} (${stats.measuredMiles.toFixed(0)} miles). This does not change your car’s planning estimate.`}</Text>}</View>;
}
