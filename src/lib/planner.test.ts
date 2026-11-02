import {describe,it,expect} from 'vitest';
import {plan,day,addDays,deadlineDay} from './planner';
import {defaults,type Assignment} from './types';
const a:Assignment={course:'ECE 150',title:'Test',type:'Project',dueDates:[{id:'m',label:'Due',datetime:'2026-11-15T23:59:00-05:00'}],estDays:4,steps:[],link:'',notes:'',status:'active',source:'manual'};
describe('planner',()=>{
 it('spreads work across the window, with review and no work on deadline',()=>{const p=plan({a},{},defaults,'2026-11-01');expect(Object.values(p.tasks).map(t=>t.date)).toEqual(['2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-13']);expect(p.atRisk).toEqual([])});
 it('plans each milestone',()=>{const p=plan({a:{...a,dueDates:[...a.dueDates,{id:'n',label:'Final',datetime:'2026-11-25T20:00:00-05:00'}]}},{},defaults,'2026-11-01');expect(Object.keys(p.tasks)).toHaveLength(10)});
 it('keeps steps ordered',()=>{const p=plan({a:{...a,steps:['Read','Write','Review'].map((title,i)=>({id:String(i),title,done:false}))}},{},defaults,'2026-11-01');const dates=Object.values(p.tasks).map(t=>t.date);expect(dates).toEqual([...dates].sort());expect(new Set(dates).size).toBe(3)});
 it('flags late assignments and overload',()=>{expect(plan({a},{},defaults,'2026-11-14').atRisk).toContain('a');expect(plan({a},{},{...defaults,maxTasksPerDay:1},'2026-11-01').atRisk).toContain('a')});
 it('keeps pinned tasks and rolls misses forward',()=>{const first=plan({a},{},defaults,'2026-11-01');const [id,t]=Object.entries(first.tasks)[0];const p=plan({a},{[id]:{...t,date:'2026-11-02',pinned:true}},defaults,'2026-11-03');expect(p.tasks[id]).toMatchObject({date:'2026-11-03',pinned:true,catchUp:true})});
 it('skips blackout dates and preserves completion',()=>{const first=plan({a},{},{...defaults,blackoutDates:['2026-11-11']},'2026-11-01');expect(Object.values(first.tasks).some(t=>t.date==='2026-11-11')).toBe(false);const [id,t]=Object.entries(first.tasks)[0];expect(plan({a},{[id]:{...t,done:true}},defaults,'2026-11-12').tasks[id].done).toBe(true)});
 it('does not repurpose work-task identities when a day passes',()=>{const first=plan({a},{},defaults,'2026-11-10');const [id,t]=Object.entries(first.tasks)[0];const next=plan({a},first.tasks,defaults,'2026-11-11');expect(next.tasks[id]).toMatchObject({title:t.title,date:'2026-11-11',catchUp:true});expect(Object.keys(next.tasks).filter(k=>k.endsWith('/review'))).toHaveLength(1)});
 it('keeps successive steps on separate days when load shifts them',()=>{const stepped={...a,steps:['one','two','three'].map(id=>({id,title:id,done:false}))};const p=plan({a:stepped,b:stepped},{},{...defaults,maxTasksPerDay:1},'2026-11-01');for(const id of ['a','b']){const dates=Object.values(p.tasks).filter(t=>t.assignmentId===id).map(t=>t.date);expect(new Set(dates).size).toBe(3);expect(dates).toEqual([...dates].sort())}});
});

