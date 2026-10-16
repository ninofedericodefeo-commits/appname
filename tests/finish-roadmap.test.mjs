import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { manualCredit, manualMovementDate } from '../src/features/pocket/manualMovement.ts';
import { accountBalanceEstimate, manualBalanceSnapshot } from '../src/features/pocket/balanceEstimate.ts';
import { pocketTransactions, mergeAccountTransactions } from '../src/features/pocket/transactions.ts';
import { historyDateRange, monthlyBudgetPeriod } from '../src/features/pocket/dateRanges.ts';
import { upcomingReminderGroups } from '../src/features/subscriptions/logic.ts';
import { spendingSummary } from '../src/features/insights/logic.ts';
import { annotateRows, filterHistory } from '../src/features/pocket/repository.ts';
import { completeErasure } from '../src/features/data/erasure.ts';
import { validateBackup, encryptBackup, decryptBackup } from '../src/features/data/backupFormat.ts';
import { validateStoreState } from '../src/features/data/validation.ts';
import { startBatch, clearBatch, chooseBatchBalance, batchDecisionMade, batchBalanceAllowed, updateBatch, getBatch, configureBatchStorage, resumeBatch } from '../src/features/bank/batch.ts';
const now = new Date(2026,9,15,12), day = '2026-10-15';
const id = n => `account-${n.toString(16).padStart(16,'0')}`;
const credit = (n,kind='deposit') => manualCredit(id(n),'Synthetic refund',1234,day,kind,{nickname:'Checking'},now);
const state = { reportedBalanceCents: 10000, balanceUpdatedAt: new Date(2026,9,15,11).toISOString(), balanceAsOf: day, balanceSource:'manual', balanceIncludedTransactionIds:[], accountTransactions:[],purchases:[],reservedCents:0 };
test('manual deposits and refunds keep signed cents, source dates and classifications', () => {
 const deposit = credit(1), refund = credit(2,'refund');
 const rows = pocketTransactions([deposit,refund],[]);
 assert.equal(rows.length,2); assert.equal(rows[0].amountCents,1234); assert.equal(deposit.source,'manual');
 const summary = spendingSummary(rows,day,day);
 assert.equal(summary.incomeCents,1234);assert.equal(summary.refundCents,1234);assert.equal(summary.spendingCents,0);
 const estimate = accountBalanceEstimate({...state,accountTransactions:[deposit,refund]});
 assert.equal(estimate.estimatedCents,12468);assert.equal(estimate.depositsCents,2468);
});
test('manual movement date rejects rollovers/future days and uses actual current time for today', () => {
 assert.equal(manualMovementDate(day,now),now.toISOString());
 for(const invalid of ['2026-02-30','2026-10-16','x'])assert.throws(()=>manualMovementDate(invalid,now));
 assert.equal(manualMovementDate('2026-10-14',now).slice(0,10),'2026-10-14');
 for(const cents of [-1,0,1.1,100000001]) assert.throws(()=>manualCredit(id(1),'Test',cents,day,'deposit',{nickname:'Checking'},now));
});
test('a checked balance includes known manual credits once, without repeating contributions', () => {
 const deposit=credit(1), live={...state,accountTransactions:[deposit]};
 const snapshot=manualBalanceSnapshot(live,11234,new Date(2026,9,15,13));
 assert.equal(accountBalanceEstimate({...live,...snapshot}).estimatedCents,11234);
 assert.equal(live.reservedCents,0);assert.equal(live.purchases.length,0);
 const once=mergeAccountTransactions([], [deposit],now), again=mergeAccountTransactions(once.transactions,[deposit],now);
 assert.equal(again.added,0);assert.equal(again.transactions.length,1);
});
test('date presets respect leap years, year boundaries and inclusive 30 day spans', () => {
 assert.deepEqual(historyDateRange('last-month',new Date(2024,2,10)),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(historyDateRange('last-month',new Date(2026,0,15)),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(historyDateRange('last-30',new Date(2026,9,15)),{from:'2026-09-16',to:'2026-10-15'});
 assert.deepEqual(historyDateRange('this-month',now),{from:'2026-10-01',to:day});
});
test('budget percentages only compare a full month or the current month to date', () => {
 assert.equal(monthlyBudgetPeriod('2026-10-01',day,now),true);
 assert.equal(monthlyBudgetPeriod('2026-09-01','2026-09-30',now),true);
 for(const [from,to] of [['2026-09-01','2026-09-15'],['2026-09-16',day],['2026-02-01','2026-02-30'],['2026-10-02',day]])assert.equal(monthlyBudgetPeriod(from,to,now),false);
});
const sub = extra => ({id:'sub',name:'Synthetic renewal',amountCents:999,active:true,cadence:'monthly',day:20,month:1,...extra});
test('reminder hour and lead affect renewals without scheduling test samples', () => {
 const groups=upcomingReminderGroups([sub(),sub({id:'sample',isSample:true})],now,{hour:18,leadDays:3});
 assert.equal(groups[0].at.getHours(),18);assert.equal(groups[0].at.getDate(),17);assert.deepEqual(groups[0].names,['Synthetic renewal']);
 const sameDay=upcomingReminderGroups([sub()],now,{hour:8,leadDays:0});assert.equal(sameDay[0].at.getDate(),20);
 for(const options of [{hour:24},{hour:-1},{hour:9.5},{leadDays:4}])assert.throws(()=>upcomingReminderGroups([sub()],now,options));
});
test('cancellation follow-ups keep their own date with the chosen hour', () => {
 const groups=upcomingReminderGroups([sub({cancelBy:'2026-10-16'})],now,{hour:16,leadDays:7});
 assert.ok(groups.some(group=>group.cancelNames?.length && group.at.getDate()===16 && group.at.getHours()===16));
});
test('supporting merchant rows match exact display names rather than another merchant note', () => {
 const rows=annotateRows([credit(1),{...credit(2),title:'Other shop'}],{[id(2)]:{merchant:'',category:'Shopping',classification:'ordinary',note:'Synthetic refund'}},{});
 assert.deepEqual(filterHistory(rows,{from:day,to:day,source:'all',category:'all',merchant:'Synthetic refund'}).map(row=>row.id),[id(1)]);
});
test('batch requires an explicit keep or valid dated statement before committing choice', async () => {
 clearBatch(); const items=startBatch([{kind:'csv',name:'first.csv',text:'x'},{kind:'pdf',name:'last.pdf',base64:'eA=='}]);
 assert.equal(batchDecisionMade(),false);assert.equal(batchBalanceAllowed(items[1].token),false);
 assert.throws(()=>chooseBatchBalance(items[0].token));
 updateBatch(items[1].token,{balance:{amountCents:1000,asOf:'2026-10-07'}});chooseBatchBalance(items[1].token);
 assert.equal(batchDecisionMade(),true);updateBatch(items[0].token,{saved:true});chooseBatchBalance(null);
 assert.equal(batchBalanceAllowed(items[1].token),true); clearBatch();
 startBatch([{kind:'csv',name:'one.csv',text:'x'}]);chooseBatchBalance(null);assert.equal(batchDecisionMade(),true);clearBatch();
});
test('batch adapter durably retains the chosen balance and save status after a simulated restart', async () => {
 const saved=new Map(); configureBatchStorage({read:async key=>saved.get(key),save:async(key,value)=>{ if(value===null)saved.delete(key);else saved.set(key,{version:1,value:structuredClone(value)}); }});
 const [item]=startBatch([{kind:'pdf',name:'one.pdf',base64:'eA=='}]);updateBatch(item.token,{balance:{amountCents:1234,asOf:'2026-10-07'}});chooseBatchBalance(item.token);updateBatch(item.token,{saved:true});
 await resumeBatch();const persisted=structuredClone(saved.get('bank-batch'));
 clearBatch();saved.set('bank-batch',persisted);await resumeBatch();
 assert.equal(getBatch()[0].saved,true);assert.equal(batchBalanceAllowed(item.token),true);clearBatch();
});
for(const failing of ['eraseOriginals','eraseAttachments','eraseDrafts','clearRecovery','recordCompletion'])test(`interrupted erasure at ${failing} retains its marker and finishes on retry`, async () => {
 let marker=true, fail=true, records=['fixture'],originals=['fixture.pdf'],photos=['fixture.jpg'],drafts=['draft'],journals=['undo'];
 const steps={resetRecords:async()=>{records=[];},eraseOriginals:async()=>{originals=[];},eraseAttachments:async()=>{photos=[];},eraseDrafts:async()=>{drafts=[];},clearRecovery:async()=>{journals=[];},clearCache:()=>{},recordCompletion:async()=>{},clearMarker:async()=>{marker=false;}};
 const original=steps[failing];steps[failing]=async()=>{if(fail){fail=false;throw Error('Simulated interruption');}await original();};
 await assert.rejects(completeErasure(steps));assert.equal(marker,true);
 await completeErasure(steps);assert.equal(marker,false);assert.deepEqual([records,originals,photos,drafts,journals],[[],[],[],[],[]]);
});
test('available-attachment scope round trips with missing-original evidence and manual credits', async () => {
 const data={format:'gasfinder-data',version:1,createdAt:now.toISOString(),appVersion:'1',includesFiles:true,attachmentScope:'available',stores:{pocket:{version:15,state:{accountTransactions:[credit(1)]}}},archives:[{id:'import-missing',missingOriginal:true}],attachments:[]};
 const encrypted=await encryptBackup(data,'Synthetic finished backup 2026',async n=>randomBytes(n));assert.deepEqual(await decryptBackup(encrypted,'Synthetic finished backup 2026'),data);
 assert.throws(()=>validateBackup({...data,includesFiles:false}));
});
test('restored preferences reject invalid start screens or reminder schedules', () => {
 const valid={appearance:'dark',startScreen:'pocket',gasView:'list',subscriptionView:'calendar',reminderHour:18,reminderLeadDays:3,budgets:{},statementReminderDays:0};
 assert.doesNotThrow(()=>validateStoreState('gasfinder-settings',valid,{}));
 for(const change of [{reminderHour:99},{reminderLeadDays:5},{appearance:'unknown'},{startScreen:'admin'}])assert.throws(()=>validateStoreState('gasfinder-settings',{...valid,...change},{}));
});
