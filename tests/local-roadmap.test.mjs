import test from 'node:test';
import assert from 'node:assert/strict';
import { spendingSummary, transactionCsv } from '../src/features/insights/logic.ts';
import { transactionDay } from '../src/features/pocket/dates.ts';
import { matchCandidates } from '../src/features/pocket/reconciliation.ts';
import { previewAccountTransactions, parseBankCSV, guessMapping } from '../src/features/bank/importLogic.ts';
const row = (id,cents, classification = 'ordinary') => ({ id, title: id, amountCents: cents, occurredAt: '2026-10-03T16:00:00Z', sourceDate: '2026-10-03', source: 'csv', status: 'posted', accountLabel: 'Checking', details: { merchant: '', category: 'Food', classification, note: '' } });
test('insights separates transfers, refunds, pending and assignments without hiding financial rows', () => {
 const result = spendingSummary([row('shop',-1200),row('income',5000),row('transfer',9000,'transfer'),row('refund',500,'refund'),row('reversal',1200,'reversal'),{...row('pending',-900),status:'pending'},{...row('savings',200),source:'savings'}], '2026-10-01','2026-10-31');
 assert.equal(result.spendingCents,1200);assert.equal(result.incomeCents,5000);assert.equal(result.transferCents,9000);assert.equal(result.refundCents,500);assert.equal(result.reversalCents,1200);assert.equal(result.categories.Food,1200);
 assert.throws(() => spendingSummary([], '2026-02-30','2026-03-01'));
});
test('CSV retains signed cents and escapes spreadsheet formulas and quoted descriptions', () => {
 const csv = transactionCsv([{...row('=SUM(1,2)',-199),title:'=SUM(1,2) "test"'}]); assert.match(csv, /-1.99/); assert.match(csv, /'\=SUM/); assert.match(csv,/""test""/);
});
test('source calendar date is independent of display timezone and new imports preserve padded dates', () => {
 assert.equal(transactionDay({...row('x',1), sourceDate:'2026-10-01',occurredAt:'2026-09-30T23:00:00Z'}),'2026-10-01');
 const csv = parseBankCSV('Date,Description,Amount\n10/03/2026,Shop,-12.00'); const result = previewAccountTransactions(csv,guessMapping(csv),'Checking',new Date('2026-10-15')); assert.equal(result.rows[0].sourceDate,'2026-10-03');
});
test('reconciliation suggests each equal local purchase and excludes already linked or pending bank rows', () => {
 const purchases = ['one','two'].map(id => ({id,title:'Shop',amountCents:1200,purchasedAt:'2026-10-03T12:00:00Z',source:'manual',decision:'pending'}));
 assert.equal(matchCandidates([row('bank',-1200)],purchases,null).length,2);
 assert.equal(matchCandidates([{...row('bank',-1200),linkedPurchaseId:'one'}],purchases,null).length,0);
 assert.equal(matchCandidates([{...row('bank',-1200),status:'pending'}],purchases,null).length,0);
});
import { createRequire } from 'node:module';
import { reviewRoutedLegs, detourEconomics } from '../src/features/stations/tripReview.ts';
const require = createRequire(import.meta.url), pause = require('../extensions/spending-pause/pause.js');
test('one-shop override expires in rule calculation and does not end or reset the pause', () => {
 const now = Date.now(), active = pause.changePause(pause.defaultPause(),{type:'start'},now), temporary = pause.changePause(active,{type:'override',site:'amazon.com'},now+1000);
 assert.equal(temporary.reviewAt,active.reviewAt); assert.equal(temporary.enabled,true);
 assert.equal(pause.blockingRules(temporary,now+2000).filter(rule => rule.action.type === 'allow').length,1);
 assert.equal(pause.blockingRules(temporary,now+601001).filter(rule => rule.action.type === 'allow').length,0);
 assert.throws(() => pause.changePause(active,{type:'override',site:'unselected.com'},now));
 assert.equal(pause.changePause(temporary,{type:'end-override'},now+2000).override,undefined);
});
test('routed fuel coverage rejects an unsafe edited leg and keeps conservative detour arithmetic', () => {
 assert.equal(reviewRoutedLegs([60,200],100,300,10).complete,true);
 assert.equal(reviewRoutedLegs([80,200],100,300,10,50).complete,false);
 assert.equal(reviewRoutedLegs([80,200],100,300,10).rows[0].marginMiles,-10);
});
import { validateScannedPages } from '../src/features/bank/scannedValidation.ts';
test('scanned statement input stays bounded and exposes uncertainty without inventing rows', () => {
 const item = {text:'Total 10.00',x:10,y:20,width:40,height:8,confidence:.6};
 assert.equal(validateScannedPages([{page:1,items:[item]}]).uncertain,1);
 assert.throws(() => validateScannedPages(Array.from({length:13},(_,i)=>({page:i+1,items:[]}))));
 assert.throws(() => validateScannedPages([{page:1,items:[{...item,x:NaN}]}]));
});
import { needsAmountDirectionReview } from '../src/features/bank/importLogic.ts';
test('a signed CSV requires direction review even when its type column is not usable evidence', () => {
 for (const text of ['Date,Description,Amount\n10/14/2026,Refund,5.25','Date,Description,Amount,Type\n10/14/2026,Refund,5.25,Unknown']) { const csv = parseBankCSV(text); assert.equal(needsAmountDirectionReview(csv,guessMapping(csv)),true); }
 const explicit = parseBankCSV('Date,Description,Amount,Type\n10/14/2026,Refund,5.25,Credit'); assert.equal(needsAmountDirectionReview(explicit,guessMapping(explicit)),false);
});
import { rangeCoverage, latestStatementDay } from '../src/features/bank/coverage.ts';
import { startBatch, getBatch, updateBatch, chooseBatchBalance, batchBalanceAllowed, clearBatch } from '../src/features/bank/batch.ts';
test('coverage merges adjacent periods and exposes an actual missing day', () => {
 const files = [{periods:['9/01/2026 – 9/30/2026']},{periods:['10/01/2026 – 10/31/2026']}];
 assert.equal(rangeCoverage(files,'2026-09-15','2026-10-15').complete,true);
 assert.equal(rangeCoverage(files,'2026-08-01','2026-10-15').firstUncoveredDay,'2026-08-01');
 assert.equal(latestStatementDay(files),'2026-10-31');
});
test('batch keeps one balance candidate locked after the first reviewed save', () => {
 const items = startBatch([{kind:'csv',name:'one',text:'1'},{kind:'csv',name:'two',text:'2'}]);
 updateBatch(items[1].token,{balance:{amountCents:1234,asOf:'2026-10-07'}});
 chooseBatchBalance(items[1].token);assert.equal(batchBalanceAllowed(items[1].token),true);
 updateBatch(items[0].token,{saved:true});chooseBatchBalance(items[0].token);assert.equal(batchBalanceAllowed(items[0].token),false);
 assert.equal(getBatch()[0].saved,true);clearBatch();assert.equal(getBatch().length,0);
});
import { bankDuplicateCandidates } from '../src/features/pocket/reconciliation.ts';
import { pocketTransactions } from '../src/features/pocket/transactions.ts';
import { subscriptionBankEvidence } from '../src/features/subscriptions/bankEvidence.ts';
test('reviewed bank duplicates exclude their linked shadow purchase across all financial projections', () => {
 const bank = [{...row('bank-one',-1200),title:'Shop',linkedPurchaseId:'purchase-one'},{...row('bank-two',-1200),title:'Shop',linkedPurchaseId:'purchase-two'}];
 const purchases = ['purchase-one','purchase-two'].map(id=>({id,title:'Shop',amountCents:1200,purchasedAt:'2026-10-03T16:00:00Z',source:'bank-import',decision:'pending'}));
 assert.equal(bankDuplicateCandidates(bank,null).length,1);assert.equal(pocketTransactions(bank,purchases).length,2);
 bank[1].duplicateOf = bank[0].id;
 assert.equal(pocketTransactions(bank,purchases).length,1);assert.equal(subscriptionBankEvidence(bank,purchases).length,1);
 delete bank[1].duplicateOf; assert.equal(pocketTransactions(bank,purchases).length,2);
});
import { validateStoreState } from '../src/features/data/validation.ts';
test('backup validation rejects missing/cyclic or different-amount duplicate relationships', () => {
 const state = {reservedCents:0,reportedBalanceCents:null,activeGoal:null,purchases:[],entries:[],archivedGoals:[],accountTransactions:[row('one',-100),row('two',-100)]};
 state.accountTransactions[1].duplicateOf = 'one';assert.doesNotThrow(()=>validateStoreState('gasfinder-savings-pocket',state,{}));
 state.accountTransactions[0].duplicateOf = 'two';assert.throws(()=>validateStoreState('gasfinder-savings-pocket',state,{}),/duplicate relationship/);
 delete state.accountTransactions[0].duplicateOf;state.accountTransactions[1].amountCents = -200;assert.throws(()=>validateStoreState('gasfinder-savings-pocket',state,{}),/duplicate amount/);
});
test('an alarm failure cannot leave a newly allowed checkout behind', async () => {
 let saved = {}, rules = [];
 const api = {storage:{local:{get:async()=>saved,set:async value=>{saved=structuredClone(value);}}},declarativeNetRequest:{getDynamicRules:async()=>rules,updateDynamicRules:async change=>{rules=change.addRules;}},alarms:{clear:async()=>true,create:async()=>{throw Error('alarm unavailable');}}};
 const action = pause.pauseController(api,()=>1800000000000);
 await action({type:'start'});
 await assert.rejects(action({type:'override',site:'amazon.com'}),/alarm/);
 assert.equal(saved.shoppingPause.override,undefined);assert.equal(rules.some(rule=>rule.action.type==='allow'),false);
});
import { mergeAccountTransactions } from '../src/features/pocket/transactions.ts';
import { accountBalanceEstimate } from '../src/features/pocket/balanceEstimate.ts';
test('a delayed bank import can link to an existing app purchase without an orphan charge returning on reimport', () => {
 const bank = {...row('account-aaaaaaaaaaaaaaaa',-1200),title:'Shop',linkedPurchaseId:'bank-child'};
 const purchases = [{id:'app-parent',title:'Shop',amountCents:1200,purchasedAt:'2026-10-01T12:00:00Z',source:'manual',decision:'pending'},{id:'bank-child',title:'Shop',amountCents:1200,purchasedAt:'2026-10-03T16:00:00Z',source:'bank-import',decision:'pending'}];
 assert.equal(matchCandidates([bank],purchases,null).length,1);
 const linked = {...bank,linkedPurchaseId:'app-parent',shadowPurchaseIds:['bank-child']};
 assert.equal(pocketTransactions([linked],purchases).length,1);
 const merged = mergeAccountTransactions([linked],[bank],new Date('2026-10-15'));
 assert.equal(merged.transactions[0].linkedPurchaseId,'app-parent');assert.equal(pocketTransactions(merged.transactions,purchases).length,1);
 const state = {reportedBalanceCents:10000,balanceAsOf:'2026-09-30',balanceSource:'citizens-pdf',purchases,accountTransactions:merged.transactions};
 assert.equal(accountBalanceEstimate(state).estimatedCents,8800);
});
import { saveImportToArchive } from '../src/features/bank/archiveLogic.ts';
import { validateJson } from '../src/features/data/backupFormat.ts';
test('CSV metadata remains valid backup JSON even when optional PDF period fields were supplied as undefined', async () => {
 let metadata;
 const storage = {list:async()=>[],write:async entry=>{metadata=structuredClone(entry);},read:async()=>{throw Error('missing');},share:async()=>{}};
 await saveImportToArchive(storage,{kind:'csv',name:'example.csv',text:'Date,Description,Amount\n10/14/2026,Shop,-3.50'},{accountLabel:'Checking',transactionCount:1,purchaseCount:1,periods:undefined});
 assert.doesNotThrow(()=>validateJson(metadata));assert.equal(Object.hasOwn(metadata,'periods'),false);
});
