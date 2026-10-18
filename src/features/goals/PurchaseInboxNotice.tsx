import { Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useThemeRevision } from '@/theme';
import { dataStyles as s } from '@/features/data/styles';
import { usePendingWalletPurchases } from './purchaseInboxBridge';

export function PurchaseInboxNotice() {
  useThemeRevision();
  const { items } = usePendingWalletPurchases();
  const pathname = usePathname();
  if (!items.length || pathname === '/purchase-inbox' || pathname === '/import-purchase') return null;
  return <View style={[s.card, { marginHorizontal: 16, marginBottom: 8 }]}>
    <Text style={s.heading}>Wallet purchases ready to review</Text>
    <Text style={s.note}>{items.length} captured {items.length === 1 ? 'purchase is' : 'purchases are'} waiting. Nothing is added to your account until you save.</Text>
    <Link href="/purchase-inbox" asChild><Pressable accessibilityRole="button" style={s.choice}><Text style={s.choiceText}>Review purchases</Text></Pressable></Link>
  </View>;
}
