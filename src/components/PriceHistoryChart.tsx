import { colors } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatFuelPrice } from '@/features/stations/logic';
import { graphCoordinates, type HistoryRange, type PriceReportPoint } from '@/features/stations/history';

export function PriceHistoryChart({ reports, range, now }: { reports: PriceReportPoint[]; range: HistoryRange; now: number }) {
  if (reports.length === 0) return null;
  const points = graphCoordinates(reports, range, now);
  const prices = reports.map((report) => report.price);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const latest = reports[reports.length - 1];
  const first = reports[0];
  const startDate = range === 'all' ? new Date(first.reportedAt) : new Date(now - range * 24 * 60 * 60 * 1000);
  const endDate = range === 'all' ? new Date(latest.reportedAt) : new Date(now);
  return (
    <View accessibilityLabel={`${reports.length} price reports. Lowest ${formatFuelPrice(low)}, highest ${formatFuelPrice(high)}, latest ${formatFuelPrice(latest.price)}.`}>
      <View style={styles.axisLabels}><Text style={styles.axisText}>{formatFuelPrice(high)}</Text><Text style={styles.axisText}>HIGH</Text></View>
      <Svg width="100%" height={170} viewBox="0 0 300 170" accessibilityRole="image">
        <Line x1="0" y1="85" x2="300" y2="85" stroke={colors.lineStrong} strokeDasharray="4 5" />
        {points.length > 1 && <Polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={colors.accentDark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point, index) => <Circle key={reports[index].id} cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3} fill={colors.accentDark} />)}
      </Svg>
      <View style={styles.axisLabels}><Text style={styles.axisText}>{formatFuelPrice(low)}</Text><Text style={styles.axisText}>LOW</Text></View>
      <View style={styles.dates}><Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text><Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabels: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  axisText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  dateText: { color: colors.inkSoft, fontSize: 12 },
});
