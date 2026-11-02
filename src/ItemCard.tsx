import type {ReactNode} from 'react';
import type {Assignment,Course,Task} from './lib/types';
import {longDate,countdown,sessionIndex,courseHeading,calendarDay} from './lib/format';
export function ItemCard({assignment:a,course,tasks,assignmentId,taskId,milestoneId,today,children,leading}:{assignment:Assignment;course:Course;tasks:Record<string,Task>;assignmentId?:string;taskId?:string;milestoneId?:string;today:string;children?:ReactNode;leading?:ReactNode}){
 const task=taskId?tasks[taskId]:undefined,milestone=a.dueDates.find(m=>m.id===(task?.milestoneId||milestoneId));
 const dates=[...a.dueDates].sort((x,y)=>Date.parse(x.datetime)-Date.parse(y.datetime)),due=milestone?.datetime||(dates.find(m=>calendarDay(m.datetime)>=today)||dates.at(-1))?.datetime||'';
 const date=task?.date||due,session=taskId?sessionIndex(taskId,tasks):undefined,total=Object.values(tasks).filter(t=>t.assignmentId===assignmentId).length;
 const description=a.notes?.split(/\r\n|[\n\r\u2028\u2029]/,1)[0].trim();
 return <article className="item-card" style={{borderTopColor:course.color}}>{leading}<div className="item-content"><span className="chip" style={{background:course.color+'22',borderColor:course.color}}>{courseHeading(course)}</span><h3 className={task?.done?'struck':''}>{task?.title||a.title}</h3>{description&&<span className="assignment-notes">{description}</span>}<p>{date?`${longDate(date)} - ${countdown(date,today)}`:'No due date'}</p>{due&&<small>{a.remindOnly?'REMINDER':session?`Session ${session.index} of ${session.total}`:total?`${total} sessions planned`:''}{(a.remindOnly||session||total>0)?' - ':''}Due {longDate(due)}</small>}{children}</div></article>
}
