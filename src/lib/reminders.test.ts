import {describe,it,expect} from 'vitest';
import {selectReminders,reminderWasSent,reminderDeliveryId} from './reminders';
import {defaults,type Store,type Assignment} from './types';
const assignment:Assignment={course:'ECE 105',title:'Quiz #7',type:'Quiz',remindOnly:true,dueDates:[{id:'m',label:'Due',datetime:'2026-11-02T04:30:00Z'}],estDays:2,steps:[],link:'',notes:'',status:'active',source:'manual'};
const store=():Store=>({courses:{},tasks:{},proposals:{},pushSubs:{},reminderLog:{},scanRuns:{},settings:{main:defaults},assignments:{a:assignment}} satisfies Store);
const due=(s:Store,instant:string)=>selectReminders(s,new Date(instant)).filter(n=>n.id.startsWith('due/'));
describe('reminder selection',()=>{
 it('selects one day-before notice at morning time in the configured timezone across DST',()=>{
  const s=store();
  expect(due(s,'2026-10-31T11:59:00Z')).toEqual([]);
  const notices=due(s,'2026-10-31T12:00:00Z');
  expect(notices).toHaveLength(1);
  expect(notices[0].title).toBe('Tomorrow: ECE 105 Quiz #7');
  expect(due(s,'2026-10-31T22:00:00Z')).toEqual(notices);
 });
 it('skips three-day and day-of notices for reminder-only items',()=>{
  for(const instant of ['2026-10-29T12:00:00Z','2026-11-01T13:00:00Z'])expect(due(store(),instant)).toEqual([]);
 });
 it('keeps all three normal deadline notices unchanged',()=>{
  const s=store();s.assignments.a={...assignment,remindOnly:false};
  for(const [instant,title] of [['2026-10-29T12:00:00Z','Due in 3 days'],['2026-10-31T12:00:00Z','Due in 1 day'],['2026-11-01T13:00:00Z','Due today']])expect(due(s,instant)[0].title).toBe(title);
 });
 it('skips completed assignments',()=>{
  const s=store();s.assignments.a={...assignment,status:'done'};
  expect(due(s,'2026-10-31T12:00:00Z')).toEqual([]);
 });
 it('deduplicates repeated selection per subscription using reminderLog',()=>{
  const s=store(),notice=due(s,'2026-10-31T12:00:00Z')[0];
  expect(reminderWasSent(s,notice,'phone')).toBe(false);
  s.reminderLog[reminderDeliveryId(notice,'phone')]={sentAt:'2026-10-31T12:00:00Z'};
  const repeated=due(s,'2026-10-31T15:00:00Z')[0];
  expect(reminderWasSent(s,repeated,'phone')).toBe(true);
  expect(reminderWasSent(s,repeated,'other')).toBe(false);
 });
});
