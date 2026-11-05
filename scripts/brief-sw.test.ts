import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
it('push taps open Brief for existing and new clients, rejecting external URLs',async()=>{
 const handlers:Record<string,(e:any)=>void>={};let notification:any,navigated='',opened='';let clients:any[]=[];
 const self={location:{origin:'https://dilibee.github.io'},addEventListener:(name:string,fn:any)=>{handlers[name]=fn},registration:{showNotification:async(_title:string,options:any)=>{notification=options}},clients:{matchAll:async()=>clients,openWindow:async(url:string)=>{opened=url}}};
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 let pending:Promise<any>=Promise.resolve();const waitUntil=(p:Promise<any>)=>{pending=p};
 handlers.push({data:{json:()=>({title:'Brief',body:'Summary only',url:'/atracker/#brief'})},waitUntil});await pending;expect(notification.data.url).toBe('https://dilibee.github.io/atracker/#brief');
 const event={notification:{data:notification.data,close:()=>{}},waitUntil};handlers.notificationclick(event);await pending;expect(opened).toBe(notification.data.url);
 clients=[{url:'https://dilibee.github.io/atracker/',navigate:async(url:string)=>{navigated=url},focus:async()=>{}}];handlers.notificationclick(event);await pending;expect(navigated).toBe(notification.data.url);
 handlers.push({data:{json:()=>({url:'https://evil.example/'})},waitUntil});await pending;expect(notification.data.url).toBe('https://dilibee.github.io/atracker/');
});
