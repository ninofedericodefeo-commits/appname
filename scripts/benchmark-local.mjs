// Synthetic records only. Desktop JS baseline; does not substitute for phone tests.
import { performance } from 'node:perf_hooks';
import { pocketTransactions, mergeAccountTransactions } from '../src/features/pocket/transactions.ts';
import { bankDuplicateCandidates } from '../src/features/pocket/reconciliation.ts';
import { annotateRows, filterHistory } from '../src/features/pocket/repository.ts';
import { spendingSummary } from '../src/features/insights/logic.ts';
import { parseBankCSV, guessMapping, previewAccountTransactions } from '../src/features/bank/importLogic.ts';
const rows = Array.from({length:10000},(_,index)=>({id:`account-${index.toString(16).padStart(16,'0')}`, title:`Synthetic Merchant ${String.fromCharCode(65+index%26)}`,amountCents:index%5===0?50000:-(500+index%1500),occurredAt:new Date(Date.UTC(2026,8,1+index%60,12)).toISOString(),sourceDate:new Date(Date.UTC(2026,8,1+index%60,12)).toISOString().slice(0,10),source:'csv',status:'posted',accountLabel:'Synthetic checking'}));
const results=[];
function measure(name,action){const before=performance.now(),value=action();results.push({operation:name,milliseconds:Math.round((performance.now()-before)*10)/10});return value;}
const heapBefore=process.memoryUsage().heapUsed;
const merged=measure('Merge/reimport 10,000 movements',()=>mergeAccountTransactions(rows,rows,new Date(2026,10,1)));
if(merged.added!==0||merged.transactions.length!==10000)throw Error('Reimport changed row count');
const projected=measure('Project and sort 10,000 history rows',()=>pocketTransactions(merged.transactions,[]));
const annotated=measure('Annotate 10,000 rows',()=>annotateRows(projected,{},{}));
measure('Filter history month',()=>filterHistory(annotated,{from:'2026-09-01',to:'2026-09-30',source:'all',category:'all'}));
measure('Summarize 10,000 rows',()=>spendingSummary(annotated,'2026-09-01','2026-10-31'));
measure('Review first 25 duplicate candidates',()=>bankDuplicateCandidates(rows,null,{limit:25}));
measure('Review page 11 of duplicate candidates',()=>bankDuplicateCandidates(rows,null,{offset:250,limit:25}));
const csv='Date,Description,Amount,Type\n'+rows.slice(0,5000).map(row=>`${row.sourceDate},${row.title},${(row.amountCents/100).toFixed(2)},${row.amountCents<0?'Debit':'Credit'}`).join('\n');
measure('Parse and preview maximum 5,000-row CSV',()=>{const parsed=parseBankCSV(csv);return previewAccountTransactions(parsed,guessMapping(parsed),'Synthetic checking');});
console.log(JSON.stringify({date:new Date().toISOString(),runtime:process.version,platform:process.platform,records:rows.length,heapIncreaseMB:Math.round((process.memoryUsage().heapUsed-heapBefore)/104857.6)/10,results},null,2));
