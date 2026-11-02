import {day,addDays,plan} from './planner';
import {defaults,type Store} from './types';
export interface Notice {id:string;title:string;body:string}
// Pure selection; delivery records each notice/subscription pair in reminderLog.
export function selectReminders(s:Store,now:Date):Notice[]{
 const settings=s.settings.main||defaults,today=day(now,settings.timezone);
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:settings.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const remaining=Object.values(plan(s.assignments,s.tasks,settings,today).tasks).filter(t=>t.date===today&&!t.done).length;
 const notices:Notice[]=[];
 if(clock>=settings.morning)notices.push({id:`morning/${today}`,title:"Today's plan",body:`${remaining} tasks on your plan today.`});
 if(clock>=settings.evening&&remaining)notices.push({id:`evening/${today}`,title:'A little progress before tomorrow',body:`${remaining} tasks still unchecked today.`});
 for(const [id,a]of Object.entries(s.assignments))if(a.status==='active')for(const m of a.dueDates)for(const offset of a.remindOnly?[1]:[3,1,0]){
  if(day(new Date(m.datetime),settings.timezone)!==addDays(today,offset)||clock<settings.morning)continue;
  notices.push({id:`due/${id}/${m.id}/${m.datetime}/${offset}`,title:a.remindOnly?`Tomorrow: ${a.course} ${a.title}`:offset?`Due in ${offset} day${offset===1?'':'s'}`:'Due today',body:`${a.course}: ${a.title} — ${m.label}`});
 }
 return notices;
}
export const reminderDeliveryId=(notice:Notice,subId:string)=>`${notice.id}/${subId}`;
export const reminderWasSent=(s:Store,notice:Notice,subId:string)=>!!s.reminderLog[reminderDeliveryId(notice,subId)];
