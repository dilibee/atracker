import {describe,it,expect} from 'vitest';
import {longDate,daysLeft,countdown,sessionIndex,courseHeading} from './format';
import type {Task} from './types';
describe('card formatting',()=>{
 it('uses correct ordinals including teens',()=>{for(const [n,suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[11,'th'],[12,'th'],[13,'th'],[21,'st'],[22,'nd'],[23,'rd'],[31,'st']] as const)expect(longDate(`2026-01-${String(n).padStart(2,'0')}`)).toBe(`January ${n}${suffix}, 2026`)});
 it('counts Toronto calendar days across DST and UTC midnight',()=>{expect(daysLeft('2026-11-02','2026-11-01')).toBe(1);expect(countdown('2026-11-02T02:00:00Z','2026-11-01')).toBe('Today');expect(countdown('2026-11-02','2026-11-01')).toBe('Tomorrow');expect(countdown('2026-11-05','2026-11-01')).toBe('4 days left');expect(countdown('2026-10-30','2026-11-01')).toBe('Overdue by 2 days')});
 it('orders sessions within only their assignment milestone, including done tasks',()=>{const t:Task={assignmentId:'a',milestoneId:'m',date:'2026-11-01',title:'x',done:false,pinned:false};expect(sessionIndex('b',{b:{...t,date:'2026-11-02'},a:{...t,done:true},c:{...t,milestoneId:'other'},d:{...t,assignmentId:'other'}})).toEqual({index:2,total:2})});
 it('uses the course collection name',()=>expect(courseHeading({code:'MATH 117',name:'Calculus 1',color:'blue'})).toBe('MATH 117 - Calculus 1'));
});
