import { colors } from '@/theme';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const steps = [
  'Open Shortcuts on your iPhone. In Automation, create a Transaction automation and choose the Apple Pay card you tap with.',
  'Choose Run Immediately. Add a URL action. Start it with gasfinder://import-purchase?amount= and insert the transaction Amount variable.',
  'Add &merchant= and the transaction Merchant variable. URL-encode Merchant with a URL Encode action so names containing spaces or & work.',
  'Add Open URLs after the URL action. Save the automation, then test it with a real supported card tap.',
];

export default function PurchaseAutomationScreen() {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>OPTIONAL AUTOMATION</Text>
    <Text style={styles.title}>Log Apple Pay taps</Text>
    <Text style={styles.body}>GasFinder can receive the amount and merchant from an iPhone Shortcuts transaction automation. When the link opens this app, it logs the purchase and applies your goal’s set-aside rule to the pocket estimate.</Text>
    {Platform.OS !== 'ios' && <View style={styles.notice}><Text style={styles.body}>This automation is set up on an iPhone. Manual purchase logging works on this device.</Text></View>}
    {steps.map((step, index) => <View key={step} style={styles.step}><Text style={styles.number}>{index + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
    <View style={styles.notice}><Text style={styles.noticeTitle}>What it covers</Text><Text style={styles.body}>Apple’s Transaction trigger runs for selected Wallet card taps. It does not capture every online purchase, cash purchase, or a physical card swipe. Shortcuts must be configured by you, and an invalid or duplicate link will not change the pocket. The pocket is still an estimate; no money moves.</Text></View>
    <Text style={styles.body}>If you are testing with an Expo development build, open GasFinder before testing the link. A standalone installed build is needed for the link to reliably launch it from a closed state.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 50, gap: 15 },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800' },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  step: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 16 },
  number: { color: colors.accentDark, fontSize: 19, fontWeight: '800' },
  stepText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21 },
  notice: { backgroundColor: colors.paleGreen, borderRadius: 9, padding: 16, gap: 5 },
  noticeTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
});
