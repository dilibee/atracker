import {deadlineDay} from './planner';
import type {Course,Task} from './types';
export const calendarDay=(value:string|Date)=>value instanceof Date?deadlineDay(value.toISOString(),'America/Toronto'):deadlineDay(value,'America/Toronto');
export function longDate(value:string|Date){const date=calendarDay(value),n=Number(date.slice(8)),suffix=n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');return `${new Date(date+'T12:00:00Z').toLocaleString('en-US',{month:'long',timeZone:'UTC'})} ${n}${suffix}, ${date.slice(0,4)}`}
export const daysLeft=(value:string|Date,today:string|Date=new Date())=>Math.round((Date.parse(calendarDay(value))-Date.parse(calendarDay(today)))/86400000);
export function countdown(value:string|Date,today:string|Date=new Date()){const n=daysLeft(value,today);return n<0?`Overdue by ${-n} days`:n===0?'Today':n===1?'Tomorrow':`${n} days left`}
export function sessionIndex(id:string,tasks:Record<string,Task>){const task=tasks[id];const group=Object.entries(tasks).filter(([,t])=>t.assignmentId===task?.assignmentId&&t.milestoneId===task?.milestoneId).sort(([a,x],[b,y])=>x.date.localeCompare(y.date)||a.localeCompare(b));return {index:group.findIndex(([key])=>key===id)+1,total:group.length}}
export const courseHeading=(course:Course)=>`${course.code} - ${course.name}`;
