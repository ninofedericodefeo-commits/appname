import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { matchCandidates, bankDuplicateCandidates, separationEvidence, separationStillApplies } from '../src/features/pocket/reconciliation.ts';
import { effectiveBankTransaction, clearInvalidBankDuplicates, pocketTransactions, mergeAccountTransactions } from '../src/features/pocket/transactions.ts';
import { accountBalanceEstimate, manualBalanceSnapshot } from '../src/features/pocket/balanceEstimate.ts';
import { parseBankBalance, parseDollars, canReserve } from '../src/features/pocket/logic.ts';
import { filterHistory } from '../src/features/pocket/repository.ts';
import { dateFromKey, localDateKey } from '../src/lib/calendarDate.ts';
import { applyAccountImport } from '../src/features/bank/accountImport.ts';
import { validateStoreState } from '../src/features/data/validation.ts';
import { encryptBackup, decryptBackup } from '../src/features/data/backupFormat.ts';
const now = new Date('2026-10-15T12:00:00Z');
const id = n => `account-${n.toString(16).padStart(16,'0')}`;
const bank = (n, extra = {}) => ({id:id(n),title:'Synthetic Shop',amountCents:-900,occurredAt:'2026-10-14T12:00:00Z',sourceDate:'2026-10-14',source:'csv',status:'posted',accountLabel:'Checking',accountId:'account-test',...extra});
const purchase = (n,extra = {}) => ({id:`manual-${n}`,title:'Synthetic Shop',amountCents:900,purchasedAt:'2026-10-14T12:00:00Z',source:'manual',decision:'pending',...extra});
const initial = extra => ({reportedBalanceCents:10000,reservedCents:0,activeGoal:null,archivedGoals:[],entries:[],purchases:[],accountTransactions:[],bankImportKeys:[],transactionDirections:{},separatePurchaseDecisions:[],...extra});
const separate = (kind, row, other, directions = {}) => ({id:`decision-${row.id}-${other.id}`,kind,bankId:row.id,otherId:other.id,evidence:separationEvidence(kind,row,other,directions),createdAt:now.toISOString()});

