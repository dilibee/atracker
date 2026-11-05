import {describe,it,expect} from 'vitest';
import {sendBrief,type Delivery} from './send-brief';
import {saveBrief,validateBrief} from './save-brief';
import {BriefView} from '../src/BriefView';
import {renderToStaticMarkup} from 'react-dom/server';
const brief={date:'2026-11-04',title:'Morning brief',summary:'3 due soon · 15 jobs · 2 to approve',body:'Full brief <script>bad</script>',sentAt:null};
describe('brief delivery',()=>{
 it('saves a new unsent doc and validates without logging',async()=>{let row:any;await saveBrief(brief,async(id,b)=>{row={id,b}},'id');expect(row).toEqual({id:'id',b:{...brief,kind:'brief'}});expect(()=>validateBrief({...brief,summary:'x'.repeat(161)})).toThrow();});
 it('selects latest unsent per owner, sends summary, removes 404/410 and marks sent',async()=>{
 const calls:string[]=[],payloads:string[]=[];const io:Delivery={wasSent:async()=>false,record:async()=>{},subs:async()=>['ok','404','410'].map(id=>({id,data:{endpoint:id,keys:{p256dh:'',auth:''}}})),send:async(s,p)=>{payloads.push(p);if(s.endpoint!=='ok')throw {statusCode:Number(s.endpoint)};},remove:async(_,id)=>{calls.push(id)},mark:async row=>{calls.push('sent:'+row.id)}};
 expect(await sendBrief([{user_id:'a',id:'01',data:brief},{user_id:'a',id:'02',data:brief},{user_id:'a',id:'03',data:{...brief,sentAt:'already'}}],io)).toBe(true);expect(calls).toEqual(['404','410','sent:02']);expect(payloads).toHaveLength(3);expect(payloads[0]).not.toContain('Full brief');expect(JSON.parse(payloads[0]).url).toBe('/atracker/#brief');
 });
 it('transient errors leave brief unsent, no subscribers leaves it retryable',async()=>{let marked=false;const io:Delivery={wasSent:async()=>false,record:async()=>{},subs:async()=>[{id:'x',data:{endpoint:'x',keys:{p256dh:'',auth:''}}}],send:async()=>{throw {statusCode:503}},remove:async()=>{},mark:async()=>{marked=true}};expect(await sendBrief([{user_id:'a',id:'id',data:brief}],io)).toBe(false);expect(marked).toBe(false);io.subs=async()=>[];await sendBrief([{user_id:'a',id:'id',data:brief}],io);expect(marked).toBe(false);});
 it('renders escaped full body in the Brief view',()=>{const html=renderToStaticMarkup(BriefView({briefs:{id:brief}}));expect(html).toContain('Full brief &lt;script&gt;');expect(html).not.toContain('<script>');});
});

it('retries only subscriptions without a successful delivery record',async()=>{
 const delivered=new Set<string>(),sent:string[]=[];let failing=true,marked=0;
 const io:Delivery={subs:async()=>['a','b'].map(id=>({id,data:{endpoint:id,keys:{p256dh:'',auth:''}}})),wasSent:async(_,id)=>delivered.has(id),record:async(_,id)=>{delivered.add(id)},send:async sub=>{sent.push(sub.endpoint);if(sub.endpoint==='b'&&failing)throw {statusCode:503}},remove:async()=>{},mark:async()=>{marked++}};
 const rows=[{user_id:'owner',id:'brief',data:brief}];
 expect(await sendBrief(rows,io)).toBe(false);failing=false;expect(await sendBrief(rows,io)).toBe(true);
 expect(sent).toEqual(['a','b','b']);expect(marked).toBe(1);
});
