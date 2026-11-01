import {createHash,randomUUID} from 'node:crypto';
import type {Assignment} from '../src/lib/types';
export function validateProposal(raw:unknown):Assignment{
 if(!raw||typeof raw!=='object')throw new Error('Expected an assignment object');
 const a=raw as Assignment;
 if(typeof a.course!=='string'||!a.course.trim()||typeof a.title!=='string'||!a.title.trim()||a.title.length>200)throw new Error('Course and title are required');
 if(!Array.isArray(a.dueDates)||!a.dueDates.length||a.dueDates.length>30||a.dueDates.some(d=>!d||typeof d.label!=='string'||!Number.isFinite(Date.parse(d.datetime))||!/(Z|[+-]\d{2}:\d{2})$/.test(d.datetime)))throw new Error('Due dates need labels and ISO datetimes with explicit timezone');
 if(!Number.isInteger(a.estDays)||a.estDays<1||a.estDays>90)throw new Error('estDays must be 1–90');
 if(!['learn','outline'].includes(a.source))throw new Error('Source must be learn or outline');
 const steps=a.steps??[];if(!Array.isArray(steps)||steps.some(s=>!s||typeof s.title!=='string'||(s.dueDate&&!Number.isFinite(Date.parse(s.dueDate)))))throw new Error('Invalid steps');
 return {course:a.course.trim(),title:a.title.trim(),type:a.type||'Other',estDays:a.estDays,dueDates:a.dueDates.map(d=>({id:d.id||randomUUID(),label:d.label,datetime:new Date(d.datetime).toISOString()})),steps:steps.map(s=>({id:s.id||randomUUID(),title:s.title,done:false,...(s.dueDate?{dueDate:s.dueDate}:{})})),status:'active',source:a.source,weight:a.weight,link:typeof a.link==='string'?a.link:'',notes:typeof a.notes==='string'?a.notes:''};
}
export const fingerprint=(a:Assignment)=>createHash('sha256').update(JSON.stringify([a.course.toLowerCase().trim(),a.title.toLowerCase().replace(/\s+/g,' ').trim(),a.dueDates.map(d=>new Date(d.datetime).toISOString()).sort()])).digest('hex');