test('keep-both decisions survive serialization, pair order and account nickname changes without merging real charges', () => {
 const rows = [bank(1),bank(2)], decision = JSON.parse(JSON.stringify(separate('bank-bank',...rows)));
 assert.equal(bankDuplicateCandidates(rows,null,{separateDecisions:[decision]}).length,0);
 assert.equal(bankDuplicateCandidates(rows.toReversed(),null,{separateDecisions:[decision]}).length,0);
 assert.equal(bankDuplicateCandidates(rows.map(row=>({...row,accountLabel:'Renamed checking'})),null,{separateDecisions:[decision]}).length,0);
 assert.equal(pocketTransactions(rows,[]).length,2);
 const undone = {...decision,undoneAt:now.toISOString()};
 assert.equal(bankDuplicateCandidates(rows,null,{separateDecisions:[undone]}).length,1);
 assert.equal(separationStillApplies(undone,rows,[]),false);
});
test('separate decisions are scoped to the specific pair and reopen when evidence changes', () => {
 const rows = [bank(1),bank(2)], decision = separate('bank-bank',...rows);
 assert.equal(bankDuplicateCandidates([...rows,bank(3)],null,{separateDecisions:[decision]}).length,2);
 for (const change of [{amountCents:-901},{sourceDate:'2026-10-13'},{occurredAt:'2026-10-13T12:00:00Z'},{accountId:'another'},{title:'Different shop'},{status:'pending'}]) {
  assert.equal(separationStillApplies(decision,[rows[0],{...rows[1],...change}],[]),false,JSON.stringify(change));
 }
 assert.equal(separationStillApplies(decision,rows,[],{[rows[0].id]:'in'}),false);
});
test('different app/bank purchases remain separate until explicitly reconsidered; other equal purchases remain candidates', () => {
 const row = bank(1), first = purchase(1), other = purchase(2), decision = separate('bank-purchase',row,first);
 const options = {separateDecisions:[JSON.parse(JSON.stringify(decision))]};
 assert.deepEqual(matchCandidates([row],[first,other],null,options).map(pair=>pair.purchase.id),[other.id]);
 assert.equal(separationStillApplies(decision,[row],[first]),true);
 assert.equal(separationStillApplies(decision,[row],[{...first,amountCents:901}]),false);
 assert.equal(matchCandidates([row],[first],null,{separateDecisions:[{...decision,undoneAt:now.toISOString()}]}).length,1);
});
test('corrected deposits are never outgoing purchase matches; corrected withdrawals and linked evidence use the effective direction', () => {
 const debit = bank(1), credit = bank(2,{amountCents:900});
 assert.equal(matchCandidates([debit],[purchase(1)],null,{directions:{[debit.id]:'in'}}).length,0);
 const result = matchCandidates([credit],[purchase(1)],null,{directions:{[credit.id]:'out'}});
 assert.equal(result.length,1);assert.equal(result[0].row.amountCents,-900);assert.equal(result[0].row.directionCorrected,true);
 assert.equal(credit.amountCents,900);
 assert.equal(matchCandidates([{...debit,linkedPurchaseId:'bank-child'}],[purchase(1),purchase('child',{id:'bank-child',source:'bank-import'})],null,{directions:{'bank-child':'in'}}).length,0);
 assert.equal(matchCandidates([{...credit,status:'pending'}],[purchase(1)],null,{directions:{[credit.id]:'out'}}).length,0);
});
test('bank duplicate review honors corrected signs and changing a direction stops an incompatible exclusion', () => {
 const first = bank(1), second = bank(2,{amountCents:900}), directions = {[second.id]:'out'};
 assert.equal(bankDuplicateCandidates([first,second],null).length,0);
 assert.equal(bankDuplicateCandidates([first,second],null,{directions}).length,1);
 const rows = [first,{...second,duplicateOf:first.id}];
 assert.equal(clearInvalidBankDuplicates(rows,directions)[1].duplicateOf,first.id);
 assert.equal(clearInvalidBankDuplicates(rows,{})[1].duplicateOf,undefined);
 const state = initial({accountTransactions:rows,transactionDirections:directions});
 assert.doesNotThrow(()=>validateStoreState('gasfinder-savings-pocket',state,{}));
 assert.throws(()=>validateStoreState('gasfinder-savings-pocket',{...state,transactionDirections:{}},{}),/duplicate amount/);
 assert.equal(pocketTransactions(rows,[],[],[],directions).length,1);
 assert.equal(pocketTransactions(clearInvalidBankDuplicates(rows),[]).length,2);
});
test('reimports preserve separate decisions and effective duplicate exclusions', () => {
 const rows = [bank(1),bank(2)], decision = separate('bank-bank',...rows);
 const state = initial({accountTransactions:rows,separatePurchaseDecisions:[decision]});
 const again = applyAccountImport(state,[],false,'Checking',rows,{},now);
 assert.equal(again.transactionsAdded,0);
 assert.equal(bankDuplicateCandidates(again.state.accountTransactions,null,{separateDecisions:again.state.separatePurchaseDecisions}).length,0);
 const corrected = [bank(1),bank(2,{amountCents:900,duplicateOf:id(1)})], directions = {[id(2)]:'out'};
 const merged = mergeAccountTransactions(corrected,[{...corrected[1],duplicateOf:undefined}],now,directions);
 assert.equal(merged.transactions.find(row=>row.id===id(2)).duplicateOf,id(1));
});
test('review paging reaches every app and bank pair beyond former caps without duplicates; search reaches later pairs', () => {
 const rows = [], purchases = [], bankRows = [];
 for (let n=0;n<250;n++) {
  const title = `Merchant${String.fromCharCode(65+Math.floor(n/26))}${String.fromCharCode(65+n%26)}`;
  rows.push(bank(n+1,{title,amountCents:-1000-n}));purchases.push(purchase(n,{title,amountCents:1000+n}));
  bankRows.push(bank(n*2+1,{title}),bank(n*2+2,{title}));
 }
 function allPages(read) { const found=[];for(let offset=0;offset<1000;offset+=25) { const page=read({offset,limit:26});found.push(...page.slice(0,25));if(page.length<=25)break; }return found; }
 const apps = allPages(options=>matchCandidates(rows,purchases,null,options));
 const banks = allPages(options=>bankDuplicateCandidates(bankRows,null,options));
 assert.equal(apps.length,250);assert.equal(new Set(apps.map(pair=>pair.row.id)).size,250);
 assert.equal(banks.length,250);assert.equal(new Set(banks.map(pair=>pair.row.id)).size,250);
 assert.equal(bankDuplicateCandidates(bankRows,null,{query:'MerchantJP',limit:26}).length,1);
 assert.equal(matchCandidates(rows,purchases,null,{pair:[rows[249].id,purchases[249].id],limit:1}).length,1);
 const final = banks.at(-1);assert.equal(bankDuplicateCandidates(bankRows,null,{pair:[final.row.id,final.canonical.id],limit:1}).length,1);
});
test('signed bank balances have bounded cents while purchase and savings amounts remain nonnegative', () => {
 for (const [text,cents] of [['-12.34',-1234],['−12.34',-1234],['+12.34',1234],['-1,234.56',-123456],['0',0],['-0',0],['-1000000',-100000000]]) assert.equal(parseBankBalance(text),cents);
 for (const invalid of ['--1','+-1','-','-1.234','-1000000.01','Infinity','NaN']) assert.equal(parseBankBalance(invalid),null);
 assert.equal(parseDollars('-12.34'),null);
 assert.equal(canReserve(1,-1234,0),false);
});
test('negative manual snapshots retain source date and known-movement capture and reject unsafe values', () => {
 const original = initial({accountTransactions:[bank(1)],purchases:[purchase(1)]});
 const patch = manualBalanceSnapshot(original,-1234,now), state={...original,...patch};
 assert.equal(state.reportedBalanceCents,-1234);assert.equal(state.balanceSource,'manual');assert.ok(state.balanceIncludedTransactionIds.includes(id(1)));
 assert.equal(accountBalanceEstimate(state).estimatedCents,-1234);
 assert.equal(original.reportedBalanceCents,10000);
 assert.equal(manualBalanceSnapshot(original,0,now).reportedBalanceCents,0);
 for(const invalid of [NaN,Infinity,1.5,100000001,-100000001])assert.throws(()=>manualBalanceSnapshot(original,invalid,now));
});
test('strict date keys reject calendar rollover and history ranges share leap-year and range checks', () => {
 for (const invalid of ['2026-02-30','2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','0000-01-01','2026-1-01']) {
  assert.equal(dateFromKey(invalid),null);assert.throws(()=>filterHistory([],{from:invalid,to:'2026-12-31',source:'all',category:'all'}));
 }
 for(const valid of ['2024-02-29','2000-02-29','2026-12-31','0095-01-01'])assert.equal(localDateKey(dateFromKey(valid)),valid);
 assert.equal(dateFromKey('1900-02-29'),null);
 assert.doesNotThrow(()=>filterHistory([],{from:'',to:'',source:'all',category:'all'}));
 assert.throws(()=>filterHistory([],{from:'2026-10-15',to:'2026-10-01',source:'all',category:'all'}));
});
test('encrypted synthetic backup preserves reviewed separate-purchase evidence and negative balance', async () => {
 const rows=[bank(1),bank(2)], decision=separate('bank-bank',...rows), state=initial({reportedBalanceCents:-1234,accountTransactions:rows,separatePurchaseDecisions:[decision]});
 const payload={format:'gasfinder-data',version:1,createdAt:now.toISOString(),appVersion:'1.0',includesFiles:false,stores:{'gasfinder-savings-pocket':{version:14,state}},archives:[],attachments:[]};
 validateStoreState('gasfinder-savings-pocket',state,{});
 const password='Synthetic review recovery 2026';
 const encoded=await encryptBackup(payload,password,async count=>randomBytes(count));
 const restored=(await decryptBackup(encoded,password)).stores['gasfinder-savings-pocket'].state;
 assert.equal(restored.reportedBalanceCents,-1234);
 assert.equal(bankDuplicateCandidates(restored.accountTransactions,null,{separateDecisions:restored.separatePurchaseDecisions}).length,0);
 assert.throws(()=>validateStoreState('gasfinder-savings-pocket',{...state,separatePurchaseDecisions:[{...decision,kind:'unknown'}]},{}),/separate purchase decision/);
});
test('parser identity repair remaps review and Undo references while unchanged evidence stays kept separate', () => {
 const original=bank(1,{source:'citizens-pdf',linkedPurchaseId:'bank-child'}), other=bank(2), replacement={...original,id:id(3)};
 const decision=separate('bank-bank',original,other), app=purchase('child',{id:'bank-child',source:'bank-import'});
 const state=initial({accountTransactions:[original,other],purchases:[app],separatePurchaseDecisions:[decision],transactionDirections:{[original.id]:'out'},
  matchHistory:[{id:'link-test',bankId:original.id,purchaseId:app.id,createdAt:now.toISOString()}],
  bankDuplicateHistory:[{id:'duplicate-test',bankId:original.id,canonicalId:other.id,createdAt:now.toISOString(),undoneAt:now.toISOString()}]});
 const result=applyAccountImport(state,[],false,'Checking',[replacement],{},now).state;
 assert.equal(result.accountTransactions.length,2);assert.equal(result.separatePurchaseDecisions[0].bankId,replacement.id);
 assert.equal(result.matchHistory[0].bankId,replacement.id);assert.equal(result.bankDuplicateHistory[0].bankId,replacement.id);
 assert.equal(result.transactionDirections[replacement.id],'out');assert.equal(result.transactionDirections[original.id],undefined);
 assert.equal(separationStillApplies(result.separatePurchaseDecisions[0],result.accountTransactions,result.purchases,result.transactionDirections),true);
 assert.equal(bankDuplicateCandidates(result.accountTransactions,null,{directions:result.transactionDirections,separateDecisions:result.separatePurchaseDecisions}).length,0);
});
test('adding an explicit source-day field with the same calendar date does not invalidate an unchanged review', () => {
 const first=bank(1),second=bank(2);delete first.sourceDate;delete second.sourceDate;
 const decision=separate('bank-bank',first,second);
 assert.equal(separationStillApplies(decision,[{...first,sourceDate:'2026-10-14'},{...second,sourceDate:'2026-10-14'}],[]),true);
});
import { isCurrentReviewRevision } from '../src/features/pocket/reconciliation.ts';
test('an older review cannot undo a later decision for the same bank row even when its destination is equal', () => {
 const old={id:'old',bankId:id(1)},newer={id:'newer',bankId:id(1)},other={id:'other',bankId:id(2)};
 assert.equal(isCurrentReviewRevision([old,newer,other],old),false);
 assert.equal(isCurrentReviewRevision([old,newer,other],newer),true);
 assert.equal(isCurrentReviewRevision([old,{...newer,undoneAt:now.toISOString()},other],old),true);
 assert.equal(isCurrentReviewRevision([old,newer,other],other),true);
});
