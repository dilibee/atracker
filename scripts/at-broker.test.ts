import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {scanEnvironment} from './scan-policy';
it('native Node broker runs courses and scan-context under filtered env without npm, tsx or credentials',async()=>{
 const received:string[][]=[];
 const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;received.push(JSON.parse(body));res.end('[]')});
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
 try{
  const port=(server.address() as {port:number}).port;
  for(const name of ['courses','scan-context']){
   const code=await new Promise<number|null>((done,reject)=>{
    const child=spawn(process.execPath,[resolve('scripts/at.ts'),name],{env:{...scanEnvironment(process.env),ATRACKER_SCAN_TOKEN:'fake',ATRACKER_HELPER_PORT:String(port)},windowsHide:true,stdio:'ignore'});
    child.once('error',reject);child.once('exit',done);
   });expect(code).toBe(0);
  }
  expect(received).toEqual([['courses'],['scan-context']]);
 }finally{await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()))}
});