describe('planner regressions',()=>{
 const steps={...a,steps:['one','two','three'].map(id=>({id,title:id,done:false}))};
 it('uses calendar days through Toronto DST and explicit offset midnight',()=>{
  expect(day(new Date('2026-11-02T04:30:00Z'))).toBe('2026-11-01');
  expect(addDays('2026-11-01',1)).toBe('2026-11-02');
  expect(addDays('2026-03-08',-1)).toBe('2026-03-07');
  expect(deadlineDay('2026-11-11','Asia/Tokyo')).toBe('2026-11-11');
  expect(deadlineDay('2026-11-11T23:59:00','Asia/Tokyo')).toBe('2026-11-11');
 });
 it('keeps one work task per original window day and does not regenerate completed work',()=>{
  const first=plan({a},{},defaults,'2026-11-10');
  expect(Object.values(first.tasks).filter(t=>!t.title.startsWith('Review')).map(t=>t.date)).toEqual(['2026-11-10','2026-11-11','2026-11-12','2026-11-13']);
  const completed=Object.fromEntries(Object.entries(first.tasks).map(([k,t])=>[k,{...t,done:true}]));
  const later=plan({a},completed,defaults,'2026-11-16');
  expect(Object.keys(later.tasks).sort()).toEqual(Object.keys(first.tasks).sort());
  expect(Object.values(later.tasks).every(t=>t.done)).toBe(true);
 });
 it('rolls overdue assignments to today, never to a past date, and stays stable on replan',()=>{
  const first=plan({a},{},defaults,'2026-11-20');
  expect(first.atRisk).toContain('a');
  expect(Object.values(first.tasks).every(t=>t.date==='2026-11-20'&&t.catchUp)).toBe(true);
  expect(plan({a},first.tasks,defaults,'2026-11-20').tasks).toEqual(first.tasks);
 });
 it('keeps a rolled miss in Catch-up across repeated replans',()=>{
  const first=plan({a},{},defaults,'2026-11-10');
  const next=plan({a},first.tasks,defaults,'2026-11-11');
  expect(plan({a},next.tasks,defaults,'2026-11-11').tasks).toEqual(next.tasks);
 });
 it('drops preserved tasks when their step or milestone was removed',()=>{
  const first=plan({a:steps},{},defaults,'2026-11-01');
  const pinned=Object.fromEntries(Object.entries(first.tasks).map(([id,t])=>[id,{...t,pinned:true}]));
  const next=plan({a:{...steps,steps:steps.steps.slice(1)}},pinned,defaults,'2026-11-01');
  expect(Object.values(next.tasks).some(t=>t.stepId==='one')).toBe(false);
  expect(plan({a:{...steps,dueDates:[]}},pinned,defaults,'2026-11-01').tasks).toEqual({});
 });
 it('reserves days before a pinned later step and after a pinned first step',()=>{
  const first=plan({a:steps},{},defaults,'2026-11-01');
  const middle='a/m/two';
  const next=plan({a:steps},{[middle]:{...first.tasks[middle],date:'2026-11-11',pinned:true}},defaults,'2026-11-01');
  expect(next.tasks['a/m/one'].date).toBe('2026-11-10');
  expect(next.tasks[middle].date).toBe('2026-11-11');
  expect(next.tasks['a/m/three'].date>'2026-11-11').toBe(true);
  const pinnedFirst=plan({a:steps},{'a/m/one':{...first.tasks['a/m/one'],date:'2026-11-11',pinned:true}},defaults,'2026-11-01');
  expect(pinnedFirst.tasks['a/m/two'].date).toBe('2026-11-12');
 });
 it('does not push an earlier step beyond a later step deadline',()=>{
  const p=plan({a:{...steps,steps:steps.steps.map((s,i)=>({...s,...(i===1?{dueDate:'2026-11-11'}:{})}))}},{},defaults,'2026-11-01');
  expect(p.tasks['a/m/one'].date).toBe('2026-11-10');
  expect(p.tasks['a/m/two'].date).toBe('2026-11-11');
 });
 it('has a full window even with zero buffer, and never plans on deadline',()=>{
  const p=plan({a},{},{...defaults,bufferDays:0},'2026-11-01');
  expect(p.atRisk).toEqual([]);
  expect(Object.values(p.tasks).every(t=>t.date<'2026-11-15')).toBe(true);
 });
 it('never schedules on blackouts even when fixed steps make strict order impossible',()=>{
  const p=plan({a:steps},{'a/m/one':{assignmentId:'a',milestoneId:'m',stepId:'one',title:'one',date:'2026-11-13',done:false,pinned:true}},{...defaults,blackoutDates:['2026-11-14']},'2026-11-01');
  expect(Object.values(p.tasks).every(t=>t.date!=='2026-11-14')).toBe(true);
  expect(p.atRisk).toContain('a');
 });
});

it('removes Catch-up when a missed task is pinned to a future date',()=>{
 const first=plan({a},{},defaults,'2026-11-10');
 const [id,t]=Object.entries(first.tasks)[0];
 const next=plan({a},{[id]:{...t,date:'2026-11-12',pinned:true,catchUp:true}},defaults,'2026-11-11');
 expect(next.tasks[id]).toMatchObject({date:'2026-11-12',pinned:true,catchUp:false});
});

describe('reminder-only assignments',()=>{
 it('creates no work or risk even for late milestones with steps',()=>{
  expect(plan({a:{...a,remindOnly:true,steps:[{id:'s',title:'Read',done:false}]}},{},{...defaults,maxTasksPerDay:1},'2026-11-20')).toEqual({tasks:{},atRisk:[]});
 });
 it('removes existing pinned, completed and catch-up tasks when enabled',()=>{
  const previous=plan({a},{},defaults,'2026-11-01').tasks;
  for(const t of Object.values(previous)){t.pinned=true;t.done=true;t.catchUp=true;}
  expect(plan({a:{...a,remindOnly:true}},previous,defaults,'2026-11-20')).toEqual({tasks:{},atRisk:[]});
 });
 it('does not affect normal assignments in a mixed plan',()=>{
  const normal=plan({a},{},defaults,'2026-11-01');
  expect(plan({a,b:{...a,remindOnly:true}},{},defaults,'2026-11-01')).toEqual(normal);
 });
});
