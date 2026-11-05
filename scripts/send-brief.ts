import { pathToFileURL } from 'node:url';
import type { Brief } from '../src/lib/types';
import type { PushSubscription } from './web-push';
type Row={user_id:string;id:string;data:Brief};
export type Delivery={subs:(user:string)=>Promise<{id:string;data:PushSubscription}[]>;send:(sub:PushSubscription,payload:string)=>Promise<void>;remove:(user:string,id:string)=>Promise<void>;mark:(row:Row,at:string)=>Promise<void>;wasSent:(user:string,id:string)=>Promise<boolean>;record:(user:string,id:string,at:string)=>Promise<void>};
// A failed delivery leaves the brief unsent for retry. No content is logged.
export async function sendBrief(rows:Row[],io:Delivery,now=new Date()){
  const latest=new Map<string,Row>();
  for(const row of rows.filter(r=>!r.data.sentAt).sort((a,b)=>a.data.date.localeCompare(b.data.date)||a.id.localeCompare(b.id)))latest.set(row.user_id,row);
  let failed=false;
  for(const row of latest.values()){
    const subs=await io.subs(row.user_id);let ok=true;
    if(!subs.length)continue;
    for(const sub of subs){
      const deliveryId=`brief/${row.id}/${sub.id}`;
      if(await io.wasSent(row.user_id,deliveryId))continue;
      try{await io.send(sub.data,JSON.stringify({title:row.data.title,body:row.data.summary,url:'/atracker/#brief'}));await io.record(row.user_id,deliveryId,now.toISOString());}
      catch(e){if([404,410].includes((e as {statusCode?:number}).statusCode??0))await io.remove(row.user_id,sub.id);else{ok=false;failed=true;}}
    }
    if(ok)await io.mark(row,now.toISOString());
  }
  return !failed;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {serverDB}=await import('./server-db');const {sendNotification}=await import('./web-push');const db=serverDB();
  const rows:Row[]=[];
  for(let from=0;;from+=1000){const {data,error}=await db.from('atracker_docs').select('user_id,id,data').eq('collection','briefs').order('user_id').order('id').range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}
  const check=({error}:{error:unknown})=>{if(error)throw error;};
  const ok=await sendBrief(process.env.BRIEF_ID?rows.filter(r=>r.id===process.env.BRIEF_ID):rows,{
   subs:async user=>{const rows:{id:string;data:PushSubscription}[]=[];for(let from=0;;from+=1000){const {data,error}=await db.from('atracker_docs').select('id,data').match({user_id:user,collection:'pushSubs'}).order('id').range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}return rows;},
   send:sendNotification,
   wasSent:async(user,id)=>{const {data,error}=await db.from('atracker_docs').select('id').match({user_id:user,collection:'reminderLog',id}).maybeSingle();if(error)throw error;return !!data;},
   record:async(user,id,at)=>check(await db.from('atracker_docs').upsert({user_id:user,collection:'reminderLog',id,data:{sentAt:at}})),
   remove:async(user,id)=>check(await db.from('atracker_docs').delete().match({user_id:user,collection:'pushSubs',id})),
   mark:async(row,at)=>check(await db.from('atracker_docs').update({data:{...row.data,sentAt:at},updated_at:at}).match({user_id:row.user_id,collection:'briefs',id:row.id})),
  });if(!ok)throw new Error('Delivery failed');
 }catch{console.error('Brief delivery failed; retry required.');process.exitCode=1;}
}
