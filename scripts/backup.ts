// Trusted exporter. Run only from the project root, never from an agent review.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { serverDB } from './server-db';
const target = process.argv[2];
if (!target) throw new Error('Supply a local staging target');
const db=serverDB();
// Prove this client bypasses RLS. A successful empty SELECT alone proves nothing.
const access=await db.auth.admin.listUsers({page:1,perPage:1});
if(access.error) throw new Error('Backup requires credentials that can read ALL atracker_docs and outlines');
const rows: unknown[]=[];
for(let from=0;;from+=500){
  const {data,error}=await db.from('atracker_docs').select('*').order('user_id').order('collection').order('id').range(from,from+499);
  if(error || !data) throw new Error('Could not export all atracker_docs rows');
  rows.push(...data); if(data.length<500) break;
}
await mkdir(target,{recursive:true});
await writeFile(resolve(target,'atracker_docs.json'),JSON.stringify(rows));
const storage=db.storage.from('outlines');
async function walk(prefix='') {
  for(let offset=0;;offset+=100){
    const {data,error}=await storage.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
    if(error || !data) throw new Error('Could not list every outlines file');
    for(const item of data){
      const key=prefix?`${prefix}/${item.name}`:item.name;
      const base=resolve(target,'outlines'),dest=resolve(base,key),rel=relative(base,dest);
      if(rel.startsWith('..')||isAbsolute(rel)) throw new Error('Unsafe storage object path');
      if(!item.id){await walk(key);continue;}
      const result=await storage.download(key);
      if(result.error || !result.data) throw new Error('Could not download every outlines file');
      await mkdir(resolve(dest,'..'),{recursive:true});
      await writeFile(dest,Buffer.from(await result.data.arrayBuffer()));
    }
    if(data.length<100) break;
  }
}
await walk();
console.log('ATracker export complete');
