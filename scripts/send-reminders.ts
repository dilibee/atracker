import {sendNotification,type PushSubscription} from './web-push';
import {serverDB} from './server-db';
import {day,addDays,plan} from '../src/lib/planner';
import {COLLECTIONS,defaults,type Store} from '../src/lib/types';
const db=serverDB();
if(!process.env.VAPID_SUBJECT||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw new Error('Configure VAPID credentials.');
const stores:Record<string,Store>={};
for(let from=0;;from+=1000){const {data,error}=await db.from('atracker_docs').select('user_id,collection,id,data').order('user_id').order('collection').order('id').range(from,from+999);if(error)throw error;for(const row of data){const s=stores[row.user_id]??=Object.fromEntries(COLLECTIONS.map(c=>[c,{}])) as Store;if(COLLECTIONS.includes(row.collection))(s as any)[row.collection][row.id]=row.data;}if(data.length<1000)break}
for(const [user_id,s]of Object.entries(stores)){
 const settings=s.settings.main||defaults,now=new Date(),today=day(now,settings.timezone);
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:settings.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const planned=plan(s.assignments,s.tasks,settings,today),remaining=Object.values(planned.tasks).filter(t=>t.date===today&&!t.done).length;
 const notices:{id:string;title:string;body:string}[]=[];
 if(clock>=settings.morning)notices.push({id:`morning/${today}`,title:"Today's plan",body:`${remaining} tasks on your plan today.`});
 if(clock>=settings.evening&&remaining)notices.push({id:`evening/${today}`,title:'A little progress before tomorrow',body:`${remaining} tasks still unchecked today.`});
 for(const [id,a]of Object.entries(s.assignments))if(a.status==='active')for(const m of a.dueDates)for(const offset of [3,1,0])if(day(new Date(m.datetime),settings.timezone)===addDays(today,offset)&&clock>=settings.morning)notices.push({id:`due/${id}/${m.id}/${m.datetime}/${offset}`,title:offset?`Due in ${offset} day${offset===1?'':'s'}`:'Due today',body:`${a.course}: ${a.title} — ${m.label}`});
 for(const notice of notices)for(const [subId,sub]of Object.entries(s.pushSubs)){
  const id=`${notice.id}/${subId}`;if(s.reminderLog[id])continue;
  try{await sendNotification(sub as PushSubscription,JSON.stringify({title:notice.title,body:notice.body}));const {error}=await db.from('atracker_docs').upsert({user_id,collection:'reminderLog',id,data:{sentAt:now.toISOString()}});if(error)throw error;}
  catch(e){if([404,410].includes((e as {statusCode:number}).statusCode)){const {error}=await db.from('atracker_docs').delete().match({user_id,collection:'pushSubs',id:subId});if(error)throw error}else{console.error('Reminder delivery failed; retrying next run.');process.exitCode=1}}
 }
}
