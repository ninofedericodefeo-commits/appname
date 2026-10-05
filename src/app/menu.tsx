import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

const menuItems = [
  { href: '/pocket', title: 'Savings pocket', detail: 'See what you have set aside.' },
  { href: '/spending', title: 'Spending Pause', detail: 'Reconsider purchases before you buy.' },
  { href: '/subscriptions', title: 'Subscriptions', detail: 'Review upcoming renewals.' },
  { href: '/activity', title: 'Activity', detail: 'Purchases, set-asides, and past goals.' },
] as const;

export default function MenuScreen() {
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>GASFINDER</Text>
      <Text style={styles.title}>More</Text>
      <Text style={styles.intro}>Your money tools, together in one place.</Text>
      <View style={styles.list}>
        {menuItems.map((item) => <Link key={item.href} href={item.href} asChild>
          <Pressable accessibilityRole="button" style={styles.item}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDetail}>{item.detail}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </Link>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48 },
  eyebrow: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 42, lineHeight: 48, fontWeight: '800', letterSpacing: -1.7, marginTop: 12 },
  intro: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 7, marginBottom: 26 },
  list: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  item: { minHeight: 84, paddingHorizontal: 18, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  itemCopy: { flex: 1 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  itemDetail: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  arrow: { color: colors.accentDark, fontSize: 28, marginLeft: 12 },
});
