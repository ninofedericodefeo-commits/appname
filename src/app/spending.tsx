import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePurchasePauseStore } from '@/stores/purchasePauseStore';
import type { PurchasePauseDelayHours, SpendingPauseHours } from '@/stores/purchasePauseStore';
import type { SpendingCategory } from '@/types/spending';

const delays: { hours: PurchasePauseDelayHours; label: string }[] = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '2 days' },
  { hours: 168, label: '7 days' },
];
const spendingPauseDurations: { hours: SpendingPauseHours; label: string }[] = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '1 day' },
  { hours: 168, label: '7 days' },
];

function formatTimeRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function SpendingScreen() {
  const {
    enabled,
    delayHours,
    items,
    pauseEndsAt,
    spendingChecks,
    familyMembers,
    familyRequests,
    setEnabled,
    setDelayHours,
    addPurchase,
    recordOutcome,
    startSpendingPause,
    endSpendingPause,
    checkDemoPurchase,
    addFamilyMember,
    setFamilyLimit,
    addFamilyRequest,
    decideFamilyRequest,
  } = usePurchasePauseStore();
  const [purchaseName, setPurchaseName] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [error, setError] = useState('');
  const [checkName, setCheckName] = useState('');
  const [checkAmount, setCheckAmount] = useState('');
  const [checkCategory, setCheckCategory] = useState<SpendingCategory>('discretionary');
  const [checkError, setCheckError] = useState('');
  const [checkFeedback, setCheckFeedback] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberLimit, setMemberLimit] = useState('50');
  const [familyError, setFamilyError] = useState('');
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, { description: string; amount: string }>>({});
  const [requestFeedback, setRequestFeedback] = useState<Record<string, string>>({});
  const [now, setNow] = useState<number | null>(null);
  const waitingItems = items.filter((item) => item.status === 'waiting');
  const skippedItems = items.filter((item) => item.status === 'skipped');
  const reportedAvoidedTotal = skippedItems.reduce((total, item) => total + item.amount, 0);
  const currentTime = now ?? 0;
  const activePause = pauseEndsAt !== null && currentTime > 0 && pauseEndsAt > currentTime;
  const pendingFamilyRequests = familyRequests.filter((request) => request.status === 'pending');

  function runDemoPurchaseCheck() {
    const amount = Number(checkAmount);
    if (!checkName.trim()) {
      setCheckError('Add a name for this test purchase.');
      return;
    }
    if (!checkAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setCheckError('Enter an amount greater than $0.');
      return;
    }
    const outcome = checkDemoPurchase(checkName, amount, checkCategory);
    setCheckFeedback(
      outcome === 'paused'
        ? 'The discretionary purchase was marked paused in the demo.'
        : outcome === 'bill-exempt'
          ? 'The automatic payment or bill was marked exempt in the demo.'
          : 'The discretionary purchase was marked allowed because no pause is active.',
    );
    setCheckName('');
    setCheckAmount('');
    setCheckError('');
  }

  function saveFamilyMember() {
    const limit = Number(memberLimit);
    if (!memberName.trim()) {
      setFamilyError('Enter a name for the child or teen profile.');
      return;
    }
    if (!memberLimit.trim() || !Number.isFinite(limit) || limit <= 0) {
      setFamilyError('Enter a weekly limit greater than $0.');
      return;
    }
    addFamilyMember(memberName, limit);
    setMemberName('');
    setMemberLimit('50');
    setFamilyError('');
  }

  function submitFamilyRequest(memberId: string) {
    const draft = requestDrafts[memberId] ?? { description: '', amount: '' };
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !draft.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setRequestFeedback((current) => ({ ...current, [memberId]: 'Enter a purchase description and amount above $0.' }));
      return;
    }
    addFamilyRequest(memberId, draft.description, amount);
    setRequestDrafts((current) => ({ ...current, [memberId]: { description: '', amount: '' } }));
    setRequestFeedback((current) => ({ ...current, [memberId]: 'Demo approval request added.' }));
  }

  function respondToRequest(requestId: string, memberId: string, decision: 'approved' | 'denied') {
    const succeeded = decideFamilyRequest(requestId, decision);
    if (!succeeded) {
      setRequestFeedback((current) => ({
        ...current,
        [memberId]: 'This request exceeds the remaining weekly demo limit. Adjust the limit or deny the request.',
      }));
      return;
    }
    setRequestFeedback((current) => ({
      ...current,
      [memberId]: decision === 'approved' ? 'Approved in the demo; no purchase was made.' : 'Declined in the demo.',
    }));
  }

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const initialTimer = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, 60_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  function savePurchase() {
    const amount = Number(purchaseAmount);
    const name = purchaseName.trim();
    if (!name) {
      setError('Add a short name for the purchase.');
      return;
    }
    if (!purchaseAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter an estimated amount greater than $0.');
      return;
    }

    addPurchase(name, amount);
    setPurchaseName('');
    setPurchaseAmount('');
    setError('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Spending pause</Text>
          <Link href="/investment" asChild>
            <Pressable style={styles.navButton} accessibilityRole="button">
              <Text style={styles.navButtonText}>Investing</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>LOCAL DEMO · DOES NOT CONTROL OTHER APPS</Text>
          <Text style={styles.cardTitle}>Pause discretionary spending</Text>
          <Text style={styles.description}>
            Choose a pause duration, then use the demo checker to see how a discretionary purchase would be treated. This does not block real purchases or monitor your phone. Automatic payments and bills are always marked exempt here.
          </Text>
          {activePause ? (
            <View style={styles.pauseStatus}>
              <Text style={styles.pauseStatusTitle}>Demo pause is active</Text>
              <Text style={styles.pauseStatusText}>Ends {new Date(pauseEndsAt ?? 0).toLocaleString()}</Text>
              <Text style={styles.pauseStatusText}>{formatTimeRemaining((pauseEndsAt ?? 0) - currentTime)}</Text>
              <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={endSpendingPause}>
                <Text style={styles.outlineButtonText}>End pause now</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Pause length</Text>
              <View style={styles.row}>
                {spendingPauseDurations.map((duration) => (
                  <Choice
                    key={duration.hours}
                    label={duration.label}
                    selected={false}
                    onPress={() => startSpendingPause(duration.hours)}
                  />
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>Check a purchase (demo only)</Text>
          <TextInput
            value={checkName}
            onChangeText={setCheckName}
            placeholder="Purchase description"
            accessibilityLabel="Demo purchase description"
            maxLength={80}
            style={styles.input}
          />
          <TextInput
            value={checkAmount}
            onChangeText={setCheckAmount}
            placeholder="Amount"
            accessibilityLabel="Demo purchase amount"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <View style={styles.row}>
            <Choice
              label="Discretionary"
              selected={checkCategory === 'discretionary'}
              onPress={() => setCheckCategory('discretionary')}
            />
            <Choice
              label="Automatic payment / bill"
              selected={checkCategory === 'automatic-payment'}
              onPress={() => setCheckCategory('automatic-payment')}
            />
          </View>
          {checkError ? <Text accessibilityRole="alert" style={styles.error}>{checkError}</Text> : null}
          {checkFeedback ? <Text style={styles.feedback}>{checkFeedback}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={runDemoPurchaseCheck}>
            <Text style={styles.primaryButtonText}>Check demo purchase</Text>
          </Pressable>
          {spendingChecks.slice(0, 5).map((check) => (
            <View key={check.id} style={styles.historyRow}>
              <View style={styles.purchaseDetails}>
                <Text style={styles.purchaseName}>{check.name}</Text>
                <Text style={styles.dateText}>
                  {check.category === 'automatic-payment' ? 'Automatic payment / bill · exempt' : 'Discretionary'} ·{' '}
                  {new Date(check.createdAt).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.purchasePrice, check.outcome === 'paused' && styles.blockedText]}>
                {check.outcome === 'paused' ? 'Paused' : check.outcome === 'bill-exempt' ? 'Exempt' : 'Allowed'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>FAMILY DEMO · NOT A REAL PURCHASE CONTROL</Text>
          <Text style={styles.cardTitle}>Family spending limits</Text>
          <Text style={styles.description}>
            Create local child/teen profiles, set a weekly demo budget, and review simulated purchase requests. This prototype has no linked child accounts, identity checks, notifications, or OS/app-store/payment controls.
          </Text>
          <TextInput
            value={memberName}
            onChangeText={setMemberName}
            placeholder="Child or teen profile name"
            accessibilityLabel="Child or teen profile name"
            maxLength={50}
            style={styles.input}
          />
          <TextInput
            value={memberLimit}
            onChangeText={setMemberLimit}
            placeholder="Weekly spending limit"
            accessibilityLabel="Weekly spending limit"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          {familyError ? <Text accessibilityRole="alert" style={styles.error}>{familyError}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={saveFamilyMember}>
            <Text style={styles.primaryButtonText}>Add demo profile</Text>
          </Pressable>

          {familyMembers.length === 0 ? (
            <Text style={styles.dateText}>No family profiles yet. Profiles and budgets stay on this device.</Text>
          ) : null}
          {familyMembers.map((member) => {
            const approvedTotal = familyRequests
              .filter(
                (request) =>
                  request.memberId === member.id &&
                  request.status === 'approved' &&
                  (request.decidedAt ?? request.createdAt) >= currentTime - 7 * 24 * 60 * 60 * 1000,
              )
              .reduce((total, request) => total + request.amount, 0);
            const memberRequests = familyRequests.filter((request) => request.memberId === member.id);
            const limitDraft = limitDrafts[member.id] ?? String(member.weeklyLimit);
            const requestDraft = requestDrafts[member.id] ?? { description: '', amount: '' };

            return (
              <View key={member.id} style={styles.familyMember}>
                <Text style={styles.memberTitle}>{member.name}</Text>
                <Text style={styles.dateText}>
                  Approved in the last 7 days: ${approvedTotal.toFixed(2)} of ${member.weeklyLimit.toFixed(2)} demo limit
                </Text>
                <View style={styles.row}>
                  <TextInput
                    value={limitDraft}
                    onChangeText={(value) => setLimitDrafts((current) => ({ ...current, [member.id]: value }))}
                    accessibilityLabel={`${member.name} weekly limit`}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.flexInput]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    style={styles.outlineButton}
                    onPress={() => {
                      const limit = Number(limitDraft);
                      if (Number.isFinite(limit) && limit > 0) {
                        setFamilyLimit(member.id, limit);
                        setRequestFeedback((current) => ({ ...current, [member.id]: 'Weekly demo limit updated.' }));
                      } else {
                        setRequestFeedback((current) => ({ ...current, [member.id]: 'Weekly limit must be greater than $0.' }));
                      }
                    }}
                  >
                    <Text style={styles.outlineButtonText}>Save limit</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Add a simulated purchase request</Text>
                <TextInput
                  value={requestDraft.description}
                  onChangeText={(description) =>
                    setRequestDrafts((current) => ({
                      ...current,
                      [member.id]: { ...requestDraft, description },
                    }))
                  }
                  placeholder="What do they want to buy?"
                  accessibilityLabel={`${member.name} purchase request description`}
                  maxLength={80}
                  style={styles.input}
                />
                <TextInput
                  value={requestDraft.amount}
                  onChangeText={(amount) =>
                    setRequestDrafts((current) => ({
                      ...current,
                      [member.id]: { ...requestDraft, amount },
                    }))
                  }
                  placeholder="Amount"
                  accessibilityLabel={`${member.name} purchase request amount`}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                {requestFeedback[member.id] ? <Text style={styles.feedback}>{requestFeedback[member.id]}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  style={styles.outlineButton}
                  onPress={() => submitFamilyRequest(member.id)}
                >
                  <Text style={styles.outlineButtonText}>Submit demo request</Text>
                </Pressable>

                {memberRequests.map((request) => (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.purchaseHeading}>
                      <View style={styles.purchaseDetails}>
                        <Text style={styles.purchaseName}>{request.description}</Text>
                        <Text style={styles.dateText}>
                          ${request.amount.toFixed(2)} · {request.status} · {new Date(request.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    {request.status === 'pending' ? (
                      <View style={styles.row}>
                        <Pressable
                          accessibilityRole="button"
                          style={styles.outlineButton}
                          onPress={() => respondToRequest(request.id, member.id, 'approved')}
                        >
                          <Text style={styles.outlineButtonText}>Approve demo request</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={styles.outlineButton}
                          onPress={() => respondToRequest(request.id, member.id, 'denied')}
                        >
                          <Text style={styles.outlineButtonText}>Decline</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}
          {pendingFamilyRequests.length > 0 ? (
            <Text style={styles.dateText}>{pendingFamilyRequests.length} simulated request(s) awaiting parent review.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>OPTIONAL · ON THIS DEVICE</Text>
          <Text style={styles.cardTitle}>Pause before an online purchase</Text>
          <Text style={styles.description}>
            Add something you are considering buying, then give yourself time to decide. This is a reminder and personal tracker only: it does not monitor your accounts or block checkout.
          </Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled }}
            style={[styles.toggle, enabled && styles.toggleEnabled]}
            onPress={() => setEnabled(!enabled)}
          >
            <Text style={[styles.toggleText, enabled && styles.toggleTextEnabled]}>
              {enabled ? 'Pause reminders on' : 'Turn on pause reminders'}
            </Text>
          </Pressable>
          {enabled && (
            <>
              <Text style={styles.label}>Cooling-off period</Text>
              <View style={styles.row}>
                {delays.map((delay) => (
                  <Choice
                    key={delay.hours}
                    label={delay.label}
                    selected={delayHours === delay.hours}
                    onPress={() => setDelayHours(delay.hours)}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {enabled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a purchase to pause</Text>
            <TextInput
              value={purchaseName}
              onChangeText={setPurchaseName}
              placeholder="What are you thinking of buying?"
              accessibilityLabel="Purchase description"
              maxLength={80}
              style={styles.input}
            />
            <TextInput
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              placeholder="Estimated price"
              accessibilityLabel="Estimated purchase price"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={savePurchase}>
              <Text style={styles.primaryButtonText}>Start cooling-off period</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>You reported skipping</Text>
          <Text style={styles.summaryAmount}>${reportedAvoidedTotal.toFixed(2)}</Text>
          <Text style={styles.summaryNote}>
            User-reported estimate from {skippedItems.length} skipped purchase{skippedItems.length === 1 ? '' : 's'}; this is not verified savings.
          </Text>
        </View>

        {waitingItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Still considering</Text>
            {waitingItems.map((item) => {
              const remaining = item.reviewAt - (now ?? item.createdAt);
              const ready = remaining <= 0;
              return (
                <View key={item.id} style={styles.purchaseItem}>
                  <View style={styles.purchaseHeading}>
                    <View style={styles.purchaseDetails}>
                      <Text style={styles.purchaseName}>{item.name}</Text>
                      <Text style={styles.purchasePrice}>${item.amount.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statusBubble, ready && styles.statusReady]}>
                      <Text style={[styles.statusText, ready && styles.statusReadyText]}>
                        {ready ? 'Ready to review' : formatTimeRemaining(remaining)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dateText}>
                    Review after {new Date(item.reviewAt).toLocaleString()}
                  </Text>
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineButton}
                      onPress={() => recordOutcome(item.id, 'skipped')}
                    >
                      <Text style={styles.outlineButtonText}>I skipped it</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineButton}
                      onPress={() => recordOutcome(item.id, 'bought')}
                    >
                      <Text style={styles.outlineButtonText}>I bought it</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {items.some((item) => item.status !== 'waiting') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed decisions</Text>
            {items
              .filter((item) => item.status !== 'waiting')
              .map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.purchaseDetails}>
                    <Text style={styles.purchaseName}>{item.name}</Text>
                    <Text style={styles.dateText}>
                      {item.status === 'skipped' ? 'You reported skipping' : 'You reported buying'} ·{' '}
                      {new Date(item.outcomeAt ?? item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.purchasePrice}>${item.amount.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f5f7' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#111827', fontSize: 28, fontWeight: '800' },
  navButton: { backgroundColor: '#111827', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  navButtonText: { color: '#ffffff', fontWeight: '700' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e7ebf0' },
  eyebrow: { color: '#4f46e5', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginTop: 4 },
  description: { color: '#5f6470', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 10 },
  toggle: { borderRadius: 12, padding: 13, backgroundColor: '#f3f4f6', alignItems: 'center', marginTop: 5 },
  toggleEnabled: { backgroundColor: '#4f46e5' },
  toggleText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  toggleTextEnabled: { color: '#ffffff' },
  pauseStatus: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 13, padding: 13, gap: 5 },
  pauseStatusTitle: { color: '#9a3412', fontSize: 15, fontWeight: '800' },
  pauseStatusText: { color: '#7c2d12', fontSize: 12 },
  feedback: { color: '#166534', fontSize: 12, lineHeight: 17, marginTop: 8 },
  label: { color: '#4b5563', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9 },
  choice: { borderRadius: 999, borderWidth: 1, borderColor: '#d5dbe4', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  choiceSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: '#ffffff' },
  input: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#d5dbe4', paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 10 },
  primaryButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 7 },
  summaryCard: { backgroundColor: '#eef2ff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#c7d2fe' },
  summaryLabel: { color: '#4338ca', fontSize: 13, fontWeight: '700' },
  summaryAmount: { color: '#312e81', fontSize: 32, fontWeight: '800', marginTop: 4 },
  summaryNote: { color: '#4b5563', fontSize: 12, lineHeight: 17, marginTop: 4 },
  purchaseItem: { borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 12, marginTop: 12 },
  purchaseHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  purchaseDetails: { flex: 1 },
  purchaseName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  purchasePrice: { color: '#111827', fontSize: 14, fontWeight: '700' },
  statusBubble: { backgroundColor: '#fff7ed', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9 },
  statusReady: { backgroundColor: '#dcfce7' },
  statusText: { color: '#9a3412', fontSize: 11, fontWeight: '700' },
  statusReadyText: { color: '#166534' },
  dateText: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  outlineButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexGrow: 1, alignItems: 'center' },
  outlineButtonText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 12, marginTop: 12 },
  blockedText: { color: '#b42318' },
  familyMember: { borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 14, marginTop: 14, gap: 4 },
  memberTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },
  flexInput: { flex: 1 },
  requestItem: { borderTopWidth: 1, borderTopColor: '#edf0f3', paddingTop: 10, marginTop: 10 },
});
