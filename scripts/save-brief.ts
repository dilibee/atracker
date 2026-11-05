import { pathToFileURL } from 'node:url';
import type { Brief } from '../src/lib/types';

export function validateBrief(value: Brief): Brief {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !['brief','alert'].includes(value.kind ?? 'brief') ||
      ![value.title,value.summary,value.body].every(x=>typeof x==='string'&&x.trim()) || value.summary.length>160 || value.body.length>100_000 || value.sentAt!==null) throw new Error('Invalid brief');
  return {date:value.date,title:value.title,summary:value.summary,body:value.body,sentAt:null,kind:value.kind??'brief'};
}
export async function saveBrief(value: Brief, write:(id:string,brief:Brief)=>Promise<void>, id=`${new Date().toISOString()}-${crypto.randomUUID()}`) {
  await write(id,validateBrief(value)); return id;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    let input='';for await(const chunk of process.stdin)input+=chunk;const brief=JSON.parse(input);
    const {serverDB,owner}=await import('./server-db'); const db=serverDB(),user_id=owner();
    await saveBrief(brief,async(id,data)=>{const {error}=await db.from('atracker_docs').insert({user_id,collection:'briefs',id,data});if(error)throw error;},process.argv[2]);
    console.log('Brief saved.');
  } catch { console.error('Brief save failed.'); process.exitCode=1; }
}
