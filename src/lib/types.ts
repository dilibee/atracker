export interface Course {code:string;name:string;color:string}
export interface Assignment {course:string;title:string;type:string;dueDates:{id:string;label:string;datetime:string}[];estDays:number;steps:{id:string;title:string;done:boolean;dueDate?:string}[];weight?:number;link:string;notes:string;status:'active'|'done';source:'manual'|'learn'|'outline'}
export interface Task {assignmentId:string;stepId?:string;date:string;title:string;done:boolean;pinned:boolean;catchUp?:boolean;milestoneId:string}
export interface Settings {bufferDays:number;maxTasksPerDay:number;blackoutDates:string[];morning:string;evening:string;timezone:string}
export interface Proposal {assignment:Assignment;status:'pending'|'approved'|'rejected';createdAt:string}
export interface ScanRun {status:string;log:string;startedAt:string;finishedAt?:string}
export interface Collections {courses:Course;assignments:Assignment;tasks:Task;settings:Settings;proposals:Proposal;pushSubs:PushSubscriptionJSON;reminderLog:{sentAt:string};scanRuns:ScanRun}
export const COLLECTIONS=['courses','assignments','tasks','settings','proposals','pushSubs','reminderLog','scanRuns'] as const;
export type CollectionName=typeof COLLECTIONS[number];
export type Store={[K in CollectionName]:Record<string,Collections[K]>};
export const defaults:Settings={bufferDays:2,maxTasksPerDay:4,blackoutDates:[],morning:'08:00',evening:'19:00',timezone:'America/Toronto'};
export const typeDays:Record<string,number>={'Problem set':3,'Lab report':4,Project:7,Quiz:2,Exam:7,Other:3};
export const seededCourses:Record<string,Course>=Object.fromEntries([['MATH 115','Linear Algebra','#7c3aed'],['MATH 117','Calculus 1','#2563eb'],['ECE 105','Classical Mechanics','#0891b2'],['ECE 150','Programming Fundamentals','#15803d'],['ECE 190','Engineering Profession','#c2410c'],['COMMST 192','Communication','#be185d'],['ECE 198','Project Studio','#a16207']].map(([code,name,color])=>[code,{code,name,color}]));
