import type {Assignment,Settings,Task} from './types';
export const day=(d:Date,timezone='America/Toronto')=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
// Date-only step deadlines are calendar dates, not UTC instants.
export const deadlineDay=(value:string,timezone:string)=>/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value)?value.slice(0,10):day(new Date(value),timezone);
export const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function plan(assignments:Record<string,Assignment>,previous:Record<string,Task>,settings:Settings,today=day(new Date(),settings.timezone)) {
 const tasks:Record<string,Task>={},risk=new Set<string>(),load:Record<string,number>={};
 const put=(id:string,t:Task)=>{tasks[id]=t;if(!t.done)load[t.date]=(load[t.date]||0)+1;};
 for(const [id,t] of Object.entries(previous)) {
  const a=assignments[t.assignmentId];
  if(a?.status!=='active'||!a.dueDates.some(m=>m.id===t.milestoneId)||
    (t.stepId?!a.steps.some(s=>s.id===t.stepId):a.steps.length>0))continue;
  if(t.done||t.pinned||t.catchUp||t.date<today)put(id,{...t,...(t.catchUp&&t.date>today?{catchUp:false}:{}),...(!t.done&&t.date<today?{date:today,catchUp:true}:{})});
 }
 const entries=Object.entries(assignments).flatMap(([id,a])=>a.status==='done'?[]:a.dueDates.map(m=>({id,a,m,due:day(new Date(m.datetime),settings.timezone)}))).sort((a,b)=>a.due.localeCompare(b.due));
 for(const {id,a,m,due} of entries){
  const target=addDays(due,-Math.max(0,settings.bufferDays));
  const end=target>=due?addDays(due,-1):target;
  const start=addDays(end,-Math.max(1,a.estDays)+1);const window:string[]=[],fullWindow:string[]=[];
  for(let d=start;d<=end;d=addDays(d,1)){fullWindow.push(d);if(d>=today&&!settings.blackoutDates.includes(d))window.push(d);}
  if(window.length<a.estDays)risk.add(id);
  const days=window.length?window:[today];
  const units=a.steps.length?a.steps.map(s=>({key:s.id,title:s.title,stepId:s.id,done:s.done,deadline:s.dueDate})):[...fullWindow.map((d,i)=>({key:'work-'+d,title:`Work on ${a.title} (${i+1}/${fullWindow.length})`,stepId:undefined,done:false,deadline:undefined})),{key:'review',title:'Review & submit: '+a.title,stepId:undefined,done:false,deadline:undefined}];
  const strictOrder=a.steps.length>0&&days.length>=units.length;
  let floor=days[0];
  units.forEach((u,i)=>{const key=`${id}/${m.id}/${u.key}`;if(tasks[key]){const next=strictOrder?addDays(tasks[key].date,1):tasks[key].date;floor=next>floor?next:floor;return;}
   const preferred=a.steps.length?days[Math.round(i*(days.length-1)/Math.max(1,units.length-1))]:days[Math.min(i,days.length-1)];
   const deadline=u.deadline?deadlineDay(u.deadline,settings.timezone):end;

   const lastAllowed=strictOrder?days[days.length-(units.length-i)]:days[days.length-1];
   // Reserve room before fixed later steps, and respect later steps' earlier deadlines.
   let ceiling=lastAllowed;
   if(a.steps.length)for(let j=i+1;j<units.length;j++){
    const later=units[j],fixed=tasks[`${id}/${m.id}/${later.key}`];
    const bound=fixed?.date||(later.deadline?deadlineDay(later.deadline,settings.timezone):end);
    const before=strictOrder?addDays(bound,-(j-i)):bound;
    if(before<ceiling)ceiling=before;
   }
   const candidates=days.filter(d=>d>=floor&&d<=deadline&&d<=ceiling);
   const chosen=[...candidates].sort((x,y)=>((load[x]||0)>=settings.maxTasksPerDay?1:0)-((load[y]||0)>=settings.maxTasksPerDay?1:0)||Math.abs(days.indexOf(x)-days.indexOf(preferred))-Math.abs(days.indexOf(y)-days.indexOf(preferred))||(load[x]||0)-(load[y]||0)||x.localeCompare(y))[0]||days.find(d=>d>=floor)||days[days.length-1];
   if(!candidates.length||chosen>=due||(load[chosen]||0)>=settings.maxTasksPerDay)risk.add(id);
   put(key,{assignmentId:id,milestoneId:m.id,stepId:u.stepId,date:chosen,title:u.title,done:u.done,pinned:false,...(due<=today?{catchUp:true}:{})});floor=strictOrder?addDays(chosen,1):chosen;
  });
  if(a.steps.length){
   const ordered=units.map(u=>tasks[`${id}/${m.id}/${u.key}`]);
   ordered.forEach((t,i)=>{if((i&&t.date<ordered[i-1].date)||(strictOrder&&i&&t.date===ordered[i-1].date)||
     (a.steps[i].dueDate&&t.date>deadlineDay(a.steps[i].dueDate!,settings.timezone)))risk.add(id)});
  }
 }
 for(const t of Object.values(tasks))if(!t.done){
  const a=assignments[t.assignmentId],m=a?.dueDates.find(d=>d.id===t.milestoneId);
  if((load[t.date]||0)>settings.maxTasksPerDay||(m&&t.date>=day(new Date(m.datetime),settings.timezone)))risk.add(t.assignmentId);
 }
 return {tasks,atRisk:[...risk]};
}
