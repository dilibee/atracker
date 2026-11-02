import {sendNotification,type PushSubscription} from './web-push';
import {serverDB} from './server-db';
import {selectReminders,reminderDeliveryId,reminderWasSent} from '../src/lib/reminders';
import {COLLECTIONS,type Store} from '../src/lib/types';
const db=serverDB();
if(!process.env.VAPID_SUBJECT||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw new Error('Configure VAPID credentials.');
const stores:Record<string,Store>={};
for(let from=0;;from+=1000){const {data,error}=await db.from('atracker_docs').select('user_id,collection,id,data').order('user_id').order('collection').order('id').range(from,from+999);if(error)throw error;for(const row of data){const s=stores[row.user_id]??=Object.fromEntries(COLLECTIONS.map(c=>[c,{}])) as Store;if(COLLECTIONS.includes(row.collection))(s as any)[row.collection][row.id]=row.data;}if(data.length<1000)break}
for(const [user_id,s]of Object.entries(stores)){
 const now=new Date(),notices=selectReminders(s,now);
 for(const notice of notices)for(const [subId,sub]of Object.entries(s.pushSubs)){
  const id=reminderDeliveryId(notice,subId);if(reminderWasSent(s,notice,subId))continue;
  try{await sendNotification(sub as PushSubscription,JSON.stringify({title:notice.title,body:notice.body}));const {error}=await db.from('atracker_docs').upsert({user_id,collection:'reminderLog',id,data:{sentAt:now.toISOString()}});if(error)throw error;}
  catch(e){if([404,410].includes((e as {statusCode:number}).statusCode)){const {error}=await db.from('atracker_docs').delete().match({user_id,collection:'pushSubs',id:subId});if(error)throw error}else{console.error('Reminder delivery failed; retrying next run.');process.exitCode=1}}
 }
}
