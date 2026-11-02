import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';

import {htmlOutlineText} from './outline-text';
import {fingerprint,validateProposal} from './proposals';
import type {Assignment} from '../src/lib/types';
// During a scan the CLI delegates to the trusted helper; it never loads dotenv.
if(process.env.ATRACKER_SCAN_TOKEN){
 try{
  const response=await fetch(`http://127.0.0.1:${process.env.ATRACKER_HELPER_PORT||'5199'}/agent-cli`,{method:'POST',headers:{Authorization:'Bearer '+process.env.ATRACKER_SCAN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(process.argv.slice(2)),signal:AbortSignal.timeout(120000)});
  const output=await response.text();console.log(output);if(!response.ok)process.exitCode=1;
 }catch{console.error('Scan CLI connection failed');process.exitCode=1}
}else await main();
async function main(){
const {serverDB,owner}=await import('./server-db');
const db=serverDB(),user_id=owner();
async function docs(collection:string){const result=[];for(let from=0;;from+=1000){const {data,error}=await db.from('atracker_docs').select('id,data').eq('user_id',user_id).eq('collection',collection).order('id').range(from,from+999);if(error)throw error;result.push(...data);if(data.length<1000)return result}}
try{
 const [command,arg]=process.argv.slice(2);
 if(command==='propose'){
  const assignment=validateProposal(JSON.parse(arg||'null')),id=fingerprint(assignment);
  const existing=await docs('assignments');
  if(existing.some(r=>fingerprint(r.data as Assignment)===id)){console.log('Already assigned');process.exit(0)}
  const {error}=await db.from('atracker_docs').upsert({user_id,collection:'proposals',id,data:{assignment,status:'pending',createdAt:new Date().toISOString()}},{onConflict:'user_id,collection,id',ignoreDuplicates:true});if(error)throw error;console.log('Proposal saved: '+id);
 }else if(command==='courses'){console.log(JSON.stringify(await docs('courses')))}
 else if(command==='outlines'){
  const data=[];for(let offset=0;;offset+=100){const page=await db.storage.from('outlines').list(user_id,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(page.error)throw page.error;data.push(...page.data.filter(f=>f.id));if(page.data.length<100)break}
  await mkdir('data/outlines',{recursive:true});const imported=new Set((await docs('scanRuns')).filter(r=>r.id.startsWith('outline-')).map(r=>r.data.path));
  for(const file of data){
   const path=`${user_id}/${file.name}`;if(imported.has(path))continue;
   const isHtml=/\.html?$/i.test(file.name)||file.metadata?.mimetype==='text/html';
   try{
   if(!isHtml&&!/\.pdf$/i.test(file.name)&&file.metadata?.mimetype!=='application/pdf')throw new Error('Unsupported outline type');
   if(Number(file.metadata?.size)>20*1024*1024)throw new Error('Outline exceeds 20 MB');
   const {data:pdf,error:downloadError}=await db.storage.from('outlines').download(path);if(downloadError)throw downloadError;
   if(pdf.size>20*1024*1024)throw new Error('Outline exceeds 20 MB');
   const bytes=new Uint8Array(await pdf.arrayBuffer()),local=resolve('data/outlines',basename(file.name));await writeFile(local,bytes);
   if(isHtml){console.log(JSON.stringify({path,local,pages:[{page:1,text:await htmlOutlineText(new TextDecoder().decode(bytes))}]}));continue;}
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const loading=getDocument({data:bytes,useSystemFonts:true}),document=await loading.promise;
   try{if(document.numPages>100)throw new Error('Outline exceeds 100 pages; review it manually');const pages=[];for(let n=1;n<=document.numPages;n++){const page=await document.getPage(n),content=await page.getTextContent();pages.push({page:n,text:content.items.map(item=>'str' in item?item.str:'').join(' ')})}console.log(JSON.stringify({path,local,pages}));}finally{await loading.destroy()}
   }catch(e){console.log(JSON.stringify({path,error:e instanceof Error?e.message:'Extraction failed'}))}
  }
 }else if(command==='outline-done'){
  if(!arg||!arg.startsWith(user_id+'/'))throw new Error('Expected an owned outline path');const {error}=await db.from('atracker_docs').upsert({user_id,collection:'scanRuns',id:'outline-'+Buffer.from(arg).toString('base64url'),data:{status:'imported',startedAt:new Date().toISOString(),log:'Outline reviewed',path:arg}});if(error)throw error;
 }else throw new Error('Usage: at propose <json> | courses | outlines | outline-done <storage-path>');
}catch(e){console.error(e instanceof Error?e.message:'CLI failed');process.exitCode=1}

}
